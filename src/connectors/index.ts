/**
 * Runtime Data Connectors
 *
 * Unified interface for fetching LLM runtime data from various sources.
 * Supports: Helicone, Langfuse, PostHog
 *
 * Usage:
 *   const result = await fetchRuntimeData({
 *     source: 'helicone',
 *     apiKey: process.env.HELICONE_API_KEY,
 *     limit: 1000,
 *   });
 */

import { fetchHeliconeEvents } from './helicone.js';
import { fetchLangfuseTraces } from './langfuse.js';
import { fetchPostHogEvents } from './posthog.js';
import {
  ConnectorConfig,
  ConnectorResult,
  ConnectorError,
  NormalizedEvent,
  ConnectorSummary,
} from './types.js';

export type RuntimeSource = 'helicone' | 'langfuse' | 'posthog';

export interface FetchRuntimeOptions extends Omit<ConnectorConfig, 'apiKey'> {
  source: RuntimeSource;
  apiKey: string;
  projectId?: string; // For PostHog
}

/**
 * Fetch runtime data from the specified source
 */
export async function fetchRuntimeData(options: FetchRuntimeOptions): Promise<ConnectorResult> {
  const { source, projectId, ...config } = options;

  switch (source) {
    case 'helicone':
      return fetchHeliconeEvents(config);
    case 'langfuse':
      return fetchLangfuseTraces(config);
    case 'posthog':
      return fetchPostHogEvents({ ...config, projectId });
    default:
      throw new ConnectorError(
        `Unknown runtime source: ${source}. Supported sources: helicone, langfuse, posthog`,
        source as RuntimeSource
      );
  }
}

/**
 * Get API key from environment for the given source
 */
export function getApiKeyFromEnv(source: RuntimeSource): string | undefined {
  const envVarMap: Record<RuntimeSource, string[]> = {
    helicone: ['HELICONE_API_KEY', 'HELICONE_KEY'],
    langfuse: ['LANGFUSE_PUBLIC_KEY', 'LANGFUSE_API_KEY'],
    posthog: ['POSTHOG_API_KEY', 'POSTHOG_PERSONAL_API_KEY'],
  };

  const envVars = envVarMap[source] || [];
  for (const envVar of envVars) {
    const value = process.env[envVar];
    if (value) return value;
  }
  return undefined;
}

/**
 * Get project ID from environment for PostHog
 */
export function getProjectIdFromEnv(): string | undefined {
  return process.env.POSTHOG_PROJECT_ID;
}

/**
 * Validate that the source is supported
 */
export function isValidSource(source: string): source is RuntimeSource {
  return source === 'helicone' || source === 'langfuse' || source === 'posthog';
}

/**
 * Get a human-readable description of the source
 */
export function getSourceDescription(source: RuntimeSource): string {
  const descriptions: Record<RuntimeSource, string> = {
    helicone: 'Helicone LLM Observability',
    langfuse: 'Langfuse LLM Observability',
    posthog: 'PostHog Product Analytics',
  };
  return descriptions[source] || source;
}

// Re-export types
export {
  ConnectorConfig,
  ConnectorResult,
  ConnectorError,
  NormalizedEvent,
  ConnectorSummary,
} from './types.js';
