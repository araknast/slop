import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { api } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import Avatar from './Avatar';

const MAX = 280;

export default function Composer({ parentId, placeholder = "What's happening?", onDone }: { parentId?: number; placeholder?: string; onDone?: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const m = useMutation({
    mutationFn: () => api.create(text.trim(), parentId),
    onSuccess: () => { setText(''); qc.invalidateQueries(); onDone?.(); },
  });
  if (!user) return null;
  const left = MAX - text.length;
  const pct = Math.min(text.length / MAX, 1);
  const C = 2 * Math.PI * 11;
  return (
    <div className="composer glass">
      <Avatar user={user} />
      <div className="composer-main">
        <textarea
          value={text} rows={parentId ? 2 : 3} placeholder={placeholder} maxLength={MAX + 50}
          onChange={(e) => { setText(e.target.value); e.target.style.height = 'auto'; e.target.style.height = `${e.target.scrollHeight}px`; }}
        />
        {m.error && <p className="error">{(m.error as Error).message}</p>}
        <div className="composer-bar">
          <svg width="28" height="28" viewBox="0 0 28 28" className="ring" aria-label={`${left} characters left`}>
            <circle cx="14" cy="14" r="11" className="ring-bg" />
            <circle cx="14" cy="14" r="11" className={`ring-fg ${left < 0 ? 'over' : left < 20 ? 'warn' : ''}`} strokeDasharray={C} strokeDashoffset={C * (1 - pct)} />
          </svg>
          {left < 20 && <span className={left < 0 ? 'over-text' : 'warn-text'}>{left}</span>}
          <motion.button whileTap={{ scale: 0.95 }} className="btn primary" disabled={!text.trim() || left < 0 || m.isPending} onClick={() => m.mutate()}>
            {parentId ? 'Reply' : 'Post'}
          </motion.button>
        </div>
      </div>
    </div>
  );
}
