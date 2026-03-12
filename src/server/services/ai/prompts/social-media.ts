/**
 * Social Media Content Engine — AI prompt generators.
 * Generates prompts for carousel posts, infographics, weekly calendars,
 * platform adaptation, and A/B caption variants.
 */

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export interface CarouselSlideOutput {
  slideNumber: number;
  headline: string;
  body: string;
  visualPrompt: string;
}

export interface CarouselResult {
  slides: CarouselSlideOutput[];
  caption: string;
  hashtags: string[];
}

export interface InfographicSection {
  heading: string;
  stat: string;
  description: string;
  iconSuggestion: string;
}

export interface InfographicResult {
  title: string;
  subtitle: string;
  sections: InfographicSection[];
  colorScheme: string;
}

export interface CalendarPost {
  day: string;
  platform: string;
  postType: string;
  topic: string;
  caption: string;
  hashtags: string[];
  visualBrief: string;
  bestTimeToPost: string;
}

export interface CalendarResult {
  posts: CalendarPost[];
}

export interface AdaptedPostResult {
  caption: string;
  hashtags: string[];
  formatRecommendation: string;
  toneNotes: string;
}

export interface CaptionVariantResult {
  variantCaption: string;
  angle: string;
  predictedEngagement: string;
  comparisonNotes: string;
}

// ---------------------------------------------------------------------------
// a) Carousel prompt
// ---------------------------------------------------------------------------

export function carouselSystemPrompt(): string {
  return `You are an expert social media content strategist specialising in carousel posts.

Return a valid JSON object with this exact structure:

{
  "slides": [
    {
      "slideNumber": 1,
      "headline": "Max 8 words — attention-grabbing hook",
      "body": "Max 30 words of supporting text",
      "visualPrompt": "Detailed description for AI image generation"
    }
  ],
  "caption": "Full post caption text with line breaks",
  "hashtags": ["#relevant", "#hashtags"]
}

Rules:
- Generate 5-10 slides.
- Slide 1 MUST be a hook that stops the scroll (bold claim, surprising stat, provocative question).
- The last slide MUST be a clear call-to-action (follow, save, share, link in bio, etc.).
- Middle slides deliver value — each one standalone-readable.
- Headlines: MAX 8 words. Punchy. No filler.
- Body text: MAX 30 words per slide. Concise, scannable.
- Visual prompts: describe composition, style, colors, and subjects for AI image generation.

Platform adaptation:
- LINKEDIN: Professional tone, data-driven, thought-leadership, industry language.
- INSTAGRAM: Visual-first, storytelling, emojis OK, relatable language.
- FACEBOOK: Conversational, question-based, community-focused.
- TIKTOK: Trendy, casual, meme-aware, short punchy text.
- TWITTER: Concise thread format, each slide = one tweet-length thought.`;
}

export function carouselUserPrompt(
  topic: string,
  platform: string,
  persona: string,
  strategy: string,
): string {
  return `Create a carousel post:

TOPIC: ${topic}
PLATFORM: ${platform}
BRAND PERSONA: ${persona}
STRATEGY CONTEXT: ${strategy}

Generate the carousel with the appropriate tone and format for ${platform}.`;
}

// ---------------------------------------------------------------------------
// b) Infographic prompt
// ---------------------------------------------------------------------------

export function infographicSystemPrompt(): string {
  return `You are an expert data visualisation and infographic content designer.

Return a valid JSON object with this exact structure:

{
  "title": "Main infographic title",
  "subtitle": "Supporting subtitle or tagline",
  "sections": [
    {
      "heading": "Section heading",
      "stat": "Key number or statistic (e.g. '73%', '2.5x', '$1.2M')",
      "description": "Brief explanation (max 20 words)",
      "iconSuggestion": "Icon name or description (e.g. 'bar-chart', 'rocket', 'target')"
    }
  ],
  "colorScheme": "Recommended color palette description (e.g. 'deep navy with gold accents')"
}

Rules:
- Generate 4-6 data sections.
- Each stat should be a concrete number, percentage, or metric — not vague.
- Descriptions are concise (max 20 words).
- Icon suggestions should be simple, recognisable icon names.
- Color scheme should complement the brand and topic.
- Structure the sections in a logical narrative flow (problem → data → solution → outcome).`;
}

export function infographicUserPrompt(
  topic: string,
  data?: Record<string, string>,
  brand?: string,
): string {
  const dataSection = data
    ? `\nEXISTING DATA TO INCORPORATE:\n${Object.entries(data).map(([k, v]) => `- ${k}: ${v}`).join('\n')}`
    : '';

  return `Create an infographic content structure:

TOPIC: ${topic}
${brand ? `BRAND: ${brand}` : ''}${dataSection}

Generate a compelling infographic that tells a story with data.`;
}

// ---------------------------------------------------------------------------
// c) Social calendar prompt
// ---------------------------------------------------------------------------

