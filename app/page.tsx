'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ApiMessage, Mode } from '@/lib/types';

type Variant = 'bot' | 'live';

interface ChatMsg {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  ui?: boolean; // display-only: never sent to the API
  variant?: Variant; // assistant styling + label
  showChips?: boolean; // render the quick-reply chips under this message
}

const GREETING =
  "Hey there, welcome to North Star Gear! I'm the North Star Support Bot. I can help you track an order, sort out a return or exchange, recommend the right gear, or connect you with a live agent. What can I do for you?";

const LIVE_GREETING =
  "You're now connected to North Star's live support team. I'm a simulated live agent for this demo, and I'm glad to help. You can tap “Return to bot” anytime to go back to the automated menu.";

const RETURN_GREETING =
  "You're back with the North Star Support Bot. How can I help? You can track an order, ask about returns, get a gear recommendation, or reach a live agent.";

const FLOWS = [
  { key: 'track', label: 'Track my order', send: "I'd like to track my order." },
  { key: 'returns', label: 'Returns & exchanges', send: 'I have a question about returns and exchanges.' },
  { key: 'recs', label: 'Product recommendations', send: 'Can you recommend some gear for me?' },
  { key: 'human', label: 'Talk to a human', send: null },
] as const;

type Flow = (typeof FLOWS)[number];

let idSeq = 0;
const nextId = () => ++idSeq;

function makeGreeting(): ChatMsg {
  return { id: nextId(), role: 'assistant', content: GREETING, variant: 'bot', ui: true, showChips: true };
}

