/**
 * Prompt template for ad copy generation (Meta Ads + Google Ads).
 * Generates platform-specific ad creatives with targeting suggestions.
 */

export interface AdCopyInput {
  projectName: string;
  vertical: string;
  productDescription: string;
  valueProposition: string;
  targetAudience: string;
  platforms: ('META' | 'GOOGLE')[];
  objective: 'AWARENESS' | 'CONSIDERATION' | 'CONVERSION';
  budget: number;
  currency: string;
  landingPageUrl?: string;
  brandTone: string;
  competitorWeaknesses?: string[];
  promotionDetails?: string;
  language?: string;
}

export interface MetaAdCreative {
  platform: 'META';
  format: 'single_image' | 'carousel' | 'video' | 'stories';
  placement: string;
  primaryText: string;
  headline: string;
  description: string;
  callToAction: string;
  visualPrompt: string;
  variantB: {
    primaryText: string;
    headline: string;
  };
}

export interface GoogleAdCreative {
  platform: 'GOOGLE';
  campaignType: 'search' | 'display' | 'performance_max';
  headlines: string[];
  descriptions: string[];
  sitelinks: { title: string; description: string; url: string }[];
  keywords: { keyword: string; matchType: 'broad' | 'phrase' | 'exact' }[];
  negativeKeywords: string[];
}

export interface AdCopyResult {
  meta: MetaAdCreative[];
  google: GoogleAdCreative[];
  targeting: {
    audiences: string[];
    interests: string[];
    lookalikeSource: string;
    excludeAudiences: string[];
    locations: string[];
    ageRange: { min: number; max: number };
  };
  budgetAllocation: {
    platform: string;
    percentage: number;
    dailyBudget: number;
    rationale: string;
  }[];
  funnelMapping: {
    stage: string;
    adType: string;
    objective: string;
    expectedCPA: string;
  }[];
}

export function buildAdCopySystemPrompt(): string {
  return `You are an expert paid media strategist and ad copywriter for Meta (Facebook/Instagram) and Google Ads. Generate high-converting ad creatives with targeting recommendations.

Return a valid JSON object:

{
  "meta": [
    {
      "platform": "META",
      "format": "single_image|carousel|video|stories",
      "placement": "feed|stories|reels|right_column",
      "primaryText": "Main ad text (125 chars recommended, 2200 max)",
      "headline": "Headline (40 chars max)",
      "description": "Link description (30 chars max)",
      "callToAction": "LEARN_MORE|SIGN_UP|SHOP_NOW|GET_OFFER|BOOK_NOW|CONTACT_US",
      "visualPrompt": "Detailed image/video description for creative production",
      "variantB": {
        "primaryText": "A/B test variant of primary text",
        "headline": "A/B test variant of headline"
      }
    }
  ],
  "google": [
    {
      "platform": "GOOGLE",
      "campaignType": "search|display|performance_max",
      "headlines": ["Headline 1 (30 chars)", "Headline 2", "...up to 15"],
      "descriptions": ["Description 1 (90 chars)", "Description 2", "...up to 4"],
      "sitelinks": [
        { "title": "Sitelink", "description": "Description", "url": "/page" }
      ],
      "keywords": [
        { "keyword": "term", "matchType": "broad|phrase|exact" }
      ],
      "negativeKeywords": ["irrelevant terms"]
    }
  ],
  "targeting": {
    "audiences": ["Custom audience descriptions"],
    "interests": ["Interest targeting"],
    "lookalikeSource": "Source for lookalike/similar audiences",
    "excludeAudiences": ["Who to exclude"],
    "locations": ["Target locations"],
    "ageRange": { "min": 25, "max": 55 }
  },
  "budgetAllocation": [
    {
      "platform": "Meta|Google",
      "percentage": 60,
      "dailyBudget": 30,
      "rationale": "Why this allocation"
    }
  ],
  "funnelMapping": [
    {
      "stage": "Top of Funnel",
      "adType": "Brand awareness video",
      "objective": "Reach",
      "expectedCPA": "$X.XX"
    }
  ]
}

Ad copy rules:
- Meta: Hook in first 3 words, social proof when possible, emoji sparingly, one CTA
- Google Search: Include keywords in headlines, use numbers/stats, include CTA verbs
- Google Display: Benefit-focused headlines, curiosity-driven descriptions
- All: No clickbait, comply with ad policies, avoid superlatives without proof
- A/B variants: Test different psychological triggers (urgency vs. social proof vs. benefit)
- Budget: Recommend 70/30 split for proven/testing creatives`;
}

export function buildAdCopyUserPrompt(input: AdCopyInput): string {
  return `Generate ad creatives for the following campaign:

PROJECT: ${input.projectName}
VERTICAL: ${input.vertical}
PRODUCT/SERVICE: ${input.productDescription}
VALUE PROPOSITION: ${input.valueProposition}

TARGET AUDIENCE: ${input.targetAudience}
CAMPAIGN OBJECTIVE: ${input.objective}
PLATFORMS: ${input.platforms.join(', ')}
BUDGET: ${input.budget} ${input.currency}/month
${input.landingPageUrl ? `LANDING PAGE: ${input.landingPageUrl}` : ''}
BRAND TONE: ${input.brandTone}
LANGUAGE: ${input.language || 'English'}

${input.competitorWeaknesses?.length ? `COMPETITOR WEAKNESSES TO EXPLOIT:\n${input.competitorWeaknesses.map((w) => `- ${w}`).join('\n')}` : ''}

${input.promotionDetails ? `CURRENT PROMOTION: ${input.promotionDetails}` : ''}

Generate:
${input.platforms.includes('META') ? '- 3 Meta ad creatives (mix of formats: single image, carousel, stories)' : ''}
${input.platforms.includes('GOOGLE') ? '- 2 Google ad groups (1 search, 1 display/pmax) with full keyword lists' : ''}
- Targeting recommendations
- Budget allocation with rationale
- Full-funnel mapping showing which ads serve which funnel stage`;
}
