/**
 * Anthropic Claude API wrapper.
 * Provides typed completion and JSON-extraction helpers.
 */

import Anthropic from '@anthropic-ai/sdk';
import { parseJSONFromResponse } from './parsers';
import { logger } from '@/lib/logger';

const DEFAULT_MODEL = 'claude-sonnet-4-20250514';
const DEFAULT_MAX_TOKENS = 4096;

let clientInstance: Anthropic | null = null;

function getClient(): Anthropic {
  if (!clientInstance) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is not set');
    }
    clientInstance = new Anthropic({ apiKey });
  }
  return clientInstance;
}

export interface CompletionOptions {
  model?: string;
  temperature?: number;
  topP?: number;
  stopSequences?: string[];
}

/**
 * Generate a plain-text completion from Claude.
 *
 * @param systemPrompt - The system-level instruction for Claude
 * @param userPrompt - The user message / task description
 * @param maxTokens - Maximum tokens in the response (default 4096)
 * @param options - Additional model parameters
 * @returns The text content of Claude's response
 */
export async function generateCompletion(
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number = DEFAULT_MAX_TOKENS,
  options: CompletionOptions = {},
): Promise<string> {
  const client = getClient();

  const startTime = Date.now();

  const response = await client.messages.create({
    model: options.model ?? DEFAULT_MODEL,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
    ...(options.temperature !== undefined && { temperature: options.temperature }),
    ...(options.topP !== undefined && { top_p: options.topP }),
    ...(options.stopSequences && { stop_sequences: options.stopSequences }),
  });

  const elapsed = Date.now() - startTime;

  logger.info({
    msg: 'Claude API call completed',
    model: options.model ?? DEFAULT_MODEL,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    elapsedMs: elapsed,
    stopReason: response.stop_reason,
  });

  const textBlock = response.content.find((block) => block.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Claude response contained no text content');
  }

  return textBlock.text;
}

/**
 * Generate a completion and parse the response as JSON of type T.
 * The system prompt should instruct Claude to respond with valid JSON.
 *
 * @param systemPrompt - System prompt (should request JSON output)
 * @param userPrompt - The user message
 * @param maxTokens - Maximum tokens
 * @param options - Additional model parameters
 * @returns Parsed JSON object of type T
 */
export async function generateJSON<T>(
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number = DEFAULT_MAX_TOKENS,
  options: CompletionOptions = {},
): Promise<T> {
  const jsonSystemPrompt =
    systemPrompt +
    '\n\nIMPORTANT: Respond ONLY with valid JSON. Do not include any text before or after the JSON object. Do not wrap it in markdown code blocks.';

  const raw = await generateCompletion(jsonSystemPrompt, userPrompt, maxTokens, {
    ...options,
    temperature: options.temperature ?? 0.2, // Lower temperature for structured output
  });

  return parseJSONFromResponse<T>(raw);
}
