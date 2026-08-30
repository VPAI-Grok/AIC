import { readFile } from "node:fs/promises";

export function decodeAICUtf8(bytes: Uint8Array, label = "input"): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new TypeError(`${label} must contain valid UTF-8 bytes.`);
  }
}

export async function readAICUtf8File(filePath: string): Promise<string> {
  return decodeAICUtf8(await readFile(filePath), filePath);
}
