/**
 * Prompt template for social media content batch generation.
 * Generates multiple content pieces across platforms in a single call.
 */

export interface ContentGenerationInput {
  projectName: string;
  vertical: string;
  brandVoice: string;
  keyMessage: string;
  platforms: string[];
  contentTypes: string[];
  themes: string[];
  targetAudience: string;
  count: number;
  language?: string;
  includeVariantB?: boolean;
  existingContent?: string[];
}

export interface GeneratedContent {
  platform: string;
  type: string;
  title: string;
  body: string;
  bodyVariantB?: string;
  hashtags: string[];
  callToAction: string;
  visualPrompt: string;
  bestPostingTime: string;
  theme: string;
}

export interface ContentGenerationResult {
  contents: GeneratedContent[];
}

export function buildContentGenerationSystemPrompt(): string {
  return `You are an expert social media content creator and copywriter. Generate engaging, platform-optimized content for social media marketing.

Return a valid JSON object:

{
  "contents": [
    {
      "platform": "INSTAGRAM|FACEBOOK|LINKEDIN|TWITTER",
      "type": "SOCIAL_POST|AD_COPY|BLOG_POST",
      "title": "Short attention-grabbing title",
      "body": "Full post body text, platform-optimized length",
      "bodyVariantB": "A/B test variant (if requested, otherwise omit)",
      "hashtags": ["#relevant", "#hashtags"],
      "callToAction": "Clear CTA text",
      "visualPrompt": "Detailed description for AI image generation - describe composition, style, colors, subjects",
      "bestPostingTime": "Recommended posting time (e.g., 'Tuesday 9:00 AM')",
      "theme": "Which content theme this addresses"
    }
  ]
}

Platform-specific guidelines:
- INSTAGRAM: Visual-first, 2200 char max, 30 hashtags max, use emojis, carousel-friendly
- FACEBOOK: Conversational, 63,206 char max, fewer hashtags (3-5), encourage engagement
- LINKEDIN: Professional tone, thought leadership, 3000 char max, 3-5 hashtags
- TWITTER: Concise, 280 char max, 2-3 hashtags, punchy hooks

Content type guidelines:
- SOCIAL_POST: Organic social content, value-driven, engagement-focused
- AD_COPY: Direct response, benefit-focused, clear CTA, urgency elements
- BLOG_POST: Long-form, SEO-optimized, educational, 800-1500 words

Each piece of content must be unique and not repetitive. Vary hooks, angles, and formats across the batch. Ensure A/B variants test a meaningfully different approach (different hook, CTA, or angle).`;
}

export function buildContentGenerationUserPrompt(input: ContentGenerationInput): string {
  return `Generate ${input.count} pieces of social media content:

PROJECT: ${input.projectName}
VERTICAL: ${input.vertical}
BRAND VOICE: ${input.brandVoice}
KEY MESSAGE: ${input.keyMessage}
LANGUAGE: ${input.language || 'English'}

PLATFORMS: ${input.platforms.join(', ')}
CONTENT TYPES: ${input.contentTypes.join(', ')}

THEMES TO COVER:
${input.themes.map((t, i) => `${i + 1}. ${t}`).join('\n')}

TARGET AUDIENCE: ${input.targetAudience}

${input.includeVariantB ? 'INCLUDE A/B VARIANT: Yes - provide bodyVariantB for each content piece.' : ''}

${input.existingContent?.length ? `AVOID SIMILAR CONTENT TO:\n${input.existingContent.map((c) => `- "${c.slice(0, 100)}..."`).join('\n')}` : ''}

Distribute content evenly across the requested platforms. Each piece should be ready to publish with no placeholders. Include visual prompts that are detailed enough for AI image generation.`;
}
