/**
 * Helpers to extract structured data from Claude API responses.
 * Claude sometimes wraps JSON in markdown code blocks or adds preamble text.
 */

/**
 * Extract the first JSON object or array from a string that may contain
 * markdown code fences, leading prose, or trailing commentary.
 */
export function extractJSON(raw: string): string {
  // 1. Try to extract from ```json ... ``` or ``` ... ``` code blocks
  const codeBlockMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }

  // 2. Try to find JSON object/array boundaries
  const firstBrace = raw.indexOf('{');
  const firstBracket = raw.indexOf('[');

  let startChar: '{' | '[';
  let endChar: '}' | ']';
  let startIndex: number;

  if (firstBrace === -1 && firstBracket === -1) {
    // No JSON structure found, return raw and let the caller deal with parse errors
    return raw.trim();
  }

  if (firstBracket === -1 || (firstBrace !== -1 && firstBrace < firstBracket)) {
    startChar = '{';
    endChar = '}';
    startIndex = firstBrace;
  } else {
    startChar = '[';
    endChar = ']';
    startIndex = firstBracket;
  }

  // Walk forward to find the matching closing brace/bracket
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = startIndex; i < raw.length; i++) {
    const ch = raw[i];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (ch === '\\') {
      escaped = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (ch === startChar) depth++;
    if (ch === endChar) depth--;

    if (depth === 0) {
      return raw.slice(startIndex, i + 1);
    }
  }

  // Fallback: return everything from the first brace/bracket onward
  return raw.slice(startIndex).trim();
}

/**
 * Parse a string that may contain JSON wrapped in markdown or prose.
 * Throws a descriptive error if parsing fails.
 */
export function parseJSONFromResponse<T = unknown>(raw: string): T {
  const extracted = extractJSON(raw);

  try {
    return JSON.parse(extracted) as T;
  } catch (err) {
    const preview = extracted.length > 200 ? extracted.slice(0, 200) + '...' : extracted;
    throw new Error(
      `Failed to parse JSON from Claude response. ` +
      `Extracted text: "${preview}". ` +
      `Original error: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

/**
 * Safely attempt JSON extraction, returning null on failure instead of throwing.
 */
export function tryParseJSONFromResponse<T = unknown>(raw: string): T | null {
  try {
    return parseJSONFromResponse<T>(raw);
  } catch {
    return null;
  }
}

/**
 * Extract multiple JSON blocks from a response (e.g., when Claude returns
 * several code-fenced JSON snippets in one answer).
 */
export function extractAllJSONBlocks(raw: string): string[] {
  const blocks: string[] = [];
  const regex = /```(?:json)?\s*\n?([\s\S]*?)```/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(raw)) !== null) {
    const trimmed = match[1].trim();
    if (trimmed.length > 0) {
      blocks.push(trimmed);
    }
  }

  return blocks;
}
