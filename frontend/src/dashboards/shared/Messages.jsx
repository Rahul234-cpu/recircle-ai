import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Lock, MessageSquare, Send } from 'lucide-react';
import useFetch from '../../hooks/useFetch';
import { MiscAPI, errorMessage } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useNotifications } from '../../context/NotificationContext';
import { AsyncView, Avatar, EmptyState, Loader, PageHeader } from '../../components/ui';
import { inr, timeAgo } from '../../utils/format';

function Thread({ convKey, onBack }) {
  const { user } = useAuth();
  const toast = useToast();
  const { tick } = useNotifications();
  const { data, loading, error, refetch, setData } = useFetch(() => MiscAPI.thread(convKey), [convKey, tick]);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView(); }, [data?.messages?.length]);

  const send = async (e) => {
    e.preventDefault();
    if (!body.trim()) return;
    setSending(true);
    try {
      const { message } = await MiscAPI.sendMessage({ productId: data.product._id, recipientId: data.other._id, body: body.trim() });
      setData((d) => ({ ...d, messages: [...d.messages, message] }));
      setBody('');
      if (message.wasMasked) toast.info('Contact details were hidden — they unlock once the seller accepts an order.');
    } catch (err) { toast.error(errorMessage(err)); } finally { setSending(false); }
  };

  if (loading && !data) return <Loader />;
  if (error) return <p className="p-6 text-sm text-red-600">{error} <button type="button" className="underline" onClick={refetch}>Retry</button></p>;
  if (!data) return null;
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-gray-100 p-4">
        <button type="button" className="lg:hidden" onClick={onBack} aria-label="Back"><ArrowLeft className="h-5 w-5" /></button>
        <Avatar name={data.other?.name} src={data.other?.profileImage} />
        <div className="min-w-0 flex-1"><p className="font-semibold">{data.other?.name}</p>{data.product && <Link to={`/products/${data.product._id}`} className="block truncate text-xs text-brand-700">{data.product.title} · {inr(data.product.sellingPrice)}</Link>}</div>
      </div>
      {!data.contactUnlocked && <p className="flex items-center gap-2 bg-amber-50 px-4 py-2 text-xs text-amber-800"><Lock className="h-3.5 w-3.5" /> Phone numbers and emails are hidden until the seller accepts an order.</p>}
      <div className="flex-1 space-y-2 overflow-y-auto bg-canvas p-4">
        {data.messages.map((m) => {
          const mine = m.sender === user._id;
          return (
            <div key={m._id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${mine ? 'rounded-br-md bg-brand-700 text-white' : 'rounded-bl-md bg-white shadow-sm'}`}>
                <p className="whitespace-pre-line break-words">{m.body}</p>
                <p className={`mt-0.5 text-[10px] ${mine ? 'text-brand-100' : 'text-gray-400'}`}>{timeAgo(m.createdAt)}</p>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <form onSubmit={send} className="flex gap-2 border-t border-gray-100 p-3">
        <input className="input" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write a message…" maxLength={1000} aria-label="Message" />
        <button type="submit" className="btn-primary px-3" disabled={sending || !body.trim()} aria-label="Send"><Send className="h-4 w-4" /></button>
      </form>
    </div>
  );
}

export default function Messages() {
  const [params, setParams] = useSearchParams();
  const active = params.get('c');
  const { tick } = useNotifications();
  const { data, loading, error, refetch } = useFetch(() => MiscAPI.conversations(), [tick]);
  const list = data?.conversations || [];

  return (
    <>
      <PageHeader title="Messages" subtitle="Chat with buyers and sellers. Your contact details stay private until an order is accepted." />
      <AsyncView loading={loading && !data} error={error} onRetry={refetch} empty={!list.length && !active} emptyProps={{ icon: MessageSquare, title: 'No conversations yet', message: 'Message a seller from any product page.' }}>
        <div className="card grid h-[calc(100vh-15rem)] min-h-[420px] overflow-hidden lg:grid-cols-[320px_1fr]">
          <div className={`overflow-y-auto border-r border-gray-100 ${active ? 'hidden lg:block' : ''}`}>
            {list.map((c) => (
              <button key={c.key} type="button" onClick={() => setParams({ c: c.key })} className={`flex w-full items-center gap-3 border-b border-gray-50 p-4 text-left hover:bg-gray-50 ${active === c.key ? 'bg-brand-50/60' : ''}`}>
                <Avatar name={c.other?.name} src={c.other?.profileImage} />
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between gap-2"><p className="truncate text-sm font-semibold">{c.other?.name}</p><span className="shrink-0 text-[11px] text-gray-400">{timeAgo(c.lastAt)}</span></div>
                  <p className="truncate text-xs text-brand-700">{c.product?.title}</p>
                  <p className="truncate text-xs text-gray-500">{c.lastMessage}</p>
                </div>
                {c.unread > 0 && <span className="rounded-full bg-brand-700 px-2 text-xs font-bold text-white">{c.unread}</span>}
              </button>
            ))}
          </div>
          <div className={active ? '' : 'hidden lg:block'}>
            {active ? <Thread key={active} convKey={active} onBack={() => setParams({})} /> : <div className="flex h-full items-center justify-center p-6"><EmptyState icon={MessageSquare} title="Select a conversation" /></div>}
          </div>
        </div>
      </AsyncView>
    </>
  );
}