export default function Page() {
  const [messages, setMessages] = useState<ChatMsg[]>(() => [makeGreeting()]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<Mode>('bot');

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) requestAnimationFrame(() => el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }));
  }, [messages, loading]);

  useEffect(() => {
    if (!loading) inputRef.current?.focus();
  }, [loading, mode]);

  const buildPayload = useCallback((history: ChatMsg[]): ApiMessage[] => {
    const real = history.filter((m) => !m.ui).map((m) => ({ role: m.role, content: m.content }));
    let start = 0;
    while (start < real.length && real[start].role === 'assistant') start++;
    return real.slice(start).slice(-20);
  }, []);

  const send = useCallback(
    async (text: string, currentMode: Mode) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;

      const userMsg: ChatMsg = { id: nextId(), role: 'user', content: trimmed.slice(0, 2000) };
      const history = [...messages, userMsg];
      setMessages(history);
      setInput('');
      setLoading(true);

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ messages: buildPayload(history), mode: currentMode }),
        });
        const data = await res.json().catch(() => null);
        const replyText: string =
          data && typeof data.reply === 'string' && data.reply.trim()
            ? data.reply.trim()
            : "Sorry, I didn't quite catch that. Want to try again, or I can connect you with a live agent?";
        const variant: Variant = currentMode === 'live_agent' ? 'live' : 'bot';
        const assistantMsg: ChatMsg = { id: nextId(), role: 'assistant', content: replyText, variant };

        if (data?.handoff && currentMode === 'bot') {
          setMode('live_agent');
          setMessages((prev) => [
            ...prev,
            assistantMsg,
            { id: nextId(), role: 'assistant', content: LIVE_GREETING, variant: 'live', ui: true },
          ]);
        } else {
          setMessages((prev) => [...prev, assistantMsg]);
        }
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: nextId(),
            role: 'assistant',
            content: "I'm having trouble reaching support right now. Please try again in a moment.",
            variant: currentMode === 'live_agent' ? 'live' : 'bot',
            ui: true,
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [messages, loading, buildPayload],
  );

  const handleFlow = (flow: Flow) => {
    if (loading) return;
    if (flow.key === 'human') {
      setMode('live_agent');
      setMessages((prev) => [
        ...prev,
        { id: nextId(), role: 'user', content: 'Talk to a human', ui: true },
        { id: nextId(), role: 'assistant', content: LIVE_GREETING, variant: 'live', ui: true },
      ]);
      return;
    }
    if (flow.send) send(flow.send, 'bot');
  };

  const returnToBot = () => {
    setMode('bot');
    setMessages((prev) => [
      ...prev,
      { id: nextId(), role: 'assistant', content: RETURN_GREETING, variant: 'bot', ui: true, showChips: true },
    ]);
  };

  const startOver = () => {
    setMode('bot');
    setInput('');
    idSeq = 0;
    setMessages([makeGreeting()]);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input, mode);
    }
  };

  const isLive = mode === 'live_agent';

  return (
    <div className="mx-auto flex h-dvh max-w-3xl flex-col">
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-sand/80 bg-cream/85 px-4 py-3 backdrop-blur sm:px-6">
        <StarMark />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[15px] font-semibold leading-tight text-pine-800">
            North Star Support Bot
          </h1>
          <StatusPill live={isLive} />
        </div>
        <button
          type="button"
          onClick={startOver}
          className="rounded-full border border-sand px-3 py-1.5 text-xs font-medium text-moss transition hover:border-pine-200 hover:text-pine-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-pine-500/40"
          aria-label="Start a new chat"
        >
          New chat
        </button>
      </header>

      {/* Live-agent banner */}
      {isLive && (
        <div className="flex items-center gap-3 border-b border-ember/30 bg-ember-soft px-4 py-2.5 text-sm sm:px-6">
          <span className="inline-flex h-6 w-6 flex-none items-center justify-center rounded-full bg-ember/15 text-ember-dark">
            <AgentGlyph />
          </span>
          <p className="flex-1 text-[13px] text-bark/80">
            You&apos;re with a <span className="font-semibold text-ember-dark">live agent (simulated)</span>.
          </p>
          <button
            type="button"
            onClick={returnToBot}
            className="rounded-full bg-pine-700 px-3 py-1.5 text-xs font-semibold text-cream transition hover:bg-pine-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-pine-500/50"
          >
            Return to bot
          </button>
        </div>
      )}

      {/* Messages */}
      <main
        ref={scrollRef}
        className="ns-scroll flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-6"
        aria-live="polite"
        aria-label="Conversation"
      >
        {messages.map((m) => (
          <div key={m.id}>
            <MessageRow message={m} />
            {m.showChips && !isLive && (
              <div className="mt-3 pl-11">
                <QuickReplies onPick={handleFlow} disabled={loading} />
              </div>
            )}
          </div>
        ))}
        {loading && <TypingRow live={isLive} />}
      </main>

      {/* Composer */}
      <footer className="border-t border-sand/80 bg-cream/85 px-4 pb-4 pt-3 backdrop-blur sm:px-6">
        {!isLive && (
          <div className="mb-2.5">
            <QuickReplies onPick={handleFlow} disabled={loading} compact />
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input, mode);
          }}
          className="flex items-end gap-2"
        >
          <div className="flex flex-1 items-end rounded-2xl border border-sand bg-white shadow-soft focus-within:border-pine-500/60 focus-within:ring-2 focus-within:ring-pine-500/20">
            <label htmlFor="composer" className="sr-only">
              Message
            </label>
            <textarea
              id="composer"
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              rows={1}
              maxLength={2000}
              placeholder={isLive ? 'Message the live agent...' : 'Ask about an order, a return, or gear...'}
              className="max-h-40 flex-1 resize-none bg-transparent px-4 py-3 text-[15px] leading-relaxed text-bark placeholder:text-moss/70 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="mb-0.5 inline-flex h-11 w-11 flex-none items-center justify-center rounded-2xl bg-pine-700 text-cream shadow-soft transition hover:bg-pine-800 disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-pine-500/50"
            aria-label="Send message"
          >
            <SendGlyph />
          </button>
        </form>

        <p className="mt-2 text-center text-[11px] leading-relaxed text-moss/80">
          North Star Support Bot can track orders, handle returns, recommend gear, or connect you with a person.
          Demo on fictional data.
        </p>
      </footer>
    </div>
  );
}

/* ---------------------------------- bits --------------------------------- */

function MessageRow({ message }: { message: ChatMsg }) {
  const isUser = message.role === 'user';
  if (isUser) {
    return (
      <div className="ns-rise flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-pine-700 px-4 py-2.5 text-[15px] leading-relaxed text-cream shadow-soft">
          {message.content}
        </div>
      </div>
    );
  }
  const isLive = message.variant === 'live';
  return (
    <div className="ns-rise flex items-start gap-3">
      <Avatar live={isLive} />
      <div className="max-w-[85%]">
        <span className="mb-1 block text-[11px] font-medium text-moss">
          {isLive ? 'Live Agent (simulated)' : 'North Star Bot'}
        </span>
        <div
          className={
            isLive
              ? 'whitespace-pre-wrap rounded-2xl rounded-tl-md border border-ember/30 bg-ember-soft px-4 py-2.5 text-[15px] leading-relaxed text-bark shadow-soft'
              : 'whitespace-pre-wrap rounded-2xl rounded-tl-md border border-sand bg-white px-4 py-2.5 text-[15px] leading-relaxed text-bark shadow-soft'
          }
        >
          {message.content}
        </div>
      </div>
    </div>
  );
}

