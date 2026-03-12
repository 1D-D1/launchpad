/**
 * Internal API authentication and client helpers.
 * Used by workers to call internal AI and pipeline endpoints securely.
 */

import { logger } from '@/lib/logger';

const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || 'launchpad-internal-2026';

const log = logger.child({ module: 'internal-api' });

/**
 * Validate that an incoming request carries a valid internal API key.
 * Checks both `x-internal-key` header and `Authorization: Bearer <key>` header
 * for backwards compatibility with existing worker code.
 */
export function validateInternalRequest(req: Request): boolean {
  const headerKey = req.headers.get('x-internal-key');
  if (headerKey === INTERNAL_API_KEY) return true;

  // Backwards compat: also accept Authorization: Bearer <key>
  const authHeader = req.headers.get('authorization');
  if (authHeader) {
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (token === INTERNAL_API_KEY) return true;
  }

  return false;
}

/**
 * Call an internal API endpoint with proper authentication.
 * Handles retries for transient failures (rate limits, timeouts).
 */
export async function callInternalApi<T = unknown>(
  path: string,
  data: Record<string, unknown>,
  options?: { maxRetries?: number; timeoutMs?: number },
): Promise<T> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000';
  const url = `${baseUrl}${path}`;
  const maxRetries = options?.maxRetries ?? 2;
  const timeoutMs = options?.timeoutMs ?? 120_000; // 2 min default for AI calls

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-key': INTERNAL_API_KEY,
        },
        body: JSON.stringify(data),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (res.status === 429) {
        // Rate limited -- wait and retry
        const retryAfter = parseInt(res.headers.get('retry-after') || '5', 10);
        log.warn({ path, attempt, retryAfter }, 'Rate limited, retrying');
        await sleep(retryAfter * 1000);
        continue;
      }

      if (!res.ok) {
        const body = await res.text().catch(() => 'no body');
        throw new Error(`Internal API error: ${res.status} ${res.statusText} - ${body}`);
      }

      return (await res.json()) as T;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      if (lastError.name === 'AbortError') {
        lastError = new Error(`Internal API call to ${path} timed out after ${timeoutMs}ms`);
      }

      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 10_000);
        log.warn({ path, attempt, err: lastError.message, delay }, 'Internal API call failed, retrying');
        await sleep(delay);
      }
    }
  }

  throw lastError ?? new Error(`Internal API call to ${path} failed`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
