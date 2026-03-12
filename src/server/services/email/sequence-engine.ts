/**
 * Email sequence engine.
 * Processes email sequences by determining which leads need the next step,
 * personalizing content, and sending via EmailSender.
 */

import { prisma } from '@/server/db/prisma';
import { logger } from '@/lib/logger';
import { EmailSender } from './sender';
import { EmailTracker } from './tracker';
import { DomainWarmup } from './warmup';
import { generateCompletion } from '@/server/services/ai/claude';

interface LeadData {
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  jobTitle: string | null;
  email: string;
  linkedinUrl: string | null;
}

type ReplyClassification = 'INTERESTED' | 'NOT_INTERESTED' | 'OOO' | 'UNSUBSCRIBE' | 'QUESTION';

export class SequenceEngine {
  private readonly sender: EmailSender;
  private readonly tracker: EmailTracker;
  private readonly warmup: DomainWarmup;
  private readonly log = logger.child({ service: 'SequenceEngine' });

  constructor() {
    this.sender = new EmailSender();
    this.tracker = new EmailTracker();
    this.warmup = new DomainWarmup();
  }

  /**
   * Process an email sequence: determine which leads need the next step,
   * personalize the content, and send emails.
   */
  async processSequence(sequenceId: string): Promise<void> {
    this.log.info({ sequenceId }, 'Processing email sequence');

    const sequence = await prisma.emailSequence.findUnique({
      where: { id: sequenceId },
      include: {
        steps: { orderBy: { order: 'asc' } },
        leads: {
          where: {
            status: {
              notIn: ['BOUNCED', 'OPTED_OUT', 'NOT_INTERESTED'],
            },
          },
        },
      },
    });

    if (!sequence) {
      throw new Error(`Sequence ${sequenceId} not found`);
    }

    if (sequence.status !== 'ACTIVE') {
      this.log.info({ sequenceId, status: sequence.status }, 'Sequence is not active, skipping');
      return;
    }

    if (sequence.steps.length === 0) {
      this.log.warn({ sequenceId }, 'Sequence has no steps');
      return;
    }

    // Check warmup limits
    const fromDomain = (process.env.OUTREACH_FROM_EMAIL || '').split('@')[1] || '';
    const warmupStartDays = parseInt(process.env.WARMUP_DAYS_SINCE_START || '0', 10);
    const schedule = this.warmup.getWarmupSchedule(fromDomain, warmupStartDays);
    let emailsSentToday = 0;

    this.log.info(
      { sequenceId, leadCount: sequence.leads.length, stepCount: sequence.steps.length, maxEmails: schedule.maxEmails },
      'Processing leads in sequence',
    );

    for (const lead of sequence.leads) {
      if (emailsSentToday >= schedule.maxEmails) {
        this.log.info(
          { emailsSentToday, maxEmails: schedule.maxEmails },
          'Warmup daily limit reached, stopping',
        );
        break;
      }

      try {
        // Determine current step from events count
        const sentEventsCount = await prisma.leadEvent.count({
          where: { leadId: lead.id, type: 'EMAIL_SENT' },
        });
        const leadWithStep = {
          ...lead,
          currentStep: sentEventsCount,
        };
        const sent = await this.processLeadInSequence(leadWithStep, sequence.steps);
        if (sent) {
          emailsSentToday++;
        }
      } catch (err) {
        this.log.error(
          { err, leadId: lead.id, email: lead.email },
          'Error processing lead in sequence',
        );
      }
    }

    this.log.info(
      { sequenceId, emailsSent: emailsSentToday },
      'Sequence processing complete',
    );
  }

  /**
   * Personalize an email template by replacing placeholders with lead data.
   */
  personalizeContent(template: string, lead: LeadData): string {
    const replacements: Record<string, string> = {
      '{firstName}': lead.firstName || 'there',
      '{lastName}': lead.lastName || '',
      '{fullName}': [lead.firstName, lead.lastName].filter(Boolean).join(' ') || 'there',
      '{company}': lead.company || 'your company',
      '{jobTitle}': lead.jobTitle || 'your role',
      '{email}': lead.email,
      '{linkedinUrl}': lead.linkedinUrl || '',
    };

    let result = template;
    for (const [placeholder, value] of Object.entries(replacements)) {
      result = result.split(placeholder).join(value);
    }

    return result;
  }

