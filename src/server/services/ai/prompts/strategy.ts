/**
 * Prompt template for Sprint 4: Marketing Strategy Generation.
 * Takes competitive analysis results and project data to produce
 * a comprehensive go-to-market strategy.
 */

import type { CompetitiveAnalysisResult } from './competitive-analysis';

export interface StrategyInput {
  projectName: string;
  vertical: string;
  description: string;
  budget: {
    total: number;
    currency: string;
    allocation?: Record<string, number>;
  };
  objectives: {
    primary: string;
    secondary?: string[];
    kpis?: string[];
  };
  targetAudience: {
    demographics?: string;
    interests?: string[];
    location?: string;
    ageRange?: string;
  };
  competitiveAnalysis: CompetitiveAnalysisResult;
}

export interface StrategyResult {
  overview: {
    vision: string;
    mission: string;
    keyMessage: string;
    tone: string;
  };
  channels: ChannelStrategy[];
  contentPlan: {
    themes: string[];
    contentMix: ContentMixItem[];
    postingSchedule: PostingScheduleItem[];
    calendarWeeks: CalendarWeek[];
  };
  adStrategy: {
    platforms: AdPlatformStrategy[];
    totalBudgetAllocation: Record<string, number>;
    targetCPA: number;
    targetROAS: number;
  };
  emailStrategy: {
    sequences: EmailSequenceStrategy[];
    warmUpPlan: string;
    personalizationApproach: string;
  };
  kpis: KPITarget[];
  timeline: TimelinePhase[];
}

export interface ChannelStrategy {
  channel: string;
  priority: 'high' | 'medium' | 'low';
  rationale: string;
  budgetPercent: number;
  expectedOutcome: string;
}

export interface ContentMixItem {
  type: string;
  percentage: number;
  description: string;
}

export interface PostingScheduleItem {
  platform: string;
  frequency: string;
  bestTimes: string[];
  contentTypes: string[];
}

export interface CalendarWeek {
  week: number;
  theme: string;
  posts: { day: string; platform: string; type: string; topic: string }[];
}

export interface AdPlatformStrategy {
  platform: string;
  objective: string;
  budgetPercent: number;
  targeting: string;
  creativeApproach: string;
  funnelStage: string;
}

export interface EmailSequenceStrategy {
  name: string;
  goal: string;
  stepCount: number;
  cadence: string;
  targetSegment: string;
}

export interface KPITarget {
  metric: string;
  target: string;
  timeframe: string;
  measurement: string;
}

export interface TimelinePhase {
  phase: string;
  duration: string;
  milestones: string[];
  keyActions: string[];
}

export function buildStrategySystemPrompt(): string {
  return `You are an expert digital marketing strategist. Based on the competitive analysis and project details provided, generate a comprehensive marketing strategy.

Return a valid JSON object with this structure:

{
  "overview": {
    "vision": "High-level marketing vision",
    "mission": "Specific marketing mission statement",
    "keyMessage": "Core brand message",
    "tone": "Brand voice and tone description"
  },
  "channels": [
    {
      "channel": "Platform name",
      "priority": "high|medium|low",
      "rationale": "Why this channel",
      "budgetPercent": 25,
      "expectedOutcome": "Expected results"
    }
  ],
  "contentPlan": {
    "themes": ["theme1", "theme2"],
    "contentMix": [
      { "type": "educational", "percentage": 40, "description": "..." }
    ],
    "postingSchedule": [
      {
        "platform": "Instagram",
        "frequency": "5x/week",
        "bestTimes": ["9:00 AM", "6:00 PM"],
        "contentTypes": ["carousel", "reels", "stories"]
      }
    ],
    "calendarWeeks": [
      {
        "week": 1,
        "theme": "Brand Introduction",
        "posts": [
          { "day": "Monday", "platform": "Instagram", "type": "carousel", "topic": "..." }
        ]
      }
    ]
  },
  "adStrategy": {
    "platforms": [
      {
        "platform": "Meta",
        "objective": "Lead generation",
        "budgetPercent": 60,
        "targeting": "Description of targeting",
        "creativeApproach": "Creative direction",
        "funnelStage": "Top of funnel"
      }
    ],
    "totalBudgetAllocation": { "Meta": 60, "Google": 40 },
    "targetCPA": 15.00,
    "targetROAS": 3.5
  },
  "emailStrategy": {
    "sequences": [
      {
        "name": "Welcome Sequence",
        "goal": "Onboard new leads",
        "stepCount": 5,
        "cadence": "Every 2 days",
        "targetSegment": "New subscribers"
      }
    ],
    "warmUpPlan": "Domain warming strategy",
    "personalizationApproach": "How emails will be personalized"
  },
  "kpis": [
    {
      "metric": "Monthly website traffic",
      "target": "10,000 visitors",
      "timeframe": "3 months",
      "measurement": "Google Analytics"
    }
  ],
  "timeline": [
    {
      "phase": "Launch",
      "duration": "Weeks 1-2",
      "milestones": ["milestone1"],
      "keyActions": ["action1"]
    }
  ]
}

Make all recommendations specific, actionable, and tailored to the budget. Allocate budget percentages that sum to 100 where applicable. Provide at least 4 weeks of content calendar. Set realistic KPI targets.`;
}

export function buildStrategyUserPrompt(input: StrategyInput): string {
  const analysis = input.competitiveAnalysis;

  return `Generate a comprehensive marketing strategy for:

PROJECT: ${input.projectName}
VERTICAL: ${input.vertical}
DESCRIPTION: ${input.description}

BUDGET: ${input.budget.total} ${input.budget.currency}
${input.budget.allocation ? `PRE-ALLOCATED: ${JSON.stringify(input.budget.allocation)}` : ''}

PRIMARY OBJECTIVE: ${input.objectives.primary}
${input.objectives.secondary?.length ? `SECONDARY: ${input.objectives.secondary.join(', ')}` : ''}
${input.objectives.kpis?.length ? `KPIs TO TRACK: ${input.objectives.kpis.join(', ')}` : ''}

TARGET AUDIENCE:
- Demographics: ${input.targetAudience.demographics || 'General'}
- Interests: ${input.targetAudience.interests?.join(', ') || 'Not specified'}
- Location: ${input.targetAudience.location || 'Not specified'}
- Age: ${input.targetAudience.ageRange || 'Not specified'}

COMPETITIVE ANALYSIS SUMMARY:
${analysis.summary}

MARKET POSITIONING:
- Current: ${analysis.positioning.currentState}
- Recommended: ${analysis.positioning.recommendedPosition}
- UVP: ${analysis.positioning.uniqueValueProposition}

TOP COMPETITORS:
${analysis.competitors.map((c) => `- ${c.name}: ${c.keyDifferentiators.join(', ')}`).join('\n')}

SWOT:
- Strengths: ${analysis.swot.strengths.join(', ')}
- Weaknesses: ${analysis.swot.weaknesses.join(', ')}
- Opportunities: ${analysis.swot.opportunities.join(', ')}
- Threats: ${analysis.swot.threats.join(', ')}

Build a strategy that leverages the identified opportunities, addresses weaknesses, and positions the brand according to the recommended positioning. Ensure budget allocations are realistic for the total budget provided.`;
}
