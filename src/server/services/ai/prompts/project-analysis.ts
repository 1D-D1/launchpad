/**
 * Prompt template for AI Project Analysis.
 * Ingests all project data and produces comprehensive actionable insights
 * including business model assessment, pricing analysis, ICP validation,
 * channel strategy, and a Claude Code revision prompt.
 */

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface ProjectAnalysisInput {
  project: {
    name: string;
    description: string;
    vertical: string;
    status: string;
  };
  targetAudience: {
    demographics?: string;
    interests?: string[];
    location?: string;
    ageRange?: string;
  };
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
  competitors: {
    name: string;
    url?: string;
    strengths?: string[];
    weaknesses?: string[];
    score?: number;
  }[];
  strategy?: {
    positioning?: string;
    channels?: unknown;
    personas?: unknown;
    valueProps?: unknown;
  };
  contentMetrics: {
    totalContent: number;
    byType: Record<string, number>;
    byStatus: Record<string, number>;
  };
  adMetrics: {
    totalCampaigns: number;
    activeCampaigns: number;
    totalBudget: number;
    impressions: number;
    clicks: number;
    conversions: number;
    spend: number;
    ctr: number;
  };
  emailMetrics: {
    totalSequences: number;
    totalLeads: number;
  };
  revenue: number;
}

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

export interface ProjectAnalysis {
  businessModel: {
    assessment: string;
    strengths: string[];
    weaknesses: string[];
    recommendations: string[];
  };
  targetClient: {
    currentProfile: string;
    validationScore: number;
    refinements: string[];
    idealClientDescription: string;
  };
  pricing: {
    currentPricing: string;
    competitorPricing: string[];
    recommendation: string;
    suggestedTiers: { name: string; price: string; features: string[] }[];
  };
  channelStrategy: {
    bestChannels: string[];
    underperforming: string[];
    budgetReallocation: {
      channel: string;
      currentPct: number;
      suggestedPct: number;
      reason: string;
    }[];
  };
  contentStrategy: {
    topPerformingTypes: string[];
    improvementAreas: string[];
    contentGaps: string[];
  };
  growthProjection: {
    month1: string;
    month3: string;
    month6: string;
    assumptions: string[];
  };
  riskFactors: { risk: string; impact: string; mitigation: string }[];
  actionItems: {
    priority: number;
    action: string;
    expectedImpact: string;
    effort: string;
  }[];
  claudeCodeRevisionPrompt: string;
}

export interface PricingAnalysis {
  currentPricing: string;
  competitorPricingRange: string;
  valuePropositionAlignment: number;
  suggestedTiers: {
    name: string;
    price: string;
    features: string[];
    targetSegment: string;
    estimatedConversionRate: string;
  }[];
  freeTrialRecommendation: string;
  discountStrategy: string;
  recommendations: string[];
}

export interface IdealClientProfile {
  summary: string;
  demographics: {
    age: string;
    gender: string;
    location: string;
    income: string;
    education: string;
    jobTitle: string;
    companySize: string;
    industry: string;
  };
  psychographics: {
    values: string[];
    lifestyle: string;
    personality: string;
    attitudes: string[];
  };
  behaviors: {
    buyingHabits: string[];
    mediaConsumption: string[];
    onlineBehavior: string[];
    decisionMakingProcess: string;
  };
  painPoints: string[];
  buyingTriggers: string[];
  commonObjections: string[];
  whereToFindThem: {
    onlineChannels: string[];
    communities: string[];
    events: string[];
    publications: string[];
  };
  messagingAngles: string[];
}

// ---------------------------------------------------------------------------
// Prompt builders
// ---------------------------------------------------------------------------

