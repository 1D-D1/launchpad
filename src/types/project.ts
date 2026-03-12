/**
 * Project-related types matching the Prisma schema and form wizard steps.
 */

export type ProjectStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'ANALYZING'
  | 'STRATEGIZING'
  | 'GENERATING_CONTENT'
  | 'PUBLISHING'
  | 'RUNNING_ADS'
  | 'EMAILING'
  | 'ACTIVE'
  | 'PAUSED'
  | 'COMPLETED';

export type Vertical =
  | 'ECOMMERCE'
  | 'SAAS'
  | 'AGENCY'
  | 'CONSULTING'
  | 'REAL_ESTATE'
  | 'HEALTH'
  | 'EDUCATION'
  | 'FINANCE'
  | 'FOOD'
  | 'TRAVEL'
  | 'OTHER';

export interface TargetAudience {
  demographics: string;
  interests: string[];
  location: string;
  ageRange: string;
}

export interface Budget {
  total: number;
  currency: string;
  allocation?: Record<string, number>;
}

export interface Objectives {
  primary: string;
  secondary: string[];
  kpis: string[];
}

export interface Competitor {
  name: string;
  url?: string;
}

/** Step 1: Basic info */
export interface ProjectStepBasicInfo {
  name: string;
  description: string;
  vertical: Vertical | string;
}

/** Step 2: Target audience */
export interface ProjectStepAudience {
  targetAudience: TargetAudience;
}

/** Step 3: Budget & objectives */
export interface ProjectStepBudget {
  budget: Budget;
  objectives: Objectives;
}

/** Step 4: Competitors */
export interface ProjectStepCompetitors {
  competitors: Competitor[];
}

/** Union of all wizard steps */
export type ProjectStep =
  | { step: 1; data: ProjectStepBasicInfo }
  | { step: 2; data: ProjectStepAudience }
  | { step: 3; data: ProjectStepBudget }
  | { step: 4; data: ProjectStepCompetitors };

/** Full form data combining all steps */
export interface ProjectFormData
  extends ProjectStepBasicInfo,
    ProjectStepAudience,
    ProjectStepBudget,
    ProjectStepCompetitors {}

/** Project as returned from the API with relational counts */
export interface ProjectWithCounts {
  id: string;
  name: string;
  description: string;
  vertical: string;
  status: ProjectStatus;
  targetAudience: TargetAudience | null;
  budget: Budget | null;
  objectives: Objectives | null;
  competitors: Competitor[] | null;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  _count: {
    contents: number;
    campaigns: number;
    emailSequences: number;
  };
}
