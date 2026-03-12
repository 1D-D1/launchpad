/**
 * Application-wide constants for the Launchpad platform.
 */

/**
 * Business verticals supported by the platform.
 */
export const VERTICALS = [
  { value: 'ECOMMERCE', label: 'E-Commerce', icon: 'ShoppingCart' },
  { value: 'SAAS', label: 'SaaS', icon: 'Cloud' },
  { value: 'AGENCY', label: 'Agency', icon: 'Briefcase' },
  { value: 'CONSULTING', label: 'Consulting', icon: 'Users' },
  { value: 'REAL_ESTATE', label: 'Real Estate', icon: 'Home' },
  { value: 'HEALTH', label: 'Health & Wellness', icon: 'Heart' },
  { value: 'EDUCATION', label: 'Education', icon: 'GraduationCap' },
  { value: 'FINANCE', label: 'Finance', icon: 'DollarSign' },
  { value: 'FOOD', label: 'Food & Beverage', icon: 'Utensils' },
  { value: 'TRAVEL', label: 'Travel & Tourism', icon: 'Plane' },
  { value: 'OTHER', label: 'Other', icon: 'MoreHorizontal' },
] as const;

export type VerticalValue = (typeof VERTICALS)[number]['value'];

/**
 * Social media and advertising platforms.
 */
export const PLATFORMS = [
  { value: 'FACEBOOK', label: 'Facebook', color: '#1877F2', icon: 'Facebook' },
  { value: 'INSTAGRAM', label: 'Instagram', color: '#E4405F', icon: 'Instagram' },
  { value: 'LINKEDIN', label: 'LinkedIn', color: '#0A66C2', icon: 'Linkedin' },
  { value: 'TWITTER', label: 'Twitter / X', color: '#000000', icon: 'Twitter' },
  { value: 'GOOGLE', label: 'Google Ads', color: '#4285F4', icon: 'Search' },
  { value: 'EMAIL', label: 'Email', color: '#6B7280', icon: 'Mail' },
] as const;

export type PlatformValue = (typeof PLATFORMS)[number]['value'];

/**
 * Project statuses with display labels and color badges.
 */
export const PROJECT_STATUSES = [
  { value: 'DRAFT', label: 'Draft', color: 'gray', bgClass: 'bg-gray-100 text-gray-700' },
  { value: 'SUBMITTED', label: 'Submitted', color: 'blue', bgClass: 'bg-blue-100 text-blue-700' },
  { value: 'ANALYZING', label: 'Analyzing', color: 'indigo', bgClass: 'bg-indigo-100 text-indigo-700' },
  { value: 'STRATEGIZING', label: 'Strategizing', color: 'violet', bgClass: 'bg-violet-100 text-violet-700' },
  { value: 'GENERATING_CONTENT', label: 'Generating Content', color: 'purple', bgClass: 'bg-purple-100 text-purple-700' },
  { value: 'PUBLISHING', label: 'Publishing', color: 'pink', bgClass: 'bg-pink-100 text-pink-700' },
  { value: 'RUNNING_ADS', label: 'Running Ads', color: 'orange', bgClass: 'bg-orange-100 text-orange-700' },
  { value: 'EMAILING', label: 'Emailing', color: 'amber', bgClass: 'bg-amber-100 text-amber-700' },
  { value: 'ACTIVE', label: 'Active', color: 'green', bgClass: 'bg-green-100 text-green-700' },
  { value: 'PAUSED', label: 'Paused', color: 'yellow', bgClass: 'bg-yellow-100 text-yellow-700' },
  { value: 'COMPLETED', label: 'Completed', color: 'emerald', bgClass: 'bg-emerald-100 text-emerald-700' },
] as const;

export type ProjectStatusValue = (typeof PROJECT_STATUSES)[number]['value'];

/**
 * Content types with labels.
 */
export const CONTENT_TYPES = [
  { value: 'SOCIAL_POST', label: 'Social Post' },
  { value: 'AD_COPY', label: 'Ad Copy' },
  { value: 'EMAIL', label: 'Email' },
  { value: 'LANDING_PAGE', label: 'Landing Page' },
  { value: 'BLOG_POST', label: 'Blog Post' },
] as const;

/**
 * Content statuses with labels and colors.
 */
export const CONTENT_STATUSES = [
  { value: 'DRAFT', label: 'Draft', color: 'gray', bgClass: 'bg-gray-100 text-gray-700' },
  { value: 'PENDING_REVIEW', label: 'Pending Review', color: 'yellow', bgClass: 'bg-yellow-100 text-yellow-700' },
  { value: 'APPROVED', label: 'Approved', color: 'green', bgClass: 'bg-green-100 text-green-700' },
  { value: 'SCHEDULED', label: 'Scheduled', color: 'blue', bgClass: 'bg-blue-100 text-blue-700' },
  { value: 'PUBLISHED', label: 'Published', color: 'emerald', bgClass: 'bg-emerald-100 text-emerald-700' },
  { value: 'FAILED', label: 'Failed', color: 'red', bgClass: 'bg-red-100 text-red-700' },
] as const;

/**
 * Campaign budget types.
 */
export const BUDGET_TYPES = [
  { value: 'DAILY', label: 'Daily Budget' },
  { value: 'LIFETIME', label: 'Lifetime Budget' },
] as const;

/**
 * User roles with hierarchy levels.
 */
export const ROLES = [
  { value: 'ADMIN', label: 'Administrator', level: 3 },
  { value: 'MANAGER', label: 'Manager', level: 2 },
  { value: 'VIEWER', label: 'Viewer', level: 1 },
] as const;

/**
 * Supported currencies.
 */
export const CURRENCIES = [
  { value: 'EUR', label: 'Euro', symbol: '\u20AC' },
  { value: 'USD', label: 'US Dollar', symbol: '$' },
  { value: 'GBP', label: 'British Pound', symbol: '\u00A3' },
] as const;

/**
 * Lead statuses for email sequences.
 */
export const LEAD_STATUSES = [
  { value: 'NEW', label: 'New' },
  { value: 'CONTACTED', label: 'Contacted' },
  { value: 'OPENED', label: 'Opened' },
  { value: 'CLICKED', label: 'Clicked' },
  { value: 'REPLIED', label: 'Replied' },
  { value: 'INTERESTED', label: 'Interested' },
  { value: 'NOT_INTERESTED', label: 'Not Interested' },
  { value: 'BOUNCED', label: 'Bounced' },
  { value: 'OPTED_OUT', label: 'Opted Out' },
] as const;

/**
 * Helper: look up a constant entry by value.
 */
export function findByValue<T extends readonly { value: string }[]>(
  collection: T,
  value: string,
): T[number] | undefined {
  return collection.find((item) => item.value === value);
}
