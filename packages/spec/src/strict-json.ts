/**
 * Parse untrusted JSON after enforcing unique object member names.
 *
 * Native JSON.parse silently applies last-member-wins semantics. That is unsafe
 * for signed envelopes because another implementation may apply first-member-
 * wins semantics and verify different content from the same bytes.
 */
export interface AICStrictJsonOptions {
  /** Maximum container nesting below the top-level value. */
  maxDepth?: number;
  /** Maximum total JSON values, including container values. */
  maxNodes?: number;
}

export function parseAICStrictJson<T = unknown>(
  text: string,
  options: AICStrictJsonOptions = {}
): T {
  if (typeof text !== "string") {
    throw new TypeError("AIC strict JSON input must be a string.");
  }

  const maxDepth = options.maxDepth ?? 128;
  const maxNodes = options.maxNodes ?? 100_000;
  if (!Number.isSafeInteger(maxDepth) || maxDepth < 0) {
    throw new TypeError("AIC strict JSON maxDepth must be a non-negative safe integer.");
  }
  if (!Number.isSafeInteger(maxNodes) || maxNodes < 1) {
    throw new TypeError("AIC strict JSON maxNodes must be a positive safe integer.");
  }

  let offset = 0;
  let nodes = 0;
  const whitespace = (): void => {
    while (
      offset < text.length &&
      (text[offset] === " " ||
        text[offset] === "\t" ||
        text[offset] === "\n" ||
        text[offset] === "\r")
    ) {
      offset += 1;
    }
  };
  const syntax = (message: string): never => {
    throw new SyntaxError(`${message} at JSON offset ${offset}.`);
  };
  const stringToken = (): string => {
    if (text[offset] !== '"') syntax("Expected a JSON string");
    const start = offset;
    offset += 1;
    let escaped = false;
    while (offset < text.length) {
      const character = text[offset];
      if (!escaped && character === '"') {
        offset += 1;
        try {
          return JSON.parse(text.slice(start, offset)) as string;
        } catch {
          return syntax("Invalid JSON string");
        }
      }
      if (!escaped && text.charCodeAt(offset) < 0x20) {
        syntax("Unescaped control character in JSON string");
      }
      if (!escaped && character === "\\") escaped = true;
      else escaped = false;
      offset += 1;
    }
    return syntax("Unterminated JSON string");
  };

  let value: (depth: number) => void;
  const object = (depth: number): void => {
    offset += 1;
    whitespace();
    if (text[offset] === "}") {
      offset += 1;
      return;
    }
    const names = new Set<string>();
    while (offset < text.length) {
      whitespace();
      const name = stringToken();
      if (names.has(name)) {
        syntax(`Duplicate JSON object member ${JSON.stringify(name)}`);
      }
      names.add(name);
      whitespace();
      if (text[offset] !== ":") syntax("Expected ':' after JSON object member");
      offset += 1;
      value(depth + 1);
      whitespace();
      if (text[offset] === "}") {
        offset += 1;
        return;
      }
      if (text[offset] !== ",") syntax("Expected ',' or '}' in JSON object");
      offset += 1;
    }
    syntax("Unterminated JSON object");
  };
  const array = (depth: number): void => {
    offset += 1;
    whitespace();
    if (text[offset] === "]") {
      offset += 1;
      return;
    }
    while (offset < text.length) {
      value(depth + 1);
      whitespace();
      if (text[offset] === "]") {
        offset += 1;
        return;
      }
      if (text[offset] !== ",") syntax("Expected ',' or ']' in JSON array");
      offset += 1;
    }
    syntax("Unterminated JSON array");
  };
  value = (depth: number): void => {
    whitespace();
    if (depth > maxDepth) syntax(`JSON nesting exceeds maxDepth ${maxDepth}`);
    nodes += 1;
    if (nodes > maxNodes) syntax(`JSON value count exceeds maxNodes ${maxNodes}`);
    const character = text[offset];
    if (character === "{") return object(depth);
    if (character === "[") return array(depth);
    if (character === '"') {
      stringToken();
      return;
    }
    for (const literal of ["true", "false", "null"]) {
      if (text.startsWith(literal, offset)) {
        offset += literal.length;
        return;
      }
    }
    const number = text
      .slice(offset)
      .match(/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/);
    if (number) {
      if (!Number.isFinite(Number(number[0]))) {
        syntax("JSON number is outside the finite range");
      }
      offset += number[0].length;
      return;
    }
    syntax("Expected a JSON value");
  };

  whitespace();
  value(0);
  whitespace();
  if (offset !== text.length) syntax("Unexpected trailing JSON content");
  return JSON.parse(text) as T;
}
