/**
 * Pipeline types for the project processing workflow.
 */

export type PipelineStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'SKIPPED';

export interface PipelineStage {
  id: string;
  key: PipelineStageKey;
  label: string;
  description: string;
  order: number;
  status: PipelineStatus;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  metadata?: Record<string, unknown>;
}

export type PipelineStageKey =
  | 'ANALYSIS'
  | 'STRATEGY'
  | 'CONTENT_GENERATION'
  | 'CONTENT_REVIEW'
  | 'AD_CAMPAIGN_SETUP'
  | 'EMAIL_SEQUENCE_SETUP'
  | 'PUBLISHING'
  | 'MONITORING';

export interface PipelineStageDefinition {
  key: PipelineStageKey;
  label: string;
  description: string;
  order: number;
}

/**
 * Ordered list of all pipeline stages.
 * This is the single source of truth for stage ordering and display.
 */
export const PIPELINE_STAGES: readonly PipelineStageDefinition[] = [
  {
    key: 'ANALYSIS',
    label: 'Competitive Analysis',
    description: 'AI analyzes competitors, market positioning, and opportunities',
    order: 1,
  },
  {
    key: 'STRATEGY',
    label: 'Strategy Generation',
    description: 'AI generates a comprehensive marketing strategy based on analysis',
    order: 2,
  },
  {
    key: 'CONTENT_GENERATION',
    label: 'Content Generation',
    description: 'AI creates social media posts, ad copy, emails, and landing pages',
    order: 3,
  },
  {
    key: 'CONTENT_REVIEW',
    label: 'Content Review',
    description: 'User reviews and approves generated content before publishing',
    order: 4,
  },
  {
    key: 'AD_CAMPAIGN_SETUP',
    label: 'Ad Campaign Setup',
    description: 'Configure and launch Meta and Google ad campaigns',
    order: 5,
  },
  {
    key: 'EMAIL_SEQUENCE_SETUP',
    label: 'Email Sequence Setup',
    description: 'Set up cold email outreach sequences with personalization',
    order: 6,
  },
  {
    key: 'PUBLISHING',
    label: 'Publishing',
    description: 'Publish approved content to selected social media platforms',
    order: 7,
  },
  {
    key: 'MONITORING',
    label: 'Monitoring & Optimization',
    description: 'Track performance metrics and auto-optimize campaigns',
    order: 8,
  },
] as const;

/** Map from stage key to its definition for O(1) lookups */
export const PIPELINE_STAGE_MAP: ReadonlyMap<PipelineStageKey, PipelineStageDefinition> =
  new Map(PIPELINE_STAGES.map((stage) => [stage.key, stage]));

/** Get the next stage key given a current stage, or undefined if at the end */
export function getNextStage(current: PipelineStageKey): PipelineStageKey | undefined {
  const currentDef = PIPELINE_STAGE_MAP.get(current);
  if (!currentDef) return undefined;
  const next = PIPELINE_STAGES.find((s) => s.order === currentDef.order + 1);
  return next?.key;
}
