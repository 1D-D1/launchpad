/**
 * Website analyzer service.
 * Fetches page HTML and extracts structured data using cheerio.
 */

import * as cheerio from 'cheerio';
import { logger } from '@/lib/logger';

export interface OgTags {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  type?: string;
  siteName?: string;
}

export interface HeadingData {
  level: number;
  text: string;
}

export interface LinkData {
  href: string;
  text: string;
  isExternal: boolean;
}

export interface WebsiteAnalysisResult {
  url: string;
  title: string | null;
  description: string | null;
  ogTags: OgTags;
  headings: HeadingData[];
  links: LinkData[];
  technologies: string[];
  textContent: string;
  screenshots: null;
}

const FETCH_TIMEOUT_MS = 10_000;

const TECHNOLOGY_PATTERNS: Record<string, RegExp[]> = {
  React: [/react\.production\.min\.js/i, /react-dom/i, /__NEXT_DATA__/i],
  'Next.js': [/_next\//i, /__NEXT_DATA__/i],
  Vue: [/vue\.runtime/i, /vue\.global/i, /vue@/i],
  Angular: [/angular\.min\.js/i, /ng-version/i],
  jQuery: [/jquery[\.\-]?\d/i, /jquery\.min\.js/i],
  WordPress: [/wp-content/i, /wp-includes/i],
  Shopify: [/cdn\.shopify\.com/i, /shopify\.com/i],
  'Google Analytics': [/google-analytics\.com/i, /googletagmanager\.com/i, /gtag/i],
  'Google Tag Manager': [/googletagmanager\.com\/gtm/i],
  'Facebook Pixel': [/connect\.facebook\.net/i, /fbq\(/i],
  Tailwind: [/tailwindcss/i, /tailwind\.min\.css/i],
  Bootstrap: [/bootstrap\.min/i, /bootstrap\.css/i],
  Stripe: [/js\.stripe\.com/i],
  Intercom: [/intercom/i, /widget\.intercom\.io/i],
  HubSpot: [/hubspot/i, /hs-scripts/i],
  Wix: [/wix\.com/i, /parastorage\.com/i],
  Squarespace: [/squarespace\.com/i, /sqsp\.net/i],
};

export class WebsiteAnalyzer {
  /**
   * Analyze a website URL and extract structured data.
   */
  async analyze(url: string): Promise<WebsiteAnalysisResult> {
    const log = logger.child({ service: 'WebsiteAnalyzer', url });

    // Validate URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error('Only HTTP/HTTPS URLs are supported');
      }
    } catch (err) {
      log.error({ err }, 'Invalid URL provided');
      throw new Error(`Invalid URL: ${url}`);
    }

    log.info('Starting website analysis');
    const startTime = Date.now();

    let html: string;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (compatible; LaunchpadBot/1.0; +https://launchpad.app)',
          Accept: 'text/html,application/xhtml+xml',
        },
        redirect: 'follow',
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      html = await response.text();
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        log.error('Request timed out after %dms', FETCH_TIMEOUT_MS);
        throw new Error(`Request to ${url} timed out after ${FETCH_TIMEOUT_MS}ms`);
      }
      log.error({ err }, 'Failed to fetch URL');
      throw err;
    }

    const $ = cheerio.load(html);
    const baseHost = parsedUrl.hostname;

    // Extract title
    const title = $('title').first().text().trim() || null;

    // Extract meta description
    const description =
      $('meta[name="description"]').attr('content')?.trim() ||
      $('meta[property="og:description"]').attr('content')?.trim() ||
      null;

    // Extract OG tags
    const ogTags: OgTags = {
      title: $('meta[property="og:title"]').attr('content')?.trim(),
      description: $('meta[property="og:description"]').attr('content')?.trim(),
      image: $('meta[property="og:image"]').attr('content')?.trim(),
      url: $('meta[property="og:url"]').attr('content')?.trim(),
      type: $('meta[property="og:type"]').attr('content')?.trim(),
      siteName: $('meta[property="og:site_name"]').attr('content')?.trim(),
    };

    // Extract headings
    const headings: HeadingData[] = [];
    $('h1, h2, h3, h4, h5, h6').each((_, el) => {
      const text = $(el).text().trim();
      if (text) {
        const level = parseInt(el.tagName.replace('h', ''), 10);
        headings.push({ level, text });
      }
    });

    // Extract links
    const links: LinkData[] = [];
    const seenHrefs = new Set<string>();
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href')?.trim();
      if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;
      if (seenHrefs.has(href)) return;
      seenHrefs.add(href);

      let isExternal = false;
      try {
        const linkUrl = new URL(href, url);
        isExternal = linkUrl.hostname !== baseHost;
      } catch {
        // Relative URL, not external
      }

      links.push({
        href,
        text: $(el).text().trim(),
        isExternal,
      });
    });

    // Detect technologies from script and link tags
    const technologies: string[] = [];
    const allSrcs: string[] = [];

    $('script[src]').each((_, el) => {
      const src = $(el).attr('src');
      if (src) allSrcs.push(src);
    });
    $('link[href]').each((_, el) => {
      const href = $(el).attr('href');
      if (href) allSrcs.push(href);
    });

    // Also check inline scripts
    const inlineScripts = $('script:not([src])')
      .map((_, el) => $(el).html())
      .get()
      .join(' ');

    const searchableText = [...allSrcs, inlineScripts, html.slice(0, 5000)].join(' ');

    for (const [tech, patterns] of Object.entries(TECHNOLOGY_PATTERNS)) {
      if (patterns.some((pattern) => pattern.test(searchableText))) {
        technologies.push(tech);
      }
    }

    // Extract text content (cleaned)
    $('script, style, noscript, svg, iframe').remove();
    const textContent = $('body')
      .text()
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 10_000);

    const elapsed = Date.now() - startTime;
    log.info(
      {
        elapsedMs: elapsed,
        headingsCount: headings.length,
        linksCount: links.length,
        technologiesFound: technologies,
      },
      'Website analysis complete',
    );

    return {
      url,
      title,
      description,
      ogTags,
      headings,
      links,
      technologies,
      textContent,
      screenshots: null,
    };
  }
}