export function buildProjectAnalysisSystemPrompt(): string {
  return `You are an expert business strategist and marketing consultant. You will analyze a project's complete data and provide comprehensive, actionable insights.

Your analysis must be data-driven, specific, and immediately actionable. Avoid generic advice. Every recommendation should be tied to the actual project data provided.

Return a valid JSON object with this exact structure:

{
  "businessModel": {
    "assessment": "Detailed assessment of the business model viability",
    "strengths": ["Specific strength 1", "Specific strength 2"],
    "weaknesses": ["Specific weakness 1", "Specific weakness 2"],
    "recommendations": ["Actionable recommendation 1", "Actionable recommendation 2"]
  },
  "targetClient": {
    "currentProfile": "Summary of current target client based on data",
    "validationScore": 75,
    "refinements": ["Refinement suggestion 1", "Refinement suggestion 2"],
    "idealClientDescription": "Detailed ideal client description"
  },
  "pricing": {
    "currentPricing": "Assessment of current pricing approach",
    "competitorPricing": ["Competitor A: $X/mo", "Competitor B: $Y/mo"],
    "recommendation": "Specific pricing recommendation",
    "suggestedTiers": [
      {"name": "Tier Name", "price": "$XX/mo", "features": ["Feature 1", "Feature 2"]}
    ]
  },
  "channelStrategy": {
    "bestChannels": ["Channel 1", "Channel 2"],
    "underperforming": ["Channel X"],
    "budgetReallocation": [
      {"channel": "Channel", "currentPct": 40, "suggestedPct": 60, "reason": "Reason for change"}
    ]
  },
  "contentStrategy": {
    "topPerformingTypes": ["Type 1", "Type 2"],
    "improvementAreas": ["Area 1"],
    "contentGaps": ["Gap 1", "Gap 2"]
  },
  "growthProjection": {
    "month1": "Realistic projection for month 1",
    "month3": "Realistic projection for month 3",
    "month6": "Realistic projection for month 6",
    "assumptions": ["Assumption 1", "Assumption 2"]
  },
  "riskFactors": [
    {"risk": "Risk description", "impact": "HIGH/MEDIUM/LOW", "mitigation": "Mitigation strategy"}
  ],
  "actionItems": [
    {"priority": 1, "action": "Specific action", "expectedImpact": "Expected result", "effort": "LOW/MEDIUM/HIGH"}
  ],
  "claudeCodeRevisionPrompt": "A complete, detailed prompt that can be used with Claude Code to revise and improve this project. Include specific instructions for what to change in strategy, content, ads, pricing, and targeting."
}

IMPORTANT RULES:
- validationScore must be 0-100
- riskFactors impact must be HIGH, MEDIUM, or LOW
- actionItems should be sorted by priority (1 = highest)
- actionItems effort must be LOW, MEDIUM, or HIGH
- claudeCodeRevisionPrompt must be a complete, self-contained prompt
- All percentages in budgetReallocation should sum to approximately 100
- Be specific: reference actual numbers, platforms, and competitor names from the data`;
}

export function buildProjectAnalysisUserPrompt(input: ProjectAnalysisInput): string {
  const competitorSection = input.competitors.length > 0
    ? input.competitors
        .map(
          (c) =>
            `  - ${c.name}${c.url ? ` (${c.url})` : ''}${c.score ? ` [Score: ${c.score}]` : ''}` +
            (c.strengths?.length ? `\n    Strengths: ${c.strengths.join(', ')}` : '') +
            (c.weaknesses?.length ? `\n    Weaknesses: ${c.weaknesses.join(', ')}` : ''),
        )
        .join('\n')
    : '  No competitor data available';

  const budgetAllocation = input.budget.allocation
    ? Object.entries(input.budget.allocation)
        .map(([channel, pct]) => `  ${channel}: ${pct}%`)
        .join('\n')
    : '  Not yet allocated';

  return `Analyze this project and provide comprehensive insights:

PROJECT: ${input.project.name}
VERTICAL: ${input.project.vertical}
STATUS: ${input.project.status}
DESCRIPTION: ${input.project.description}

TARGET AUDIENCE:
  Demographics: ${input.targetAudience.demographics ?? 'Not specified'}
  Interests: ${input.targetAudience.interests?.join(', ') ?? 'Not specified'}
  Location: ${input.targetAudience.location ?? 'Not specified'}
  Age Range: ${input.targetAudience.ageRange ?? 'Not specified'}

BUDGET:
  Total: ${input.budget.total} ${input.budget.currency}
  Allocation:
${budgetAllocation}

OBJECTIVES:
  Primary: ${input.objectives.primary}
  Secondary: ${input.objectives.secondary?.join(', ') ?? 'None'}
  KPIs: ${input.objectives.kpis?.join(', ') ?? 'None'}

COMPETITORS:
${competitorSection}

STRATEGY:
  Positioning: ${input.strategy?.positioning ?? 'Not defined'}
  Channels: ${input.strategy?.channels ? JSON.stringify(input.strategy.channels) : 'Not defined'}
  Personas: ${input.strategy?.personas ? JSON.stringify(input.strategy.personas) : 'Not defined'}

CONTENT PERFORMANCE:
  Total Content Pieces: ${input.contentMetrics.totalContent}
  By Type: ${JSON.stringify(input.contentMetrics.byType)}
  By Status: ${JSON.stringify(input.contentMetrics.byStatus)}

AD PERFORMANCE:
  Total Campaigns: ${input.adMetrics.totalCampaigns}
  Active Campaigns: ${input.adMetrics.activeCampaigns}
  Total Ad Budget: ${input.adMetrics.totalBudget} ${input.budget.currency}
  Impressions: ${input.adMetrics.impressions.toLocaleString()}
  Clicks: ${input.adMetrics.clicks.toLocaleString()}
  Conversions: ${input.adMetrics.conversions}
  Total Spend: ${input.adMetrics.spend} ${input.budget.currency}
  CTR: ${input.adMetrics.ctr.toFixed(2)}%

EMAIL PERFORMANCE:
  Total Sequences: ${input.emailMetrics.totalSequences}
  Total Leads: ${input.emailMetrics.totalLeads}

REVENUE: ${input.revenue} ${input.budget.currency}

Based on ALL the data above, provide a thorough analysis. Be specific and reference actual numbers. The claudeCodeRevisionPrompt should be detailed enough to improve this project significantly.`;
}

