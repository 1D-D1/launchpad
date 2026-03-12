/**
 * Domain warmup service.
 * Manages sending volume ramp-up for new email domains to build sender reputation.
 */

import { logger } from '@/lib/logger';

export interface WarmupSchedule {
  maxEmails: number;
  stage: string;
  daysSinceStart: number;
}

export interface DomainReputation {
  score: number;
  status: 'excellent' | 'good' | 'fair' | 'poor' | 'unknown';
  details: string;
}

/**
 * Warmup stages define the sending volume ramp-up curve.
 * Each stage has a day range and max daily email count.
 */
const WARMUP_STAGES: { days: number; maxEmails: number; label: string }[] = [
  { days: 3, maxEmails: 5, label: 'Initial' },
  { days: 7, maxEmails: 10, label: 'Early' },
  { days: 14, maxEmails: 25, label: 'Building' },
  { days: 21, maxEmails: 50, label: 'Growing' },
  { days: 30, maxEmails: 100, label: 'Established' },
  { days: 45, maxEmails: 200, label: 'Mature' },
  { days: 60, maxEmails: 500, label: 'Full Volume' },
  { days: Infinity, maxEmails: 1000, label: 'Unrestricted' },
];

export class DomainWarmup {
  private readonly log = logger.child({ service: 'DomainWarmup' });

  /**
   * Calculate the maximum daily email volume based on how many days since warmup started.
   */
  getWarmupSchedule(domain: string, daysSinceStart: number): WarmupSchedule {
    if (daysSinceStart < 0) {
      this.log.warn({ domain, daysSinceStart }, 'Negative days since start');
      return { maxEmails: 0, stage: 'Not Started', daysSinceStart: 0 };
    }

    let cumulativeDays = 0;
    for (const stage of WARMUP_STAGES) {
      cumulativeDays += stage.days === Infinity ? 0 : stage.days;
      if (daysSinceStart <= cumulativeDays || stage.days === Infinity) {
        this.log.debug(
          { domain, daysSinceStart, stage: stage.label, maxEmails: stage.maxEmails },
          'Warmup schedule calculated',
        );
        return {
          maxEmails: stage.maxEmails,
          stage: stage.label,
          daysSinceStart,
        };
      }
    }

    // Fallback (should not reach here)
    return {
      maxEmails: WARMUP_STAGES[WARMUP_STAGES.length - 1].maxEmails,
      stage: 'Unrestricted',
      daysSinceStart,
    };
  }

  /**
   * Check the sending reputation for a domain.
   * Uses Google Postmaster Tools API if GOOGLE_POSTMASTER_TOKEN is set,
   * otherwise returns an estimate based on warmup stage.
   */
  async checkDomainReputation(domain: string): Promise<DomainReputation> {
    this.log.info({ domain }, 'Checking domain reputation');

    const postmasterToken = process.env.GOOGLE_POSTMASTER_TOKEN;

    if (postmasterToken) {
      return this.fetchPostmasterReputation(domain, postmasterToken);
    }

    // Without Postmaster access, return a basic assessment
    this.log.debug(
      { domain },
      'GOOGLE_POSTMASTER_TOKEN not set, returning estimated reputation',
    );

    return {
      score: 0,
      status: 'unknown',
      details:
        'Domain reputation could not be checked. ' +
        'Configure GOOGLE_POSTMASTER_TOKEN for accurate reputation data from Google Postmaster Tools.',
    };
  }

  private async fetchPostmasterReputation(
    domain: string,
    token: string,
  ): Promise<DomainReputation> {
    try {
      const response = await fetch(
        `https://gmailpostmastertools.googleapis.com/v1/domains/${domain}/trafficStats`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
        },
      );

      if (!response.ok) {
        this.log.warn(
          { domain, status: response.status },
          'Postmaster API returned error',
        );
        return {
          score: 0,
          status: 'unknown',
          details: `Postmaster API returned HTTP ${response.status}. The domain may not be verified in Google Postmaster Tools.`,
        };
      }

      const data = (await response.json()) as {
        domainReputation?: string;
        spamRate?: number;
      };

      const reputationMap: Record<string, { score: number; status: DomainReputation['status'] }> = {
        HIGH: { score: 90, status: 'excellent' },
        MEDIUM: { score: 70, status: 'good' },
        LOW: { score: 40, status: 'fair' },
        BAD: { score: 10, status: 'poor' },
      };

      const rep = reputationMap[data.domainReputation || ''] || {
        score: 50,
        status: 'unknown' as const,
      };

      this.log.info(
        { domain, reputation: data.domainReputation, spamRate: data.spamRate },
        'Domain reputation retrieved from Postmaster',
      );

      return {
        score: rep.score,
        status: rep.status,
        details: `Domain reputation: ${data.domainReputation || 'unknown'}. Spam rate: ${data.spamRate ?? 'unknown'}.`,
      };
    } catch (err) {
      this.log.error({ err, domain }, 'Failed to fetch Postmaster reputation');
      return {
        score: 0,
        status: 'unknown',
        details: 'Failed to connect to Google Postmaster Tools API.',
      };
    }
  }
}