function QuickReplies({
  onPick,
  disabled,
  compact,
}: {
  onPick: (flow: Flow) => void;
  disabled: boolean;
  compact?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {FLOWS.map((flow) => {
        const human = flow.key === 'human';
        return (
          <button
            key={flow.key}
            type="button"
            onClick={() => onPick(flow)}
            disabled={disabled}
            className={[
              'rounded-full border px-3.5 font-medium transition disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-pine-500/40',
              compact ? 'py-1.5 text-[12.5px]' : 'py-2 text-[13px]',
              human
                ? 'border-ember/40 bg-ember-soft text-ember-dark hover:border-ember hover:bg-ember/10'
                : 'border-pine-200 bg-white text-pine-700 hover:border-pine-500 hover:bg-pine-50',
            ].join(' ')}
          >
            {flow.label}
          </button>
        );
      })}
    </div>
  );
}

function TypingRow({ live }: { live: boolean }) {
  return (
    <div className="flex items-start gap-3">
      <Avatar live={live} />
      <div className="mt-5 inline-flex items-center gap-1.5 rounded-2xl rounded-tl-md border border-sand bg-white px-4 py-3 shadow-soft">
        <Dot delay="0s" />
        <Dot delay="0.15s" />
        <Dot delay="0.3s" />
      </div>
    </div>
  );
}

function Dot({ delay }: { delay: string }) {
  return <span className="ns-dot h-2 w-2 rounded-full bg-pine-500" style={{ animationDelay: delay }} />;
}

function Avatar({ live }: { live: boolean }) {
  if (live) {
    return (
      <span className="mt-6 inline-flex h-8 w-8 flex-none items-center justify-center rounded-full bg-ember/15 text-ember-dark ring-1 ring-ember/30">
        <AgentGlyph />
      </span>
    );
  }
  return (
    <span className="mt-6 inline-flex h-8 w-8 flex-none items-center justify-center rounded-full bg-pine-700 text-ember">
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
        <path d="M12 2.5l1.9 6.6 6.6 1.9-6.6 1.9L12 21.5l-1.9-6.6L3.5 11l6.6-1.9z" fill="currentColor" />
      </svg>
    </span>
  );
}

function StarMark() {
  return (
    <span className="inline-flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-pine-700 text-ember shadow-soft">
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path d="M12 2.5l1.9 6.6 6.6 1.9-6.6 1.9L12 21.5l-1.9-6.6L3.5 11l6.6-1.9z" fill="currentColor" />
        <circle cx="12" cy="11" r="1.1" fill="#F6F1E7" />
      </svg>
    </span>
  );
}

function StatusPill({ live }: { live: boolean }) {
  if (live) {
    return (
      <span className="mt-0.5 inline-flex items-center gap-1.5 text-[12px] font-medium text-ember-dark">
        <span className="h-1.5 w-1.5 rounded-full bg-ember" />
        Live Agent (simulated)
      </span>
    );
  }
  return (
    <span className="mt-0.5 inline-flex items-center gap-1.5 text-[12px] font-medium text-pine-600">
      <span className="h-1.5 w-1.5 rounded-full bg-pine-500" />
      Online
    </span>
  );
}

function AgentGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none">
      <path
        d="M5 11a7 7 0 0 1 14 0v4a3 3 0 0 1-3 3h-1"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <rect x="3.5" y="11" width="3" height="5" rx="1.3" fill="currentColor" />
      <rect x="17.5" y="11" width="3" height="5" rx="1.3" fill="currentColor" />
      <circle cx="12" cy="18.5" r="1.1" fill="currentColor" />
    </svg>
  );
}

function SendGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none">
      <path
        d="M4.5 12h13M12 6.5l6 5.5-6 5.5"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
