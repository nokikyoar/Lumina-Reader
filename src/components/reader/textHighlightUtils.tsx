import React from 'react';
import { Highlight } from '@/lib/db';
import { cn } from '@/lib/utils';

export interface SearchMatchRange {
  id: string;
  start: number;
  end: number;
}

export function renderTxtContentWithHighlights(
  content: string,
  highlights: Highlight[],
  searchMatches: SearchMatchRange[] = [],
  activeSearchMatchId?: string,
) {
  const highlightRanges = highlights
    .filter((h) => h.txtStart !== undefined && h.txtEnd !== undefined)
    .map((h) => ({
      id: h.id,
      start: h.txtStart as number,
      end: h.txtEnd as number,
      className:
        h.color === 'yellow'
          ? 'bg-yellow-200'
          : h.color === 'green'
            ? 'bg-green-200'
            : h.color === 'blue'
              ? 'bg-blue-200'
              : 'bg-red-200',
      title: h.note,
      priority: 2,
    }));

  const searchRanges = searchMatches.map((m) => ({
    id: m.id,
    start: m.start,
    end: m.end,
    className: m.id === activeSearchMatchId ? 'bg-brand-orange/45 ring-1 ring-brand-orange/60 rounded-sm' : 'bg-brand-orange/25 rounded-sm',
    title: 'Search match',
    priority: 1,
  }));

  const allRanges = [...highlightRanges, ...searchRanges]
    .filter((item) => item.start >= 0 && item.end > item.start)
    .sort((a, b) => {
      if (a.start !== b.start) return a.start - b.start;
      if (a.priority !== b.priority) return b.priority - a.priority;
      return a.end - b.end;
    });

  if (allRanges.length === 0) return content;

  const elements: React.ReactNode[] = [];
  let cursor = 0;

  allRanges.forEach((range) => {
    if (range.start < cursor) return;

    if (range.start > cursor) {
      elements.push(content.slice(cursor, range.start));
    }

    elements.push(
      <span key={range.id} className={cn(range.className, 'text-inherit cursor-pointer')} title={range.title}>
        {content.slice(range.start, range.end)}
      </span>,
    );

    cursor = range.end;
  });

  if (cursor < content.length) {
    elements.push(content.slice(cursor));
  }

  return <>{elements}</>;
}
