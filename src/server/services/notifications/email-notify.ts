/**
 * Email notification service using nodemailer.
 * Sends transactional emails for pipeline events, approvals, alerts, etc.
 */

import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { logger } from '@/lib/logger';

let transporterInstance: Transporter | null = null;

function getTransporter(): Transporter {
  if (!transporterInstance) {
    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!host || !user || !pass) {
      throw new Error('SMTP_HOST, SMTP_USER, and SMTP_PASS environment variables are required');
    }

    transporterInstance = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
  }
  return transporterInstance;
}

const DEFAULT_FROM = process.env.EMAIL_FROM || 'Launchpad <noreply@launchpad.app>';

export interface EmailOptions {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  from?: string;
  replyTo?: string;
}

/**
 * Send a single email.
 */
export async function sendEmail(options: EmailOptions): Promise<void> {
  const transporter = getTransporter();

  const info = await transporter.sendMail({
    from: options.from || DEFAULT_FROM,
    to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
    subject: options.subject,
    text: options.text,
    html: options.html,
    replyTo: options.replyTo,
  });

  logger.info({
    msg: 'Email sent',
    messageId: info.messageId,
    to: options.to,
    subject: options.subject,
  });
}

/**
 * Send a pipeline stage completion notification.
 */
export async function notifyPipelineStageComplete(params: {
  userEmail: string;
  projectName: string;
  stageName: string;
  nextStageName?: string;
  projectUrl: string;
}): Promise<void> {
  const subject = `[Launchpad] ${params.stageName} completed for "${params.projectName}"`;

  const text = [
    `Hi,`,
    ``,
    `The "${params.stageName}" stage has been completed for your project "${params.projectName}".`,
    params.nextStageName
      ? `Next up: ${params.nextStageName}.`
      : `All pipeline stages are now complete!`,
    ``,
    `View your project: ${params.projectUrl}`,
    ``,
    `-- Launchpad`,
  ].join('\n');

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1a1a1a;">Pipeline Update</h2>
      <p>The <strong>${params.stageName}</strong> stage has been completed for your project <strong>"${params.projectName}"</strong>.</p>
      ${params.nextStageName
        ? `<p>Next up: <strong>${params.nextStageName}</strong>.</p>`
        : `<p style="color: #16a34a; font-weight: bold;">All pipeline stages are now complete!</p>`
      }
      <p><a href="${params.projectUrl}" style="display: inline-block; padding: 10px 20px; background: #2563eb; color: white; text-decoration: none; border-radius: 6px;">View Project</a></p>
    </div>`;

  await sendEmail({ to: params.userEmail, subject, text, html });
}

/**
 * Send a content review request notification.
 */
export async function notifyContentReady(params: {
  userEmail: string;
  projectName: string;
  contentCount: number;
  reviewUrl: string;
}): Promise<void> {
  const subject = `[Launchpad] ${params.contentCount} content pieces ready for review`;

  const text = [
    `Hi,`,
    ``,
    `${params.contentCount} new content piece(s) have been generated for "${params.projectName}" and are ready for your review.`,
    ``,
    `Review content: ${params.reviewUrl}`,
    ``,
    `-- Launchpad`,
  ].join('\n');

  await sendEmail({ to: params.userEmail, subject, text });
}

/**
 * Send a pipeline error alert.
 */
export async function notifyPipelineError(params: {
  userEmail: string;
  projectName: string;
  stageName: string;
  errorMessage: string;
  projectUrl: string;
}): Promise<void> {
  const subject = `[Launchpad] Error in ${params.stageName} for "${params.projectName}"`;

  const text = [
    `Hi,`,
    ``,
    `An error occurred during the "${params.stageName}" stage for project "${params.projectName}":`,
    ``,
    `Error: ${params.errorMessage}`,
    ``,
    `View project: ${params.projectUrl}`,
    ``,
    `-- Launchpad`,
  ].join('\n');

  await sendEmail({ to: params.userEmail, subject, text });
}
