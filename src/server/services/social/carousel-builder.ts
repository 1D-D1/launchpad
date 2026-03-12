/**
 * CarouselBuilder — builds carousel data structures and generates HTML/SVG
 * slide previews for the social media dashboard.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CarouselSlide {
  slideNumber: number;
  headline: string;
  body: string;
  visualPrompt: string;
}

export interface BrandConfig {
  primaryColor: string;
  secondaryColor: string;
  fontFamily: string;
  logoUrl?: string;
}

const DEFAULT_BRAND: BrandConfig = {
  primaryColor: '#2563EB',
  secondaryColor: '#1E40AF',
  fontFamily: 'system-ui, -apple-system, sans-serif',
};

// ---------------------------------------------------------------------------
// Platform color mappings
// ---------------------------------------------------------------------------

const PLATFORM_COLORS: Record<string, { primary: string; secondary: string; gradient: string }> = {
  LINKEDIN: {
    primary: '#0A66C2',
    secondary: '#004182',
    gradient: 'linear-gradient(135deg, #0A66C2, #004182)',
  },
  INSTAGRAM: {
    primary: '#E1306C',
    secondary: '#833AB4',
    gradient: 'linear-gradient(135deg, #833AB4, #E1306C, #F77737)',
  },
  FACEBOOK: {
    primary: '#1877F2',
    secondary: '#0B5FCC',
    gradient: 'linear-gradient(135deg, #1877F2, #0B5FCC)',
  },
  TIKTOK: {
    primary: '#000000',
    secondary: '#FE2C55',
    gradient: 'linear-gradient(135deg, #25F4EE, #FE2C55)',
  },
  TWITTER: {
    primary: '#1DA1F2',
    secondary: '#0C85D0',
    gradient: 'linear-gradient(135deg, #1DA1F2, #0C85D0)',
  },
};

// ---------------------------------------------------------------------------
// CarouselBuilder
// ---------------------------------------------------------------------------

export class CarouselBuilder {
  /**
   * Build carousel data structure from an AI response (parsed JSON).
   * Validates and normalises the slide data.
   */
  buildCarousel(aiResponse: { slides: CarouselSlide[] }): CarouselSlide[] {
    return aiResponse.slides.map((slide, index) => ({
      slideNumber: index + 1,
      headline: (slide.headline ?? '').slice(0, 80),
      body: (slide.body ?? '').slice(0, 200),
      visualPrompt: slide.visualPrompt ?? '',
    }));
  }

  /**
   * Generate an HTML preview string for a single carousel slide.
   */
  generateSlidePreview(
    slide: CarouselSlide,
    brand: BrandConfig = DEFAULT_BRAND,
    platform?: string,
  ): string {
    const colors = (platform ? PLATFORM_COLORS[platform] : undefined) ?? {
      primary: brand.primaryColor,
      secondary: brand.secondaryColor,
      gradient: `linear-gradient(135deg, ${brand.primaryColor}, ${brand.secondaryColor})`,
    };

    return `<div style="
      width: 360px;
      height: 360px;
      background: ${colors.gradient};
      border-radius: 12px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      padding: 32px;
      box-sizing: border-box;
      font-family: ${brand.fontFamily};
      color: #ffffff;
      text-align: center;
      position: relative;
    ">
      <div style="
        position: absolute;
        top: 16px;
        right: 16px;
        background: rgba(255,255,255,0.2);
        border-radius: 12px;
        padding: 4px 10px;
        font-size: 12px;
        font-weight: 600;
      ">${slide.slideNumber}</div>
      <h2 style="
        font-size: 24px;
        font-weight: 800;
        line-height: 1.2;
        margin: 0 0 16px 0;
        text-shadow: 0 2px 4px rgba(0,0,0,0.2);
      ">${escapeHtml(slide.headline)}</h2>
      <p style="
        font-size: 14px;
        line-height: 1.5;
        margin: 0;
        opacity: 0.9;
      ">${escapeHtml(slide.body)}</p>
    </div>`;
  }

  /**
   * Generate HTML previews for all slides in a carousel.
   */
  generateCarouselPreview(
    slides: CarouselSlide[],
    brand: BrandConfig = DEFAULT_BRAND,
    platform?: string,
  ): string[] {
    return slides.map((slide) => this.generateSlidePreview(slide, brand, platform));
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/** Singleton instance */
export const carouselBuilder = new CarouselBuilder();
