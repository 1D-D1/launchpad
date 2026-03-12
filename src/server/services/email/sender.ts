/**
 * Email sender service for outreach campaigns.
 * Uses nodemailer with SMTP configuration from environment variables.
 */

import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { logger } from '@/lib/logger';

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  headers?: Record<string, string>;
}

export interface BulkResult {
  total: number;
  sent: number;
  failed: number;
  errors: { email: string; error: string }[];
}

const BULK_DELAY_MS = 2000; // 2 seconds between bulk emails

export class EmailSender {
  private transporter: Transporter | null = null;
  private readonly fromAddress: string;
  private readonly log = logger.child({ service: 'EmailSender' });

  constructor() {
    this.fromAddress = process.env.OUTREACH_FROM_EMAIL || process.env.EMAIL_FROM || '';
  }

  /**
   * Send a single email via SMTP.
   */
  async sendEmail(
    to: string,
    subject: string,
    html: string,
    text: string,
  ): Promise<{ messageId: string }> {
    this.log.info({ to, subject }, 'Sending email');

    const transporter = this.getTransporter();

    const info = await transporter.sendMail({
      from: this.fromAddress,
      to,
      subject,
      html,
      text,
      headers: {
        'X-Mailer': 'Launchpad',
      },
    });

    this.log.info(
      { messageId: info.messageId, to, subject },
      'Email sent successfully',
    );

    return { messageId: info.messageId };
  }

  /**
   * Send multiple emails with a delay between each to avoid spam filters.
   */
  async sendBulk(emails: EmailPayload[]): Promise<BulkResult> {
    this.log.info({ count: emails.length }, 'Starting bulk email send');

    const result: BulkResult = {
      total: emails.length,
      sent: 0,
      failed: 0,
      errors: [],
    };

    for (let i = 0; i < emails.length; i++) {
      const email = emails[i];

      try {
        const transporter = this.getTransporter();

        await transporter.sendMail({
          from: this.fromAddress,
          to: email.to,
          subject: email.subject,
          html: email.html,
          text: email.text,
          replyTo: email.replyTo,
          headers: email.headers,
        });

        result.sent++;
        this.log.debug(
          { to: email.to, progress: `${i + 1}/${emails.length}` },
          'Bulk email sent',
        );
      } catch (err) {
        result.failed++;
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        result.errors.push({ email: email.to, error: errorMessage });
        this.log.error(
          { err, to: email.to },
          'Failed to send bulk email',
        );
      }

      // Delay between emails (except after the last one)
      if (i < emails.length - 1) {
        await this.delay(BULK_DELAY_MS);
      }
    }

    this.log.info(
      { total: result.total, sent: result.sent, failed: result.failed },
      'Bulk email send complete',
    );

    return result;
  }

  private getTransporter(): Transporter {
    if (!this.transporter) {
      const host = process.env.SMTP_HOST;
      const port = parseInt(process.env.SMTP_PORT || '587', 10);
      const user = process.env.SMTP_USER;
      const pass = process.env.SMTP_PASS;

      if (!host || !user || !pass) {
        throw new Error(
          'SMTP configuration is incomplete. Set SMTP_HOST, SMTP_USER, and SMTP_PASS.',
        );
      }

      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
        pool: true,
        maxConnections: 5,
        maxMessages: 100,
      });
    }

    return this.transporter;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
