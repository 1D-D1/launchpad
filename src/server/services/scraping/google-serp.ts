/**
 * Google SERP scraper service.
 * Uses SerpAPI when configured, otherwise returns mock data.
 */

import { logger } from '@/lib/logger';

export interface SerpResult {
  position: number;
  url: string;
  title: string;
  snippet: string;
}

export interface KeywordSerpData {
  keyword: string;
  results: SerpResult[];
  relatedQuestions: string[];
}

export type SerpResults = KeywordSerpData[];

const SERP_API_BASE = 'https://serpapi.com/search.json';

export class GoogleSerpScraper {
  private readonly apiKey: string | undefined;
  private readonly log = logger.child({ service: 'GoogleSerpScraper' });

  constructor() {
    this.apiKey = process.env.SERP_API_KEY;
    if (!this.apiKey) {
      this.log.warn(
        'SERP_API_KEY is not set. SERP searches will return mock data.',
      );
    }
  }

  /**
   * Search Google for the given keywords and return structured SERP results.
   */
  async searchKeywords(keywords: string[]): Promise<SerpResults> {
    this.log.info({ keywordCount: keywords.length }, 'Starting SERP search');

    const results: SerpResults = [];

    for (const keyword of keywords) {
      try {
        const data = this.apiKey
          ? await this.fetchFromSerpApi(keyword)
          : this.getMockData(keyword);

        results.push(data);
      } catch (err) {
        this.log.error({ err, keyword }, 'Failed to fetch SERP data for keyword');
        results.push({
          keyword,
          results: [],
          relatedQuestions: [],
        });
      }
    }

    this.log.info(
      { keywordCount: keywords.length, totalResults: results.reduce((s, r) => s + r.results.length, 0) },
      'SERP search complete',
    );

    return results;
  }

  private async fetchFromSerpApi(keyword: string): Promise<KeywordSerpData> {
    const params = new URLSearchParams({
      q: keyword,
      api_key: this.apiKey!,
      engine: 'google',
      num: '10',
    });

    const url = `${SERP_API_BASE}?${params.toString()}`;
    this.log.debug({ keyword }, 'Fetching from SerpAPI');

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`SerpAPI responded with ${response.status}: ${response.statusText}`);
    }

    const json = await response.json();

    const organicResults: SerpResult[] = (json.organic_results || []).map(
      (r: Record<string, unknown>, index: number) => ({
        position: index + 1,
        url: (r.link as string) || '',
        title: (r.title as string) || '',
        snippet: (r.snippet as string) || '',
      }),
    );

    const relatedQuestions: string[] = (json.related_questions || []).map(
      (q: Record<string, unknown>) => (q.question as string) || '',
    ).filter(Boolean);

    return {
      keyword,
      results: organicResults,
      relatedQuestions,
    };
  }

  private getMockData(keyword: string): KeywordSerpData {
    this.log.warn(
      { keyword },
      'Returning mock SERP data (SERP_API_KEY not configured)',
    );

    return {
      keyword,
      results: [
        {
          position: 1,
          url: `https://example.com/${encodeURIComponent(keyword)}`,
          title: `[Mock] Top result for "${keyword}"`,
          snippet: `This is a mock snippet for the keyword "${keyword}". Configure SERP_API_KEY for real data.`,
        },
        {
          position: 2,
          url: `https://example.org/${encodeURIComponent(keyword)}`,
          title: `[Mock] Second result for "${keyword}"`,
          snippet: `Another mock result. Set SERP_API_KEY environment variable to enable real Google SERP data.`,
        },
      ],
      relatedQuestions: [
        `What is ${keyword}?`,
        `How does ${keyword} work?`,
        `Best ${keyword} strategies`,
      ],
    };
  }
}
