/**
 * PostHog Analytics (v1.8)
 *
 * Opt-in analytics for understanding PeakInfer usage patterns.
 * Respects DO_NOT_TRACK and PEAKINFER_NO_ANALYTICS.
 * Never collects PII or code content.
 */

import { PostHog } from 'posthog-node';
import { createHash } from 'crypto';
import { hostname } from 'os';

// =============================================================================
// STATE
// =============================================================================

let client: PostHog | null = null;
let distinctId: string = 'anon';

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Initialize analytics. Respects DO_NOT_TRACK and PEAKINFER_NO_ANALYTICS.
 * Safe to call multiple times - will only initialize once.
 */
export function initAnalytics(): void {
  // Already initialized
  if (client) return;

  // Respect opt-out signals
  if (process.env.DO_NOT_TRACK === '1' || process.env.PEAKINFER_NO_ANALYTICS === '1') {
    return;
  }

  // Require API key (from env or default public key)
  const apiKey = process.env.PEAKINFER_POSTHOG_KEY || 'phc_LfZNH5EM2cJ5n3P9rRwYPyLx3TqZRNPGjBzqNGR9lkV';

  try {
    client = new PostHog(apiKey, {
      host: 'https://app.posthog.com',
      flushAt: 5,
      flushInterval: 10000, // 10 seconds
    });

    // Generate stable anonymous ID from machine hostname
    distinctId = createHash('sha256')
      .update(`peakinfer-${hostname()}`)
      .digest('hex')
      .substring(0, 16);
  } catch {
    // Silently fail - analytics should never break the tool
    client = null;
  }
}

/**
 * Track an event. No-op if analytics disabled.
 */
export function track(event: string, properties?: Record<string, unknown>): void {
  if (!client) return;

  try {
    client.capture({
      distinctId,
      event,
      properties: {
        ...properties,
        version: process.env.npm_package_version || 'unknown',
        node_version: process.version,
        platform: process.platform,
      },
    });
  } catch {
    // Silently fail
  }
}

/**
 * Flush pending events and shutdown. Call before process exit.
 */
export async function flush(): Promise<void> {
  if (!client) return;

  try {
    await client.shutdown();
  } catch {
    // Silently fail
  } finally {
    client = null;
  }
}

/**
 * Check if analytics is enabled.
 */
export function isEnabled(): boolean {
  return client !== null;
}
