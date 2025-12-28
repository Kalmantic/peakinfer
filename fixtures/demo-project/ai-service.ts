/**
 * Demo AI Service - Shows common LLM inference issues
 * This file is used by `peakinfer demo` to demonstrate drift detection
 */
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

const anthropic = new Anthropic();
const openai = new OpenAI();

// Issue 1: Streaming configured but may not be working in production
export async function chat(prompt: string): Promise<string> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    stream: true,  // <-- Code says streaming
    messages: [{ role: 'user', content: prompt }],
  });

  let result = '';
  for await (const event of response) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      result += event.delta.text;
    }
  }
  return result;
}

// Issue 2: GPT-4 used for simple classification (overpowered model)
export async function classifyIntent(message: string): Promise<string> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4',  // <-- Expensive model for simple task
    messages: [
      { role: 'system', content: 'Classify the user intent as: question, complaint, feedback, or other' },
      { role: 'user', content: message },
    ],
    max_tokens: 50,
  });
  return response.choices[0].message.content || 'other';
}

// Issue 3: No error handling, no retry logic
export async function summarize(text: string): Promise<string> {
  // No try/catch, no retry, no timeout
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 500,
    messages: [{ role: 'user', content: `Summarize: ${text}` }],
  });
  return response.content[0].type === 'text' ? response.content[0].text : '';
}

// Issue 4: Sequential processing (throughput bottleneck)
export async function batchAnalyze(items: string[]): Promise<string[]> {
  const results: string[] = [];
  for (const item of items) {  // <-- Sequential, should be parallel
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 200,
      messages: [{ role: 'user', content: `Analyze: ${item}` }],
    });
    results.push(response.content[0].type === 'text' ? response.content[0].text : '');
  }
  return results;
}
