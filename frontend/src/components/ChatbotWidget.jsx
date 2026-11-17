import { useEffect, useRef, useState } from 'react';
import { Bot, MessageCircle, Send, X } from 'lucide-react';
import { AiAPI, errorMessage } from '../services/api';
import { Spinner } from './ui';

const STARTERS = ['How do I sell my waste?', 'How is the waste price calculated?', 'Do collectors see my address?', 'How do I sell a used product?'];

export default function ChatbotWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "Hi! I'm the ReCircle assistant. Ask me about waste pickups, rates, listings, orders or your account." },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [suggestions, setSuggestions] = useState(STARTERS);
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, open]);

  const send = async (text) => {
    const msg = (text ?? input).trim();
    if (!msg || busy) return;
    setInput('');
    const history = messages.slice(-8).map(({ role, content }) => ({ role, content }));
    setMessages((m) => [...m, { role: 'user', content: msg }]);
    setBusy(true);
    try {
      const res = await AiAPI.chat({ message: msg, history });
      setMessages((m) => [...m, { role: 'assistant', content: res.answer, sources: res.sources }]);
      setSuggestions(res.suggestions || []);
    } catch (err) {
      setMessages((m) => [...m, { role: 'assistant', content: errorMessage(err, 'Sorry, the assistant is unavailable right now.'), error: true }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {open && (
        <div className="fixed bottom-24 right-4 z-[800] flex h-[32rem] max-h-[75vh] w-[22rem] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-2xl sm:right-6">
          <div className="flex items-center justify-between bg-brand-700 px-4 py-3 text-white">
            <div className="flex items-center gap-2"><Bot className="h-5 w-5" /><div><p className="text-sm font-semibold">ReCircle Assistant</p><p className="text-[11px] text-brand-100">Answers from our help centre</p></div></div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close chat"><X className="h-5 w-5" /></button>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto bg-canvas p-4">
            {messages.map((m, i) => (
              // eslint-disable-next-line react/no-array-index-key
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] whitespace-pre-line rounded-2xl px-3.5 py-2.5 text-sm ${m.role === 'user' ? 'rounded-br-md bg-brand-700 text-white' : `rounded-bl-md bg-white text-ink shadow-sm ${m.error ? 'text-red-600' : ''}`}`}>
                  {m.content}
                  {m.sources?.length > 0 && <p className="mt-1.5 text-[11px] text-gray-400">Source: {m.sources[0].title}</p>}
                </div>
              </div>
            ))}
            {busy && <div className="flex items-center gap-2 text-xs text-gray-500"><Spinner className="h-4 w-4" /> Thinking…</div>}
            <div ref={endRef} />
          </div>
          {suggestions.length > 0 && (
            <div className="flex gap-2 overflow-x-auto border-t border-gray-100 px-3 py-2">
              {suggestions.map((s) => <button key={s} type="button" onClick={() => send(s)} className="whitespace-nowrap rounded-full border border-brand-200 px-3 py-1 text-xs text-brand-800 hover:bg-brand-50">{s}</button>)}
            </div>
          )}
          <form className="flex gap-2 border-t border-gray-100 p-3" onSubmit={(e) => { e.preventDefault(); send(); }}>
            <input className="input" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Type your question…" maxLength={800} aria-label="Message" />
            <button type="submit" className="btn-primary px-3" disabled={busy || !input.trim()} aria-label="Send"><Send className="h-4 w-4" /></button>
          </form>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-5 right-4 z-[800] flex h-14 w-14 items-center justify-center rounded-full bg-brand-700 text-white shadow-lift transition hover:bg-brand-800 sm:right-6"
        aria-label={open ? 'Close assistant' : 'Open assistant'}
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>
    </>
  );
}
