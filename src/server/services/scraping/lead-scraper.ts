/**
 * Lead scraper service.
 * Integrates with Apollo.io for lead discovery and ZeroBounce for email verification.
 * Falls back gracefully when API keys are not configured.
 */

import { logger } from '@/lib/logger';

export interface LeadSearchCriteria {
  jobTitles?: string[];
  industries?: string[];
  locations?: string[];
  companySize?: string;
  keywords?: string[];
  limit?: number;
}

export interface Lead {
  email: string;
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  jobTitle: string | null;
  linkedinUrl: string | null;
  source: string;
}

export interface EmailVerificationResult {
  valid: boolean;
  reason: string;
}

const APOLLO_API_BASE = 'https://api.apollo.io/v1';
const ZEROBOUNCE_API_BASE = 'https://api.zerobounce.net/v2';

export class LeadScraper {
  private readonly apolloApiKey: string | undefined;
  private readonly zeroBounceApiKey: string | undefined;
  private readonly log = logger.child({ service: 'LeadScraper' });

  constructor() {
    this.apolloApiKey = process.env.APOLLO_API_KEY;
    this.zeroBounceApiKey = process.env.ZEROBOUNCE_API_KEY;
  }

  /**
   * Search for leads using Apollo.io.
   * Returns an empty array if the API key is not configured.
   */
  async searchLeads(criteria: LeadSearchCriteria): Promise<Lead[]> {
    this.log.info({ criteria }, 'Searching for leads');

    if (!this.apolloApiKey) {
      this.log.info(
        'APOLLO_API_KEY is not configured. Lead search requires an Apollo.io API key. ' +
          'Set the APOLLO_API_KEY environment variable to enable lead discovery.',
      );
      return [];
    }

    try {
      const response = await fetch(`${APOLLO_API_BASE}/mixed_people/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'X-Api-Key': this.apolloApiKey,
        },
        body: JSON.stringify({
          person_titles: criteria.jobTitles,
          person_locations: criteria.locations,
          q_keywords: criteria.keywords?.join(' '),
          per_page: criteria.limit || 25,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Apollo API error ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      const people: Record<string, unknown>[] = data.people || [];

      const leads: Lead[] = people.map((person) => ({
        email: (person.email as string) || '',
        firstName: (person.first_name as string) || null,
        lastName: (person.last_name as string) || null,
        company: (person.organization_name as string) || null,
        jobTitle: (person.title as string) || null,
        linkedinUrl: (person.linkedin_url as string) || null,
        source: 'apollo',
      }));

      this.log.info({ count: leads.length }, 'Leads found via Apollo');
      return leads.filter((lead) => lead.email);
    } catch (err) {
      this.log.error({ err }, 'Failed to search leads via Apollo');
      throw err;
    }
  }

  /**
   * Import leads from a CSV string.
   * Expected columns: email, firstName, lastName, company, jobTitle, linkedinUrl
   * First row is treated as a header.
   */
  async importFromCSV(csvContent: string): Promise<Lead[]> {
    this.log.info('Importing leads from CSV');

    const lines = csvContent
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length < 2) {
      this.log.warn('CSV has no data rows');
      return [];
    }

    const headers = this.parseCSVLine(lines[0]).map((h) =>
      h.toLowerCase().replace(/[\s_-]+/g, ''),
    );

    const emailIdx = headers.findIndex((h) =>
      ['email', 'emailaddress', 'mail'].includes(h),
    );
    if (emailIdx === -1) {
      throw new Error(
        'CSV must contain an "email" column. Found columns: ' + headers.join(', '),
      );
    }

    const firstNameIdx = headers.findIndex((h) =>
      ['firstname', 'first', 'prenom'].includes(h),
    );
    const lastNameIdx = headers.findIndex((h) =>
      ['lastname', 'last', 'nom'].includes(h),
    );
    const companyIdx = headers.findIndex((h) =>
      ['company', 'organisation', 'organization', 'societe', 'entreprise'].includes(h),
    );
    const jobTitleIdx = headers.findIndex((h) =>
      ['jobtitle', 'title', 'position', 'poste', 'fonction'].includes(h),
    );
    const linkedinIdx = headers.findIndex((h) =>
      ['linkedin', 'linkedinurl', 'linkedinprofile'].includes(h),
    );

    const leads: Lead[] = [];

    for (let i = 1; i < lines.length; i++) {
      const fields = this.parseCSVLine(lines[i]);
      const email = fields[emailIdx]?.trim();
      if (!email) continue;

      leads.push({
        email,
        firstName: firstNameIdx >= 0 ? fields[firstNameIdx]?.trim() || null : null,
        lastName: lastNameIdx >= 0 ? fields[lastNameIdx]?.trim() || null : null,
        company: companyIdx >= 0 ? fields[companyIdx]?.trim() || null : null,
        jobTitle: jobTitleIdx >= 0 ? fields[jobTitleIdx]?.trim() || null : null,
        linkedinUrl: linkedinIdx >= 0 ? fields[linkedinIdx]?.trim() || null : null,
        source: 'csv_import',
      });
    }

    this.log.info({ count: leads.length }, 'Leads imported from CSV');
    return leads;
  }

  /**
   * Verify an email address using ZeroBounce.
   * Returns { valid: true, reason: 'unverified' } if the API key is not configured.
   */
  async verifyEmail(email: string): Promise<EmailVerificationResult> {
    if (!this.zeroBounceApiKey) {
      this.log.debug(
        { email },
        'ZEROBOUNCE_API_KEY not set, skipping verification',
      );
      return { valid: true, reason: 'unverified' };
    }

    try {
      const params = new URLSearchParams({
        api_key: this.zeroBounceApiKey,
        email,
      });

      const response = await fetch(
        `${ZEROBOUNCE_API_BASE}/validate?${params.toString()}`,
      );

      if (!response.ok) {
        throw new Error(`ZeroBounce API error: ${response.status}`);
      }

      const data = await response.json();
      const status = (data.status as string) || '';
      const subStatus = (data.sub_status as string) || '';

      const valid = status === 'valid';

      this.log.info({ email, status, subStatus, valid }, 'Email verified');

      return {
        valid,
        reason: valid ? 'verified' : `${status}${subStatus ? ` (${subStatus})` : ''}`,
      };
    } catch (err) {
      this.log.error({ err, email }, 'Email verification failed');
      return { valid: true, reason: 'verification_error' };
    }
  }

  /**
   * Simple CSV line parser that handles quoted fields.
   */
  private parseCSVLine(line: string): string[] {
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        fields.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    fields.push(current);
    return fields;
  }
}
