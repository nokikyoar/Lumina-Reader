import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Download, Highlighter as HighlightIcon, Pencil, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { Highlight } from '@/lib/db';

type HighlightColor = Highlight['color'];

const HIGHLIGHT_COLOR_STYLES: Record<HighlightColor, { dot: string; badge: string }> = {
  yellow: { dot: 'bg-yellow-400', badge: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  green: { dot: 'bg-green-400', badge: 'bg-green-100 text-green-800 border-green-200' },
  blue: { dot: 'bg-blue-400', badge: 'bg-blue-100 text-blue-800 border-blue-200' },
  red: { dot: 'bg-red-400', badge: 'bg-red-100 text-red-800 border-red-200' },
};

const HIGHLIGHT_FILTER_OPTIONS: Array<{ key: HighlightColor | 'all'; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'yellow', label: 'Yellow' },
  { key: 'green', label: 'Green' },
  { key: 'blue', label: 'Blue' },
  { key: 'red', label: 'Red' },
];

export function HighlightsPanel({
  active,
  styles,
  highlights,
  filteredHighlights,
  colorCounts,
  highlightColorFilter,
  onHighlightColorFilterChange,
  onExportHighlights,
  onHighlightClick,
  onDeleteHighlight,
  onUpdateHighlight,
}: {
  active: boolean;
  styles: { bg: string; sidebarBorder: string; subtleText: string; listItemHoverBg: string; noteCardBg: string; noteCardHoverBg: string; noteCardBorder: string };
  highlights: Highlight[];
  filteredHighlights: Highlight[];
  colorCounts: Record<HighlightColor, number>;
  highlightColorFilter: HighlightColor | 'all';
  onHighlightColorFilterChange: (value: HighlightColor | 'all') => void;
  onExportHighlights: () => void;
  onHighlightClick: (hl: Highlight) => void;
  onDeleteHighlight: (highlightId: string) => void;
  onUpdateHighlight: (highlightId: string, patch: Partial<Highlight>) => void;
}) {
  const [editingHighlightId, setEditingHighlightId] = useState<string | null>(null);
  const [highlightNoteDraft, setHighlightNoteDraft] = useState('');
  const [highlightColorDraft, setHighlightColorDraft] = useState<HighlightColor>('yellow');

  return (
    <div className={cn('absolute inset-0 transition-transform duration-300 ease-in-out flex flex-col', active ? 'translate-x-0' : 'translate-x-full', styles.bg)}>
      <div className={cn('border-b px-4 py-3 space-y-3', styles.sidebarBorder)}>
        <div className="flex flex-wrap gap-2">
          {HIGHLIGHT_FILTER_OPTIONS.map((option) => {
            const isActive = highlightColorFilter === option.key;
            const count = option.key === 'all' ? highlights.length : colorCounts[option.key];
            const colorBadge = option.key === 'all' ? 'bg-gray-100 text-gray-700 border-gray-200' : HIGHLIGHT_COLOR_STYLES[option.key].badge;
            return (
              <button key={option.key} onClick={() => onHighlightColorFilterChange(option.key)} className={cn('px-2.5 py-1 rounded-full text-xs border transition-all duration-200 hover:-translate-y-0.5 inline-flex items-center gap-1.5', colorBadge, isActive ? 'ring-2 ring-[#0052FF]/35 border-[#0052FF]/30' : 'opacity-80 hover:opacity-100')}>
                {option.key !== 'all' && <span className={cn('w-2 h-2 rounded-full', HIGHLIGHT_COLOR_STYLES[option.key].dot)} />}
                <span>{count}</span>
              </button>
            );
          })}
        </div>
        <button onClick={onExportHighlights} className={cn('w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-xs transition-all duration-200 hover:-translate-y-0.5', styles.listItemHoverBg)}>
          <Download className="w-3.5 h-3.5" />Export highlights (JSON + Markdown)
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {filteredHighlights.length === 0 ? (
          <div className={cn('flex flex-col items-center justify-center h-full text-center space-y-2', styles.subtleText)}>
            <HighlightIcon className="w-8 h-8" />
            <p className="text-sm">{highlights.length === 0 ? 'Select text in the book to add highlights and notes.' : 'No highlights under current filter.'}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredHighlights.map((hl, index) => {
              const isEditing = editingHighlightId === hl.id;
              return (
                <motion.div
                  key={hl.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22, delay: Math.min(index * 0.03, 0.16), ease: 'easeOut' }}
                  className={cn('p-3 rounded-xl text-sm transition-all border border-transparent', styles.noteCardBg, styles.noteCardHoverBg, styles.noteCardBorder)}
                >
                  <button onClick={() => onHighlightClick(hl)} className="w-full text-left">
                    <div className="flex gap-2 mb-2"><div className={cn('w-2 h-2 rounded-full mt-1.5 shrink-0', HIGHLIGHT_COLOR_STYLES[hl.color].dot)} /><p className="line-clamp-3 italic opacity-80">"{hl.text}"</p></div>
                  </button>
                  {isEditing ? (
                    <div className="space-y-2 ml-4">
                      <select value={highlightColorDraft} onChange={(e) => setHighlightColorDraft(e.target.value as HighlightColor)} className="w-full rounded-md border px-2 py-1 text-xs"><option value="yellow">Yellow</option><option value="green">Green</option><option value="blue">Blue</option><option value="red">Red</option></select>
                      <textarea value={highlightNoteDraft} onChange={(e) => setHighlightNoteDraft(e.target.value)} rows={4} placeholder="Write markdown note..." className="w-full rounded-md border px-2 py-1 text-xs" />
                      <div className="flex justify-end gap-2"><button onClick={() => setEditingHighlightId(null)} className={cn('text-xs px-2 py-1 rounded-md transition-all duration-200 hover:-translate-y-0.5', styles.listItemHoverBg)}>Cancel</button><button onClick={() => { onUpdateHighlight(hl.id, { color: highlightColorDraft, note: highlightNoteDraft.trim() || undefined }); setEditingHighlightId(null); }} className="text-xs px-2 py-1 rounded-md bg-[#0052FF] text-white transition-all duration-200 hover:-translate-y-0.5">Save</button></div>
                    </div>
                  ) : (
                    <>
                      {hl.note && <div className="ml-4 pl-2 border-l-2 border-[#0052FF]"><div className={cn('prose prose-sm max-w-none [&_p]:my-1 [&_li]:my-0.5 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:bg-black/10')}><ReactMarkdown>{hl.note}</ReactMarkdown></div></div>}
                      <div className="mt-2 flex justify-end gap-2"><button onClick={() => { setEditingHighlightId(hl.id); setHighlightColorDraft(hl.color); setHighlightNoteDraft(hl.note || ''); }} className={cn('inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-all duration-200 hover:-translate-y-0.5', styles.listItemHoverBg)}><Pencil className="w-3.5 h-3.5" />Edit</button><button onClick={() => onDeleteHighlight(hl.id)} className={cn('inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-all duration-200 hover:-translate-y-0.5', styles.listItemHoverBg)}><Trash2 className="w-3.5 h-3.5" />Delete</button></div>
                    </>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
