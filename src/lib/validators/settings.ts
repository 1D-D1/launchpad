/**
 * Zod validation schemas for application settings.
 */

import { z } from 'zod';

/**
 * User profile settings.
 */
export const profileSettingsSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name must be 100 characters or less'),
  email: z
    .string()
    .email('Invalid email address'),
  avatar: z
    .string()
    .url('Must be a valid URL')
    .optional()
    .or(z.literal('')),
  timezone: z
    .string()
    .min(1, 'Timezone is required'),
  language: z
    .enum(['fr', 'en', 'es', 'de', 'pt'])
    .default('fr'),
});

/**
 * Password change form.
 */
export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(128, 'Password must be 128 characters or less')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one digit')
      .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

/**
 * Notification preferences.
 */
export const notificationSettingsSchema = z.object({
  emailNotifications: z.boolean().default(true),
  pipelineUpdates: z.boolean().default(true),
  contentReady: z.boolean().default(true),
  campaignAlerts: z.boolean().default(true),
  weeklyReport: z.boolean().default(false),
  marketingEmails: z.boolean().default(false),
});

/**
 * Webhook configuration.
 */
export const webhookSettingsSchema = z.object({
  url: z
    .string()
    .url('Must be a valid URL')
    .startsWith('https://', 'Webhook URL must use HTTPS'),
  secret: z
    .string()
    .min(16, 'Secret must be at least 16 characters')
    .max(256)
    .optional(),
  events: z
    .array(
      z.enum([
        'project.created',
        'project.submitted',
        'pipeline.stage_completed',
        'pipeline.error',
        'content.generated',
        'content.approved',
        'campaign.launched',
        'campaign.paused',
        'email_sequence.started',
        'payment.received',
        'payment.failed',
      ]),
    )
    .min(1, 'Select at least one event'),
  enabled: z.boolean().default(true),
});

/**
 * API key management.
 */
export const apiKeySettingsSchema = z.object({
  anthropicApiKey: z
    .string()
    .min(1, 'API key is required')
    .startsWith('sk-', 'Invalid Anthropic API key format'),
  stripeSecretKey: z
    .string()
    .startsWith('sk_', 'Invalid Stripe key format')
    .optional()
    .or(z.literal('')),
  metaAccessToken: z
    .string()
    .min(1)
    .optional()
    .or(z.literal('')),
  googleAdsToken: z
    .string()
    .min(1)
    .optional()
    .or(z.literal('')),
});

/**
 * SMTP / email configuration.
 */
export const smtpSettingsSchema = z.object({
  host: z.string().min(1, 'SMTP host is required'),
  port: z.number().int().min(1).max(65535).default(587),
  user: z.string().min(1, 'SMTP user is required'),
  pass: z.string().min(1, 'SMTP password is required'),
  fromName: z.string().min(1).max(100).default('Launchpad'),
  fromEmail: z.string().email('Invalid from email'),
  secure: z.boolean().default(false),
});

/**
 * Combined settings update (partial - all sections optional).
 */
export const settingsUpdateSchema = z.object({
  profile: profileSettingsSchema.partial().optional(),
  notifications: notificationSettingsSchema.partial().optional(),
  webhooks: z.array(webhookSettingsSchema).optional(),
  apiKeys: apiKeySettingsSchema.partial().optional(),
  smtp: smtpSettingsSchema.partial().optional(),
});

/** Inferred types */
export type ProfileSettings = z.infer<typeof profileSettingsSchema>;
export type PasswordChange = z.infer<typeof passwordChangeSchema>;
export type NotificationSettings = z.infer<typeof notificationSettingsSchema>;
export type WebhookSettings = z.infer<typeof webhookSettingsSchema>;
export type ApiKeySettings = z.infer<typeof apiKeySettingsSchema>;
export type SmtpSettings = z.infer<typeof smtpSettingsSchema>;
export type SettingsUpdate = z.infer<typeof settingsUpdateSchema>;
