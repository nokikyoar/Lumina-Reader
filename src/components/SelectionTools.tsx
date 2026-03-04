import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquarePlus, X, Check, Bot } from 'lucide-react';
import { cn } from '@/lib/utils';

type ReaderTheme = 'light' | 'dark' | 'sepia' | 'e-ink';

interface SelectionMenuProps {
  onHighlight: (color: 'yellow' | 'green' | 'blue' | 'red') => void;
  onNote: () => void;
  onAskAI: () => void;
  onClose: () => void;
  position: { x: number; y: number } | null;
  theme?: ReaderTheme;
}

export function SelectionMenu({ onHighlight, onNote, onAskAI, onClose, position, theme = 'light' }: SelectionMenuProps) {
  if (!position) return null;

  const isDark = theme === 'dark';
  const isEInk = theme === 'e-ink';
  const isSepia = theme === 'sepia';

  const menuBg = isDark
    ? 'bg-slate-900 border-slate-700 text-slate-100'
    : isEInk
      ? 'bg-[#f5f5f5] border-neutral-700 text-neutral-900'
      : isSepia
        ? 'bg-[#f4ecd8] border-[#cbb99a] text-[#5b4636]'
        : 'bg-white border-gray-100 text-gray-900';

  const iconHover = isDark
    ? 'hover:bg-white/10'
    : isEInk
      ? 'hover:bg-neutral-200'
      : isSepia
        ? 'hover:bg-[#eadfca]'
        : 'hover:bg-gray-100';

  const iconMuted = isDark ? 'text-slate-300' : isEInk ? 'text-neutral-700' : isSepia ? 'text-[#7d6452]' : 'text-gray-600';
  const iconClose = isDark ? 'text-slate-400' : isEInk ? 'text-neutral-600' : isSepia ? 'text-[#8a705d]' : 'text-gray-400';

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9 }}
        style={{ top: position.y - 60, left: position.x }}
        className={cn('selection-menu fixed z-50 rounded-full shadow-xl border p-1.5 flex items-center gap-1 -translate-x-1/2 transition-colors', menuBg)}
      >
        <div className={cn('flex items-center gap-1 border-r pr-2 mr-2', isDark ? 'border-slate-700' : isEInk ? 'border-neutral-600' : isSepia ? 'border-[#cbb99a]' : 'border-gray-200')}>
          {(['yellow', 'green', 'blue', 'red'] as const).map((color) => (
            <button
              key={color}
              onClick={() => onHighlight(color)}
              className="w-6 h-6 rounded-full hover:scale-110 transition-transform border border-black/10"
              style={{ backgroundColor: color === 'yellow' ? '#fef08a' : color === 'green' ? '#bbf7d0' : color === 'blue' ? '#bfdbfe' : '#fecaca' }}
            />
          ))}
        </div>
        <button onClick={onNote} className={cn('p-2 rounded-full transition-colors', iconHover, iconMuted)} title="Add Note">
          <MessageSquarePlus className="w-4 h-4" />
        </button>
        <button onClick={onAskAI} className={cn('p-2 rounded-full transition-colors text-brand-orange', iconHover)} title="Ask AI">
          <Bot className="w-4 h-4" />
        </button>
        <button onClick={onClose} className={cn('p-2 rounded-full transition-colors', iconHover, iconClose)}>
          <X className="w-4 h-4" />
        </button>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}

interface NoteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (note: string) => void;
  initialText?: string;
  theme?: ReaderTheme;
}

export function NoteDialog({ isOpen, onClose, onSave, initialText = '', theme = 'light' }: NoteDialogProps) {
  const [text, setText] = useState(initialText);

  useEffect(() => {
    if (!isOpen) return;
    setText(initialText || '');
  }, [isOpen, initialText]);

  if (!isOpen) return null;

  const isDark = theme === 'dark';
  const isEInk = theme === 'e-ink';
  const isSepia = theme === 'sepia';

  const cardTheme = isDark
    ? 'bg-slate-900 text-slate-100 border border-slate-700'
    : isEInk
      ? 'bg-[#f5f5f5] text-neutral-900 border border-neutral-700'
      : isSepia
        ? 'bg-[#f4ecd8] text-[#5b4636] border border-[#cbb99a]'
        : 'bg-white text-gray-900';

  const textareaTheme = isDark
    ? 'bg-slate-800 text-slate-100 placeholder-slate-500 focus:ring-slate-500/40'
    : isEInk
      ? 'bg-[#ebebeb] text-neutral-900 placeholder-neutral-500 focus:ring-neutral-500/40'
      : isSepia
        ? 'bg-[#f8f0de] text-[#5b4636] placeholder-[#8a705d] focus:ring-[#8a705d]/30'
        : 'bg-gray-50 text-gray-900 placeholder-gray-400 focus:ring-brand-orange/20';

  const footerTheme = isDark ? 'bg-slate-800/80 border-t border-slate-700' : isEInk ? 'bg-[#ebebeb] border-t border-neutral-700' : isSepia ? 'bg-[#eadfca] border-t border-[#cbb99a]' : 'bg-gray-50';

  return createPortal(
    <div className="note-dialog-root fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className={cn('rounded-2xl shadow-2xl w-full max-w-md overflow-hidden', cardTheme)}>
        <div className={cn('p-4 border-b flex justify-between items-center', isDark ? 'border-slate-700' : isEInk ? 'border-neutral-700' : isSepia ? 'border-[#cbb99a]' : 'border-gray-200')}>
          <h3 className="font-serif font-bold">Add Note (Markdown)</h3>
          <button onClick={onClose} className={cn('p-1 rounded-full transition-colors', isDark ? 'hover:bg-white/10 text-slate-400' : isEInk ? 'hover:bg-neutral-200 text-neutral-600' : isSepia ? 'hover:bg-[#eadfca] text-[#8a705d]' : 'hover:bg-gray-100 text-gray-400')}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Write markdown note here..."
            className={cn('w-full h-32 p-3 rounded-xl border-none focus:ring-2 outline-none resize-none', textareaTheme)}
            autoFocus
          />
          <p className="mt-2 text-xs opacity-70">Markdown supported: **bold**, *italic*, `code`, lists, links.</p>
        </div>
        <div className={cn('p-4 flex justify-end gap-2', footerTheme)}>
          <button onClick={onClose} className={cn('px-4 py-2 rounded-lg transition-colors', isDark ? 'text-slate-300 hover:bg-white/10' : isEInk ? 'text-neutral-700 hover:bg-neutral-200' : isSepia ? 'text-[#7d6452] hover:bg-[#ddceb2]' : 'text-gray-600 hover:bg-gray-200')}>
            Cancel
          </button>
          <button onClick={() => onSave(text)} className="px-4 py-2 bg-brand-orange text-white rounded-lg hover:bg-brand-orange/90 flex items-center gap-2">
            <Check className="w-4 h-4" /> Save Note
          </button>
        </div>
      </motion.div>
    </div>,
    document.body,
  );
}
