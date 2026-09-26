/**
 * Thin Jev client for the eval. Deliberately unimplemented until it's written
 * against TypeSafe's official API reference (docs.typesafe.ai) — the request
 * shape must not be guessed.
 */
export type JevChoiceResult = {
  choice: string | null;
  confidence: number;
  probabilities: Record<string, number>;
};

export function jevAvailable(): boolean {
  return Boolean(process.env.TYPESAFE_API_KEY) && IMPLEMENTED;
}

const IMPLEMENTED = false;

export async function jevChoice(_input: {
  state: Record<string, unknown>;
  question: string;
  options: string[];
}): Promise<JevChoiceResult> {
  throw new Error("jev-client not implemented: write it from the official API reference");
}
