# North Star Support Bot

A customer support chatbot for **North Star Gear**, a small (fictional) online store that sells outdoor apparel and camping gear. It handles order tracking, returns and exchanges, product recommendations, and handoff to a live agent.

> **Live, testable version:** _[URL added after deploy]_
> No API key, account, subscription, or setup required. Open the link and start chatting.

All business data in this project is fictional and fixed. The bot uses only the data provided in the project spec.

---

## What it does (the four flows)

1. **Order tracking** — ask "where's my order?" and give an order number; the bot returns the exact status.
2. **Returns & exchanges** — explains the 30-day return policy and provides the returns link.
3. **Product recommendations** — asks a clarifying question or two, then recommends a gear category.
4. **Human handoff** — on request (or a repeated fallback), transitions to a simulated **Live Agent** state, with a one-click **Return to bot** path back to the automated menu.

It also recognizes varied phrasings ("track my package" vs "where is my order"), answers shipping questions, and gives a clear fallback with options when it does not understand.

### Mock data (the entire dataset)

| Order | Status |
| ----- | ------ |
| `#111` | Shipped, arriving tomorrow |
| `#222` | Processing, ships in 24 hours |
| `#333` | Delivered |
| anything else | Invalid order |

- **Return policy:** 30-day returns, items must be unused, original packaging required.
- **Shipping:** standard 3 to 5 business days; expedited 1 to 2 business days.

---

## Architecture

- **Next.js (App Router) + TypeScript + Tailwind CSS.** Single-page chat UI. No database, no auth, fully stateless (the conversation is sent with each request).
- **`/api/chat` (server-side).** Holds the Anthropic API key in an environment variable, never exposed to the browser. Builds the system prompt, calls the Claude API, and returns the reply.
- **Order lookup via tool use.** Claude calls a `get_order_status` tool; the server resolves it against a hardcoded map and returns the exact status. This guarantees order data is always correct rather than relying on the model to remember it.
- **Client-authoritative handoff.** The "Talk to a human" and "Return to bot" controls switch state directly on the client. The model can also initiate a handoff on a typed request via a stripped `[[HANDOFF]]` signal.
- **Model:** `claude-haiku-4-5-20251001` by default (override with the `ANTHROPIC_MODEL` env var).

```
app/
  page.tsx           chat UI (client component)
  layout.tsx         root layout + metadata
  globals.css        Tailwind + theme
  api/chat/route.ts  server route: Claude call + order tool loop
lib/
  orders.ts          hardcoded order map + lookup
  systemPrompts.ts   bot + live-agent prompts
  types.ts           shared types
```

---

## Run it locally

Requires Node 18.18+ (built and tested on Node 24).

```bash
# 1. install
npm install

# 2. add your key
cp .env.example .env.local
# then edit .env.local and set ANTHROPIC_API_KEY=sk-ant-...

# 3. run
npm run dev
# open http://localhost:3000
```

Get an API key at [console.anthropic.com](https://console.anthropic.com).

---

## Security notes

- The API key lives only in an environment variable (local `.env.local`, or a Vercel env var in production). It is never sent to the client and never committed. `.gitignore` excludes all `.env*` files.
- The `/api/chat` route validates and rebuilds the message history (accepting only `user`/`assistant` text), caps message length and history size, and rate-limits per instance.
- All chat content renders as escaped plain text (no `dangerouslySetInnerHTML`), and the app sets standard security headers (CSP, `X-Frame-Options`, `nosniff`, referrer and permissions policies).

---

## Deploy

Deployed on [Vercel](https://vercel.com). Set one environment variable, `ANTHROPIC_API_KEY` (and optionally `ANTHROPIC_MODEL`), then deploy. The build command and output are the Next.js defaults.
