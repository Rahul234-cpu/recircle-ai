import { Check } from 'lucide-react';
import { dateTime } from '../utils/format';

/** Vertical timeline of status history, with the expected flow shown greyed out. */
export default function StatusTimeline({ history = [], flow = [], current }) {
  const terminalBad = ['Cancelled', 'Rejected'].includes(current);
  const reached = new Map();
  history.forEach((h) => reached.set(h.status, h));
  const steps = terminalBad ? [...new Set(history.map((h) => h.status))] : flow;

  return (
    <ol className="relative space-y-5 border-l border-gray-200 pl-6">
      {steps.map((s) => {
        const h = reached.get(s);
        const done = Boolean(h);
        const isCurrent = s === current;
        return (
          <li key={s} className="relative">
            <span className={`absolute -left-[33px] flex h-[18px] w-[18px] items-center justify-center rounded-full ring-4 ring-white ${done ? (terminalBad && isCurrent ? 'bg-red-500' : 'bg-brand-600') : 'bg-gray-200'}`}>
              {done && <Check className="h-3 w-3 text-white" />}
            </span>
            <p className={`text-sm font-medium ${done ? 'text-ink' : 'text-gray-400'} ${isCurrent ? 'font-semibold' : ''}`}>{s}</p>
            {h && <p className="text-xs text-gray-500">{dateTime(h.at)}{h.note ? ` · ${h.note}` : ''}</p>}
          </li>
        );
      })}
    </ol>
  );
}