export function socialCalendarSystemPrompt(): string {
  return `You are an expert social media strategist creating weekly content calendars.

Return a valid JSON object with this exact structure:

{
  "posts": [
    {
      "day": "Monday",
      "platform": "LINKEDIN|INSTAGRAM|FACEBOOK|TIKTOK|TWITTER",
      "postType": "CAROUSEL|SINGLE_IMAGE|INFOGRAPHIC|TEXT_ONLY|VIDEO_SCRIPT|STORY|REEL_SCRIPT",
      "topic": "Post topic summary",
      "caption": "Full caption text",
      "hashtags": ["#relevant", "#hashtags"],
      "visualBrief": "Brief description of the visual/image needed",
      "bestTimeToPost": "e.g. Tuesday 10:00 AM"
    }
  ]
}

Rules:
- Generate 1 week (Monday-Sunday) of content across ALL requested platforms.
- Post type distribution: ~40% carousels, ~30% single image, ~20% infographic, ~10% text-only.
- NO duplicate content across platforms — adapt the MESSAGE, don't copy-paste.
- Each platform should have 3-5 posts per week.
- Best posting times per platform:
  - LINKEDIN: Tue-Thu 8-10 AM, 12 PM
  - INSTAGRAM: Mon-Fri 11 AM-1 PM, 7-9 PM
  - FACEBOOK: Wed-Fri 1-4 PM
  - TIKTOK: Tue-Thu 7-9 PM, Sat 11 AM
  - TWITTER: Mon-Fri 8-10 AM, 12-1 PM
- Vary angles: educational, entertaining, social proof, behind-the-scenes, promotional.
- Max 2 promotional posts per platform per week.`;
}

export function socialCalendarUserPrompt(
  strategy: string,
  platforms: string[],
  existingPosts: string[],
  week: string,
): string {
  const existingSection = existingPosts.length
    ? `\nEXISTING POSTS TO AVOID DUPLICATING:\n${existingPosts.map((p) => `- "${p.slice(0, 80)}..."`).join('\n')}`
    : '';

  return `Generate a weekly social media content calendar:

STRATEGY & BRAND CONTEXT: ${strategy}
PLATFORMS: ${platforms.join(', ')}
WEEK: ${week}
${existingSection}

Create a diverse, engaging content calendar that balances value, engagement, and promotion.`;
}

// ---------------------------------------------------------------------------
// d) Platform adaptation prompt
// ---------------------------------------------------------------------------

export function platformAdaptSystemPrompt(): string {
  return `You are an expert at adapting social media content across platforms while maintaining the core message.

Return a valid JSON object with this exact structure:

{
  "caption": "Fully adapted caption for the target platform",
  "hashtags": ["#adapted", "#hashtags"],
  "formatRecommendation": "Recommended post format for this platform (e.g. carousel, single image, video)",
  "toneNotes": "Brief explanation of tone/style changes made"
}

Platform adaptation rules:
- LINKEDIN → professional tone, longer form, industry jargon OK, 3-5 hashtags, thought-leadership framing, no emoji spam.
- INSTAGRAM → visual-first storytelling, emojis encouraged, up to 30 hashtags, relatable language, line breaks for readability.
- TIKTOK → trendy and casual, hook in the FIRST LINE, trending hashtags, conversational, meme-aware, short punchy sentences.
- FACEBOOK → conversational, question-based to drive comments, shareable framing, 3-5 hashtags, community-focused.
- TWITTER → ultra-concise (280 chars), punchy hook, 2-3 hashtags, thread-friendly if longer.

Preserve the CORE MESSAGE but completely rework the delivery for the target platform.`;
}

export function platformAdaptUserPrompt(
  content: string,
  sourcePlatform: string,
  targetPlatform: string,
): string {
  return `Adapt this social media post:

SOURCE PLATFORM: ${sourcePlatform}
TARGET PLATFORM: ${targetPlatform}

ORIGINAL CONTENT:
${content}

Rewrite this content optimised for ${targetPlatform}.`;
}

// ---------------------------------------------------------------------------
// e) Caption variant (A/B) prompt
// ---------------------------------------------------------------------------

export function captionVariantSystemPrompt(): string {
  return `You are an expert copywriter specialising in A/B testing social media captions.

Return a valid JSON object with this exact structure:

{
  "variantCaption": "The A/B variant caption",
  "angle": "The angle used (curiosity, pain point, social proof, urgency, benefit, or story)",
  "predictedEngagement": "Brief prediction of how this variant may perform vs original (e.g. 'Higher click-through due to curiosity gap')",
  "comparisonNotes": "What specifically differs from the original and why it might outperform"
}

A/B variant angles:
- CURIOSITY: Open a knowledge gap the reader needs to close.
- PAIN POINT: Lead with the frustration or problem the audience faces.
- SOCIAL PROOF: Reference results, testimonials, numbers, or authority.
- URGENCY: Create time pressure or scarcity.
- BENEFIT: Lead with the outcome or transformation.
- STORY: Open with a mini-narrative or personal anecdote.

The variant must be meaningfully different from the original — not just a word swap.`;
}

export function captionVariantUserPrompt(
  originalCaption: string,
  platform: string,
  angle: string,
): string {
  return `Generate an A/B variant of this caption:

PLATFORM: ${platform}
ANGLE TO USE: ${angle}

ORIGINAL CAPTION:
${originalCaption}

Create a variant using the "${angle}" angle that could outperform the original.`;
}
