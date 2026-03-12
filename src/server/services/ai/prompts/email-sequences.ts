/**
 * Prompt template for cold email sequence generation.
 * Generates multi-step outreach sequences with personalization tokens.
 */

export interface EmailSequenceInput {
  projectName: string;
  vertical: string;
  productDescription: string;
  targetSegment: string;
  valueProposition: string;
  sequenceName: string;
  stepCount: number;
  cadence: string;
  tone: 'formal' | 'conversational' | 'casual';
  senderName: string;
  senderTitle: string;
  companyName: string;
  includeFollowUps: boolean;
  language?: string;
}

export interface GeneratedEmailStep {
  order: number;
  subject: string;
  body: string;
  delayHours: number;
  condition: string;
  purpose: string;
  personalizationTokens: string[];
}

export interface EmailSequenceResult {
  name: string;
  description: string;
  steps: GeneratedEmailStep[];
  tips: string[];
  expectedMetrics: {
    openRate: string;
    replyRate: string;
    meetingRate: string;
  };
}

export function buildEmailSequenceSystemPrompt(): string {
  return `You are an expert cold email copywriter specializing in B2B outreach. Generate high-converting email sequences that feel personal and avoid spam triggers.

Return a valid JSON object:

{
  "name": "Sequence name",
  "description": "Brief description of the sequence purpose",
  "steps": [
    {
      "order": 0,
      "subject": "Subject line (use {{firstName}} for personalization)",
      "body": "Full email body in plain text. Use personalization tokens: {{firstName}}, {{companyName}}, {{industry}}, {{painPoint}}, {{customOpener}}. Keep paragraphs short (2-3 sentences max).",
      "delayHours": 0,
      "condition": "none|opened_previous|not_opened|not_replied|clicked_link",
      "purpose": "Brief description of this email's goal",
      "personalizationTokens": ["firstName", "companyName"]
    }
  ],
  "tips": ["Deliverability and personalization tips"],
  "expectedMetrics": {
    "openRate": "40-50%",
    "replyRate": "5-10%",
    "meetingRate": "2-5%"
  }
}

Cold email best practices:
- Subject lines: 3-7 words, no spam words (free, guarantee, urgent), lowercase or sentence case
- First email: Short intro, specific value prop, low-friction CTA (question, not meeting request)
- Follow-ups: Reference previous email, add new value/angle, never guilt-trip
- Body: Under 150 words, no HTML formatting, 1 clear CTA, P.S. line for key info
- Personalization: Beyond just {{firstName}} - reference company, industry, recent events
- Spacing: First follow-up 2-3 days, subsequent 3-5 days apart
- Conditions: Vary follow-ups based on engagement (opened vs not opened)
- Sign-off: Conversational, not "Best regards" - use "Cheers", "Thanks", or sender's style`;
}

export function buildEmailSequenceUserPrompt(input: EmailSequenceInput): string {
  return `Generate a ${input.stepCount}-step cold email sequence:

SEQUENCE NAME: ${input.sequenceName}
PROJECT: ${input.projectName}
VERTICAL: ${input.vertical}

PRODUCT/SERVICE: ${input.productDescription}
VALUE PROPOSITION: ${input.valueProposition}
TARGET SEGMENT: ${input.targetSegment}

SENDER: ${input.senderName}, ${input.senderTitle} at ${input.companyName}
TONE: ${input.tone}
CADENCE: ${input.cadence}
LANGUAGE: ${input.language || 'English'}

${input.includeFollowUps ? 'Include conditional follow-ups based on open/click behavior.' : 'Use simple time-based delays between steps.'}

Requirements:
- Step 0 is the initial outreach (delayHours: 0)
- Each subsequent step should have appropriate delay based on the cadence
- Vary the angle and value proposition across steps - do not repeat the same pitch
- Include a breakup email as the final step
- Make every email feel personally written, not templated
- Subject lines should be curiosity-driven and A/B testable`;
}
