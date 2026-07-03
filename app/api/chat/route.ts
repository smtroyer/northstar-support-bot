import Anthropic from '@anthropic-ai/sdk';
import { lookupOrder } from '@/lib/orders';
import { getSystemPrompt } from '@/lib/systemPrompts';
import type { ApiMessage, Mode } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001';
const MAX_TOKENS = 1024;
const MAX_MESSAGES = 20; // cap history sent to the model
const MAX_MESSAGE_CHARS = 2000; // cap each message length
const MAX_TOOL_ITERATIONS = 3; // guard against tool-call loops

// --- Best-effort in-memory rate limit (defense-in-depth). ---------------
// Not distributed; resets on cold start. Real protection is the disabled
// key + input caps, but this stops trivial hammering within one instance.
const RL_WINDOW_MS = 60_000;
const RL_MAX = 30;
const hits = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < RL_WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear(); // crude memory bound
  return recent.length > RL_MAX;
}

// --- The one tool: exact order lookup. ----------------------------------
const ORDER_TOOL = {
  name: 'get_order_status',
  description:
    "Look up the current status of a customer's order by its order number. You must ALWAYS use this tool to answer any order-tracking question. Never guess or recall an order status without it.",
  input_schema: {
    type: 'object',
    properties: {
      order_number: {
        type: 'string',
        description:
          "The order number the customer gave, e.g. '111' or '#111'. Any surrounding text or symbols are fine; digits are extracted server-side.",
      },
    },
    required: ['order_number'],
  },
};

function json(data: { reply: string; handoff: boolean }, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function sanitizeMessages(raw: unknown): ApiMessage[] {
  if (!Array.isArray(raw)) return [];
  const out: ApiMessage[] = [];
  for (const m of raw) {
    if (!m || typeof m !== 'object') continue;
    const role = (m as Record<string, unknown>).role;
    const content = (m as Record<string, unknown>).content;
    if (role !== 'user' && role !== 'assistant') continue;
    if (typeof content !== 'string') continue;
    const trimmed = content.slice(0, MAX_MESSAGE_CHARS);
    if (!trimmed.trim()) continue;
    out.push({ role, content: trimmed });
  }
  // The Anthropic API requires the first message to be from the user.
  let start = 0;
  while (start < out.length && out[start].role === 'assistant') start++;
  return out.slice(start).slice(-MAX_MESSAGES);
}

export async function POST(req: Request): Promise<Response> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return json(
      { reply: 'The support assistant is not fully configured yet. Please try again later.', handoff: false },
      500,
    );
  }

  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'local';
  if (isRateLimited(ip)) {
    return json(
      { reply: "You're sending messages a little quickly. Give me a moment, then try again.", handoff: false },
      429,
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ reply: 'Sorry, I could not read that request.', handoff: false }, 400);
  }

  const mode: Mode = (body as Record<string, unknown>)?.mode === 'live_agent' ? 'live_agent' : 'bot';
  const messages = sanitizeMessages((body as Record<string, unknown>)?.messages);
  if (messages.length === 0) {
    return json(
      {
        reply:
          'What can I help you with? You can track an order, ask about returns, get a gear recommendation, or reach a live agent.',
        handoff: false,
      },
      200,
    );
  }

  const client = new Anthropic({ apiKey });
  const system = getSystemPrompt(mode);

  // Rebuild the conversation from scratch (validated text only). This prevents
  // a client from smuggling fake system/tool turns into the model call.
  const convo: Array<{ role: 'user' | 'assistant'; content: unknown }> = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  try {
    let finalText = '';

    for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
      const resp = await client.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system,
        tools: [ORDER_TOOL] as never,
        messages: convo as never,
      });

      const blocks = (resp.content || []) as unknown as Array<Record<string, unknown>>;
      const toolUses = blocks.filter((b) => b.type === 'tool_use');
      const textOut = blocks
        .filter((b) => b.type === 'text')
        .map((b) => String(b.text || ''))
        .join('\n')
        .trim();

      if (toolUses.length === 0) {
        finalText = textOut;
        break;
      }

      // Record the assistant's tool-call turn, then answer each tool call.
      convo.push({ role: 'assistant', content: resp.content });
      const toolResults = toolUses.map((tu) => {
        let result: unknown = { error: 'unknown tool' };
        if (tu.name === 'get_order_status') {
          const input = tu.input as Record<string, unknown> | undefined;
          const r = lookupOrder(input?.order_number);
          result = r.found
            ? { found: true, order_number: r.order_number, status: r.status, delivered: r.delivered }
            : { found: false, order_number: r.order_number, status: 'invalid order' };
        }
        return {
          type: 'tool_result' as const,
          tool_use_id: tu.id,
          content: JSON.stringify(result),
        };
      });
      convo.push({ role: 'user', content: toolResults });

      // On the last allowed iteration, fall back to whatever text we have.
      if (i === MAX_TOOL_ITERATIONS - 1) finalText = textOut;
    }

    if (!finalText) {
      finalText = 'Sorry, I hit a snag on my end. Would you like me to connect you with a live agent?';
    }

    // Model-initiated handoff signal: a [[HANDOFF]] token, stripped from output.
    const handoff = /\[\[handoff\]\]/i.test(finalText);
    const reply =
      finalText.replace(/\[\[handoff\]\]/gi, '').trim() ||
      "I'm connecting you with a live agent now. One moment!";

    return json({ reply, handoff }, 200);
  } catch (err) {
    console.error('[chat] error:', err);
    return json(
      { reply: "I'm having trouble reaching support right now. Please try again in a moment.", handoff: false },
      200,
    );
  }
}

// Reject anything that is not a POST with a clear message.
export async function GET(): Promise<Response> {
  return json({ reply: 'This endpoint accepts POST requests only.', handoff: false }, 405);
}
