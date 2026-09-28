/**
 * Minimal Jev client for the eval, per https://docs.typesafe.ai/api.md:
 * POST /v1/systemone with a `state` and one Choice question.
 */
export type JevChoiceResult = {
  choice: string | null;
  confidence: number;
  probabilities: Record<string, number>;
  inputTokens: number;
  ms: number;
};

const ENDPOINT = "https://api.typesafe.ai/v1/systemone";
const MODEL = process.env.JEV_MODEL ?? "jev-latest";

export function jevAvailable(): boolean {
  return Boolean(process.env.TYPESAFE_API_KEY);
}

export async function jevChoice(input: {
  state: Record<string, unknown>;
  question: string;
  options: string[];
  /** Optional one-line description per option (TypeSafe recommends them for similar options). */
  descriptions?: Record<string, unknown>;
}): Promise<JevChoiceResult> {
  const body = {
    model: MODEL,
    state: input.state,
    questions: {
      category: {
        type: "choice",
        instructions: input.question,
        // Without descriptions: option names only, the same information the LLM baseline got.
        criteria: Object.fromEntries(input.options.map((o) => [o, input.descriptions?.[o] ?? null])),
      },
    },
  };
  for (let attempt = 0; ; attempt++) {
    const started = Date.now();
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.TYPESAFE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if ((res.status === 429 || res.status >= 500) && attempt < 4) {
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
      continue;
    }
    if (!res.ok) throw new Error(`Jev ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const json = await res.json();
    const answer = json.answers.category;
    return {
      choice: answer.choice ?? null,
      confidence: answer.confidence,
      probabilities: answer.probabilities,
      inputTokens: json.usage?.input_tokens ?? 0,
      ms: Date.now() - started,
    };
  }
}
