/**
 * AI Service for PeakInfer Demo
 * Anthropic Claude only - demonstrates various inference patterns
 */

import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

// ============================================================================
// HIGH LATENCY / HIGH COST (will trigger issues)
// ============================================================================

/**
 * Complex analysis with Claude Opus (highest cost, no error handling)
 * Issues expected:
 * - Critical: No error handling
 * - Warning: Expensive model for simple task
 */
export async function analyzeDocument(document: string): Promise<string> {
  const response = await client.messages.create({
    model: 'claude-opus-4-20250514',
    max_tokens: 4000,
    messages: [{ role: 'user', content: `Analyze: ${document}` }],
  });
  return response.content[0].type === 'text' ? response.content[0].text : '';
}

/**
 * Chat completion without streaming (latency issue)
 * Issues expected:
 * - Warning: No streaming enabled
 * - Critical: No error handling
 */
export async function chat(prompt: string): Promise<string> {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
  });
  return response.content[0].type === 'text' ? response.content[0].text : '';
}

// ============================================================================
// MEDIUM PATTERNS (some issues)
// ============================================================================

/**
 * Translation service (no timeout configured)
 * Issues expected:
 * - Warning: No timeout configured
 */
export async function translate(text: string, targetLang: string): Promise<string> {
  const response = await client.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 2000,
    messages: [{ role: 'user', content: `Translate to ${targetLang}: ${text}` }],
  });
  return response.content[0].type === 'text' ? response.content[0].text : '';
}

// ============================================================================
// GOOD PATTERNS (minimal issues)
// ============================================================================

/**
 * Fast response with Claude Haiku (optimized)
 * - Uses cheap model
 * - Has error handling
 * - Has streaming
 */
export async function* streamChat(prompt: string): AsyncGenerator<string> {
  try {
    const stream = await client.messages.stream({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield event.delta.text;
      }
    }
  } catch (error) {
    console.error('Stream error:', error);
    throw error;
  }
}

/**
 * Robust API call with retry and fallback
 * - Has error handling
 * - Has retry logic
 * - Has fallback model
 */
export async function robustChat(prompt: string): Promise<string> {
  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      });
      return response.content[0].type === 'text' ? response.content[0].text : '';
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxRetries - 1) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
  }

  // Fallback to cheaper model
  try {
    const response = await client.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    });
    return response.content[0].type === 'text' ? response.content[0].text : '';
  } catch {
    throw lastError;
  }
}