export function buildPricingAnalysisSystemPrompt(): string {
  return `You are a pricing strategy expert. Analyze the project data and competitor information to provide specific pricing recommendations.

Return a valid JSON object with this structure:

{
  "currentPricing": "Assessment of current pricing approach based on budget and revenue data",
  "competitorPricingRange": "Price range observed across competitors",
  "valuePropositionAlignment": 75,
  "suggestedTiers": [
    {
      "name": "Tier name",
      "price": "$XX/mo",
      "features": ["Feature 1", "Feature 2"],
      "targetSegment": "Who this tier is for",
      "estimatedConversionRate": "X%"
    }
  ],
  "freeTrialRecommendation": "Whether to offer a free trial and how",
  "discountStrategy": "Recommended discount approach",
  "recommendations": ["Specific recommendation 1", "Specific recommendation 2"]
}

valuePropositionAlignment must be 0-100. Provide 2-4 pricing tiers. Be specific about prices.`;
}

export function buildIdealClientSystemPrompt(): string {
  return `You are a customer research expert. Based on the project data, competitive landscape, and performance metrics, generate a detailed Ideal Client Profile (ICP).

Return a valid JSON object with this structure:

{
  "summary": "One-paragraph summary of the ideal client",
  "demographics": {
    "age": "Age range",
    "gender": "Gender distribution",
    "location": "Primary locations",
    "income": "Income range",
    "education": "Education level",
    "jobTitle": "Typical job titles",
    "companySize": "Company size range",
    "industry": "Target industries"
  },
  "psychographics": {
    "values": ["Value 1", "Value 2"],
    "lifestyle": "Lifestyle description",
    "personality": "Personality traits",
    "attitudes": ["Attitude 1", "Attitude 2"]
  },
  "behaviors": {
    "buyingHabits": ["Habit 1", "Habit 2"],
    "mediaConsumption": ["Channel 1", "Channel 2"],
    "onlineBehavior": ["Behavior 1"],
    "decisionMakingProcess": "How they make purchasing decisions"
  },
  "painPoints": ["Pain point 1", "Pain point 2"],
  "buyingTriggers": ["Trigger 1", "Trigger 2"],
  "commonObjections": ["Objection 1", "Objection 2"],
  "whereToFindThem": {
    "onlineChannels": ["Channel 1"],
    "communities": ["Community 1"],
    "events": ["Event type 1"],
    "publications": ["Publication 1"]
  },
  "messagingAngles": ["Angle 1", "Angle 2"]
}

Be specific and actionable. Tie recommendations to the actual project data provided.`;
}
