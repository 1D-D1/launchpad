/**
 * Prompt template for Sprint 3: Competitive Analysis.
 * Produces a structured analysis of competitors, market positioning, and opportunities.
 */

import type { Competitor } from '@/types/project';

export interface CompetitiveAnalysisInput {
  projectName: string;
  vertical: string;
  description: string;
  competitors: Competitor[];
  targetAudience: {
    demographics?: string;
    interests?: string[];
    location?: string;
    ageRange?: string;
  };
  objectives: {
    primary: string;
    secondary?: string[];
  };
}

export interface CompetitiveAnalysisResult {
  summary: string;
  marketOverview: {
    size: string;
    trends: string[];
    opportunities: string[];
    threats: string[];
  };
  competitors: CompetitorAnalysis[];
  positioning: {
    currentState: string;
    recommendedPosition: string;
    uniqueValueProposition: string;
    differentiators: string[];
  };
  swot: {
    strengths: string[];
    weaknesses: string[];
    opportunities: string[];
    threats: string[];
  };
  recommendations: {
    immediate: string[];
    shortTerm: string[];
    longTerm: string[];
  };
}

export interface CompetitorAnalysis {
  name: string;
  url?: string;
  strengths: string[];
  weaknesses: string[];
  estimatedMarketShare: string;
  contentStrategy: string;
  adPresence: string;
  socialMediaPresence: {
    platforms: string[];
    engagementLevel: string;
    postingFrequency: string;
  };
  pricingStrategy: string;
  keyDifferentiators: string[];
}

export function buildCompetitiveAnalysisSystemPrompt(): string {
  return `You are an expert marketing strategist and competitive intelligence analyst. Your task is to produce a thorough competitive analysis based on the project details provided.

You must return a valid JSON object matching this exact structure:

{
  "summary": "Executive summary of findings (2-3 sentences)",
  "marketOverview": {
    "size": "Estimated market size and context",
    "trends": ["trend1", "trend2", ...],
    "opportunities": ["opp1", "opp2", ...],
    "threats": ["threat1", "threat2", ...]
  },
  "competitors": [
    {
      "name": "Competitor Name",
      "url": "https://...",
      "strengths": ["str1", "str2"],
      "weaknesses": ["weak1", "weak2"],
      "estimatedMarketShare": "X% or qualitative estimate",
      "contentStrategy": "Description of their content approach",
      "adPresence": "Description of their advertising activity",
      "socialMediaPresence": {
        "platforms": ["Facebook", "Instagram"],
        "engagementLevel": "High/Medium/Low",
        "postingFrequency": "Daily/Weekly/etc."
      },
      "pricingStrategy": "Description of pricing approach",
      "keyDifferentiators": ["diff1", "diff2"]
    }
  ],
  "positioning": {
    "currentState": "Assessment of current market position",
    "recommendedPosition": "Where the brand should position itself",
    "uniqueValueProposition": "Clear UVP statement",
    "differentiators": ["diff1", "diff2"]
  },
  "swot": {
    "strengths": [],
    "weaknesses": [],
    "opportunities": [],
    "threats": []
  },
  "recommendations": {
    "immediate": ["Actions for next 1-2 weeks"],
    "shortTerm": ["Actions for next 1-3 months"],
    "longTerm": ["Actions for 3-12 months"]
  }
}

Be specific and actionable. Base your analysis on typical patterns for the given vertical and competitors. Provide realistic assessments rather than generic advice.`;
}

export function buildCompetitiveAnalysisUserPrompt(input: CompetitiveAnalysisInput): string {
  const competitorList = input.competitors
    .map((c) => `- ${c.name}${c.url ? ` (${c.url})` : ''}`)
    .join('\n');

  const audienceDetails = [
    input.targetAudience.demographics && `Demographics: ${input.targetAudience.demographics}`,
    input.targetAudience.interests?.length && `Interests: ${input.targetAudience.interests.join(', ')}`,
    input.targetAudience.location && `Location: ${input.targetAudience.location}`,
    input.targetAudience.ageRange && `Age range: ${input.targetAudience.ageRange}`,
  ]
    .filter(Boolean)
    .join('\n');

  return `Perform a competitive analysis for the following project:

PROJECT: ${input.projectName}
VERTICAL: ${input.vertical}
DESCRIPTION: ${input.description}

TARGET AUDIENCE:
${audienceDetails || 'Not specified'}

PRIMARY OBJECTIVE: ${input.objectives.primary}
${input.objectives.secondary?.length ? `SECONDARY OBJECTIVES: ${input.objectives.secondary.join(', ')}` : ''}

COMPETITORS TO ANALYZE:
${competitorList || 'No specific competitors listed - identify the top 3-5 competitors in this vertical and location.'}

Analyze each competitor's digital presence, content strategy, advertising activity, and market positioning. Then provide strategic recommendations tailored to this specific business.`;
}
