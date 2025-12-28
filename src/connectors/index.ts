/**
 * Runtime Data Connectors
 *
 * Unified interface for fetching LLM runtime data from various sources.
 * Supports: Helicone, LangSmith
 *
 * Usage:
 *   const result = await fetchRuntimeData({
 *     source: 'helicone',
 *     apiKey: process.env.HELICONE_API_KEY,
 *     limit: 1000,
 *   });
 */

import { fetchHeliconeEvents } from './helicone.js';
import { fetchLangSmithTraces } from './langsmith.js';
import {
  ConnectorConfig,
  ConnectorResult,
  ConnectorError,
  NormalizedEvent,
  ConnectorSummary,
} from './types.js';

export type RuntimeSource = 'helicone' | 'langsmith';

export interface FetchRuntimeOptions extends Omit<ConnectorConfig, 'apiKey'> {
  source: RuntimeSource;
  apiKey: string;
}

/**
 * Fetch runtime data from the specified source
 */
export async function fetchRuntimeData(options: FetchRuntimeOptions): Promise<ConnectorResult> {
  const { source, ...config } = options;

  switch (source) {
    case 'helicone':
      return fetchHeliconeEvents(config);
    case 'langsmith':
      return fetchLangSmithTraces(config);
    default:
      throw new ConnectorError(
        `Unknown runtime source: ${source}. Supported sources: helicone, langsmith`,
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
    langsmith: ['LANGSMITH_API_KEY', 'LANGCHAIN_API_KEY'],
  };

  const envVars = envVarMap[source] || [];
  for (const envVar of envVars) {
    const value = process.env[envVar];
    if (value) return value;
  }
  return undefined;
}

/**
 * Validate that the source is supported
 */
export function isValidSource(source: string): source is RuntimeSource {
  return source === 'helicone' || source === 'langsmith';
}

/**
 * Get a human-readable description of the source
 */
export function getSourceDescription(source: RuntimeSource): string {
  const descriptions: Record<RuntimeSource, string> = {
    helicone: 'Helicone LLM Observability',
    langsmith: 'LangSmith Tracing',
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
