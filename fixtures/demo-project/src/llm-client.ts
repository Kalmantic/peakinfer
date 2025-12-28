/**
 * Sample LLM Client for PeakInfer v1.5 Demo
 *
 * This file contains various LLM inference patterns to demonstrate
 * the v1.5 features: predictions, counterfactuals, and comparison.
 */

import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

// Initialize clients
const openai = new OpenAI();
const anthropic = new Anthropic();

// ============================================================================
// High-latency calls (will trigger prediction warnings)
// ============================================================================

/**
 * Chat completion with GPT-4 (high latency, high cost)
 * Prediction: p95 ~5000ms, high risk
 */
export async function chatWithGPT4(prompt: string): Promise<string> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 2000,
  });
  return response.choices[0].message.content || '';
}

/**
 * Complex analysis with Claude Opus (highest latency)
 * Prediction: p95 ~8000ms, high risk
 */
export async function analyzeWithOpus(document: string): Promise<string> {
  const response = await anthropic.messages.create({
    model: 'claude-3-opus-20240229',
    max_tokens: 4000,
    messages: [{ role: 'user', content: `Analyze this document:\n${document}` }],
  });
  return response.content[0].type === 'text' ? response.content[0].text : '';
}

// ============================================================================
// Medium-latency calls
// ============================================================================

/**
 * Summarization with GPT-4 Turbo (medium latency)
 * Prediction: p95 ~4000ms, medium risk
 */
export async function summarize(text: string): Promise<string> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4-turbo',
    messages: [
      { role: 'system', content: 'You are a summarization assistant.' },
      { role: 'user', content: `Summarize: ${text}` },
    ],
    max_tokens: 500,
  });
  return response.choices[0].message.content || '';
}

/**
 * Translation with Claude Sonnet (medium latency, good value)
 * Prediction: p95 ~4000ms, medium risk
 */
export async function translate(text: string, targetLang: string): Promise<string> {
  const response = await anthropic.messages.create({
    model: 'claude-3-sonnet-20240229',
    max_tokens: 2000,
    messages: [{ role: 'user', content: `Translate to ${targetLang}: ${text}` }],
  });
  return response.content[0].type === 'text' ? response.content[0].text : '';
}

// ============================================================================
// Low-latency calls (optimized patterns)
// ============================================================================

/**
 * Quick chat with GPT-4o-mini (low latency, low cost)
 * Prediction: p95 ~1500ms, low risk
 * Counterfactual: Other calls could use this model
 */
export async function quickChat(prompt: string): Promise<string> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 200,
  });
  return response.choices[0].message.content || '';
}

/**
 * Fast response with Claude Haiku (lowest latency)
 * Prediction: p95 ~1500ms, low risk
 */
export async function fastResponse(prompt: string): Promise<string> {
  const response = await anthropic.messages.create({
    model: 'claude-3-haiku-20240307',
    max_tokens: 500,
    messages: [{ role: 'user', content: prompt }],
  });
  return response.content[0].type === 'text' ? response.content[0].text : '';
}

// ============================================================================
// Streaming (will trigger streaming counterfactual for non-streaming calls)
// ============================================================================

/**
 * Streaming chat (good pattern - low perceived latency)
 * Counterfactual: Other calls should enable streaming
 */
export async function* streamingChat(prompt: string): AsyncGenerator<string> {
  const stream = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
    stream: true,
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) yield content;
  }
}

// ============================================================================
// Embeddings (separate from chat)
// ============================================================================

/**
 * Generate embeddings (low latency, batch-friendly)
 * Counterfactual: Should enable batching
 */
export async function embed(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });
  return response.data[0].embedding;
}

/**
 * Batch embedding (good pattern)
 */
export async function batchEmbed(texts: string[]): Promise<number[][]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: texts,
  });
  return response.data.map(d => d.embedding);
}
