const BASE_URL = process.env["OPENAI_BASE_URL"] ?? "https://api.openai.com/v1";
const USE_OPENROUTER = BASE_URL.includes("openrouter.ai");
export const CHAT_MODEL =
  process.env["CHAT_MODEL"] ?? (USE_OPENROUTER ? "openai/gpt-4o" : "gpt-4o");
export const EMBED_MODEL =
  process.env["EMBED_MODEL"] ?? (USE_OPENROUTER ? "text-embedding-3-large" : "text-embedding-3-large");

function apiKey(): string {
  const preferred = USE_OPENROUTER
    ? process.env["OPENROUTER_API_KEY"]
    : process.env["OPENAI_API_KEY"];
  const k = preferred || process.env["OPENAI_API_KEY"] || process.env["OPENROUTER_API_KEY"];
  if (!k) throw new Error("Missing API key — set OPENAI_API_KEY or OPENROUTER_API_KEY");
  return k;
}

function authHeader(): string {
  return `Bearer ${apiKey()}`;
}

async function embedBatch(batch: string[]): Promise<number[][]> {
  const res = await fetch(`${BASE_URL}/embeddings`, {
    method: "POST",
    headers: { Authorization: authHeader(), "Content-Type": "application/json" },
    body: JSON.stringify({ model: EMBED_MODEL, input: batch }),
  });
  if (!res.ok) throw new Error(`Embedding failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { data: { embedding: number[]; index: number }[] };
  return [...json.data].sort((a, b) => a.index - b.index).map((d) => d.embedding);
}

/** Embeds all texts with batches sent in parallel (bounded concurrency). */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  const batches: string[][] = [];
  for (let i = 0; i < texts.length; i += 16) batches.push(texts.slice(i, i + 16));

  const results: number[][][] = new Array(batches.length);
  const CONCURRENCY = 6;
  let next = 0;
  async function worker() {
    while (true) {
      const i = next++;
      if (i >= batches.length) return;
      results[i] = await embedBatch(batches[i]!);
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, batches.length) }, () => worker()));
  return results.flat();
}

export async function chat(
  messages: { role: "system" | "user" | "assistant"; content: string }[],
  opts: { maxTokens?: number } = {},
): Promise<string> {
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: { Authorization: authHeader(), "Content-Type": "application/json" },
    body: JSON.stringify({
      model: CHAT_MODEL,
      reasoning_effort: "low",
      messages,
      ...(opts.maxTokens ? { max_completion_tokens: opts.maxTokens } : {}),
    }),
  });
  if (res.status === 429) throw new Error("Too many AI requests right now. Try again shortly.");
  if (res.status === 402) throw new Error("AI credits are exhausted.");
  if (!res.ok) throw new Error(`AI request failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { choices: { message: { content: string } }[] };
  return json.choices[0]?.message?.content ?? "";
}

export type WebSource = { title: string; url: string };

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

/** Answers a question using live web results (OpenRouter's online search). */
export async function chatWeb(
  messages: ChatMessage[],
  opts: { maxTokens?: number } = {},
): Promise<{ text: string; sources: WebSource[] }> {
  if (!USE_OPENROUTER) return { text: await chat(messages, opts), sources: [] };

  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: { Authorization: authHeader(), "Content-Type": "application/json" },
    body: JSON.stringify({
      model: `${CHAT_MODEL}:online`,
      reasoning_effort: "low",
      messages,
      ...(opts.maxTokens ? { max_completion_tokens: opts.maxTokens } : {}),
    }),
  });
  if (res.status === 429) throw new Error("Too many AI requests right now. Try again shortly.");
  if (res.status === 402) throw new Error("AI credits are exhausted.");
  if (!res.ok) throw new Error(`Web search failed: ${res.status} ${await res.text()}`);

  const json = (await res.json()) as {
    choices: {
      message: {
        content?: string;
        annotations?: { type?: string; url_citation?: { url?: string; title?: string } }[];
      }[];
    };
  };
  const raw = json.choices[0] as { message?: { content?: string; annotations?: { type?: string; url_citation?: { url?: string; title?: string } }[] } } | undefined;
  const message = raw?.message;
  const seen = new Set<string>();
  const sources: WebSource[] = [];
  for (const annotation of message?.annotations ?? []) {
    const citation = annotation.url_citation;
    if (annotation.type !== "url_citation" || !citation?.url || seen.has(citation.url)) continue;
    seen.add(citation.url);
    sources.push({ title: citation.title ?? citation.url, url: citation.url });
  }
  return { text: message?.content ?? "", sources };
}