  /**
   * Classify a reply using Claude AI to determine lead intent.
   */
  async classifyReply(replyText: string): Promise<ReplyClassification> {
    this.log.info('Classifying email reply');

    const systemPrompt = `You are an email reply classifier for a sales outreach system.
Classify the reply into exactly ONE of these categories:
- INTERESTED: The person shows interest, wants to learn more, or is open to a meeting/call
- NOT_INTERESTED: The person explicitly declines, says no, or asks to stop
- OOO: Out of office / vacation auto-reply
- UNSUBSCRIBE: Explicitly asks to be removed from the mailing list
- QUESTION: Asks a question about the product/service without clear interest or disinterest

Respond with ONLY the classification word, nothing else.`;

    try {
      const result = await generateCompletion(
        systemPrompt,
        `Classify this email reply:\n\n${replyText.slice(0, 2000)}`,
        50,
        { temperature: 0 },
      );

      const classification = result.trim().toUpperCase() as ReplyClassification;
      const validClasses: ReplyClassification[] = [
        'INTERESTED',
        'NOT_INTERESTED',
        'OOO',
        'UNSUBSCRIBE',
        'QUESTION',
      ];

      if (!validClasses.includes(classification)) {
        this.log.warn(
          { rawResult: result },
          'Unexpected classification result, defaulting to QUESTION',
        );
        return 'QUESTION';
      }

      this.log.info({ classification }, 'Reply classified');
      return classification;
    } catch (err) {
      this.log.error({ err }, 'Failed to classify reply, defaulting to QUESTION');
      return 'QUESTION';
    }
  }

  private async processLeadInSequence(
    lead: { id: string; email: string; firstName: string | null; lastName: string | null; company: string | null; jobTitle: string | null; linkedinUrl: string | null; currentStep: number },
    steps: { id: string; order: number; subject: string; body: string; delayHours: number; condition: string | null }[],
  ): Promise<boolean> {
    // Find the next step this lead should receive
    const nextStep = steps.find((s) => s.order === lead.currentStep + 1);

    if (!nextStep) {
      this.log.debug(
        { leadId: lead.id, currentStep: lead.currentStep },
        'Lead has completed all steps',
      );
      return false;
    }

    // Check if enough time has passed since the last step
    const lastEvent = await prisma.leadEvent.findFirst({
      where: {
        leadId: lead.id,
        type: 'EMAIL_SENT',
      },
      orderBy: { createdAt: 'desc' },
    });

    if (lastEvent) {
      const hoursSinceLastEmail =
        (Date.now() - lastEvent.createdAt.getTime()) / (1000 * 60 * 60);
      if (hoursSinceLastEmail < nextStep.delayHours) {
        this.log.debug(
          { leadId: lead.id, hoursSinceLastEmail, requiredDelay: nextStep.delayHours },
          'Not enough time has passed, skipping',
        );
        return false;
      }
    }

    // Check conditions
    if (nextStep.condition) {
      const conditionMet = this.evaluateCondition(nextStep.condition, { id: lead.id, status: String(lead.currentStep > 0 ? 'CONTACTED' : 'NEW') });
      if (!conditionMet) {
        this.log.debug(
          { leadId: lead.id, condition: nextStep.condition },
          'Step condition not met, skipping',
        );
        return false;
      }
    }

    // Personalize content
    const leadData: LeadData = {
      firstName: lead.firstName,
      lastName: lead.lastName,
      company: lead.company,
      jobTitle: lead.jobTitle,
      email: lead.email,
      linkedinUrl: lead.linkedinUrl,
    };

    const subject = this.personalizeContent(nextStep.subject, leadData);
    let html = this.personalizeContent(nextStep.body, leadData);

    // Add tracking
    html = this.tracker.wrapLinks(html, lead.id);
    html += this.tracker.generateTrackingPixel(lead.id, nextStep.id);

    // Send the email
    const { messageId } = await this.sender.sendEmail(
      lead.email,
      subject,
      html,
      html.replace(/<[^>]+>/g, ''), // Plain text version
    );

    // Record the send event
    await prisma.leadEvent.create({
      data: {
        leadId: lead.id,
        type: 'EMAIL_SENT',
        metadata: {
          emailStepId: nextStep.id,
          stepOrder: nextStep.order,
          messageId,
          sentAt: new Date().toISOString(),
        },
      },
    });

    // Update lead's status
    await prisma.lead.update({
      where: { id: lead.id },
      data: {
        status: lead.currentStep === 0 ? 'CONTACTED' : undefined,
      },
    });

    this.log.info(
      { leadId: lead.id, email: lead.email, stepOrder: nextStep.order, messageId },
      'Sequence email sent',
    );

    return true;
  }

  /**
   * Evaluate a step condition string against lead state.
   * Supported conditions:
   * - "opened": Lead has opened a previous email
   * - "clicked": Lead has clicked a link
   * - "not_opened": Lead has not opened
   * - "not_replied": Lead has not replied
   */
  private evaluateCondition(
    condition: string,
    lead: { id: string; status: string },
  ): boolean {
    const normalized = condition.toLowerCase().trim();

    switch (normalized) {
      case 'opened':
        return ['OPENED', 'CLICKED', 'REPLIED', 'INTERESTED'].includes(lead.status);
      case 'clicked':
        return ['CLICKED', 'REPLIED', 'INTERESTED'].includes(lead.status);
      case 'not_opened':
        return ['NEW', 'CONTACTED'].includes(lead.status);
      case 'not_replied':
        return !['REPLIED', 'INTERESTED', 'NOT_INTERESTED'].includes(lead.status);
      default:
        this.log.warn({ condition }, 'Unknown step condition, defaulting to true');
        return true;
    }
  }
}
