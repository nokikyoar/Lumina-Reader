import { Book, getReaderMeta, saveReaderMeta } from '@/lib/db';

export type ReaderSearchCapability = {
  supported: boolean;
  locateSupported: boolean;
  reason?: string;
};

export type SearchResultItem = {
  id: string;
  start: number;
  end: number;
  matchText: string;
  preview: string;
  contextLabel: string;
  target?: {
    href?: string;
    page?: number;
    ratio?: number;
  };
};

export const getSearchCapability = (bookType: Book['type']): ReaderSearchCapability => {
  if (bookType === 'txt' || bookType === 'md') return { supported: true, locateSupported: true };
  if (bookType === 'epub') return { supported: true, locateSupported: true, reason: 'Currently searches by TOC entries (full-text search coming soon).' };
  if (bookType === 'pdf') return { supported: true, locateSupported: true, reason: 'Currently supports page-number search (text-layer search coming soon).' };
  if (bookType === 'web') return { supported: false, locateSupported: false, reason: 'Full-text search is not available in embedded web mode. Please use on-site search or extension bridge.' };
  return { supported: false, locateSupported: false, reason: 'This format is currently not supported.' };
};

const makePreview = (text: string, start: number, end: number) => {
  const previewStart = Math.max(0, start - 50);
  const previewEnd = Math.min(text.length, end + 80);
  return `${previewStart > 0 ? '…' : ''}${text.slice(previewStart, previewEnd).replace(/\s+/g, ' ').trim()}${previewEnd < text.length ? '…' : ''}`;
};

export const buildTextSearchResults = (opts: {
  text: string;
  query: string;
  caseSensitive: boolean;
  type: 'txt' | 'md';
  limit?: number;
}): SearchResultItem[] => {
  const { text, query, caseSensitive, type, limit = 500 } = opts;
  const keyword = query.trim();
  if (!keyword || !text) return [];

  const haystack = caseSensitive ? text : text.toLocaleLowerCase();
  const needle = caseSensitive ? keyword : keyword.toLocaleLowerCase();

  const results: SearchResultItem[] = [];
  let startAt = 0;
  let matchIndex = haystack.indexOf(needle, startAt);

  while (matchIndex >= 0 && results.length < limit) {
    const end = matchIndex + needle.length;
    const paragraphIndex = text.slice(0, matchIndex).split(/\n{2,}/).length;
    const lineNumber = text.slice(0, matchIndex).split('\n').length;

    results.push({
      id: `search-${matchIndex}-${end}`,
      start: matchIndex,
      end,
      matchText: text.slice(matchIndex, end),
      preview: makePreview(text, matchIndex, end),
      contextLabel: type === 'md' ? `段落 ${paragraphIndex} · 行 ${lineNumber}` : `段落 ${paragraphIndex}`,
      target: {
        ratio: matchIndex / Math.max(1, text.length),
      },
    });

    startAt = end;
    matchIndex = haystack.indexOf(needle, startAt);
  }

  return results;
};

export const buildEpubTocSearchResults = (opts: {
  toc: Array<{ label: string; href: string; subitems?: Array<{ label: string; href: string; subitems?: unknown[] }> }>;
  query: string;
  caseSensitive: boolean;
  limit?: number;
}): SearchResultItem[] => {
  const { toc, query, caseSensitive, limit = 200 } = opts;
  const keyword = query.trim();
  if (!keyword || !toc.length) return [];

  const results: SearchResultItem[] = [];
  const needle = caseSensitive ? keyword : keyword.toLocaleLowerCase();

  const walk = (nodes: Array<{ label: string; href: string; subitems?: Array<{ label: string; href: string; subitems?: unknown[] }> }>, depth: number) => {
    nodes.forEach((node, idx) => {
      if (results.length >= limit) return;
      const source = caseSensitive ? node.label : node.label.toLocaleLowerCase();
      if (source.includes(needle)) {
        results.push({
          id: `epub-toc-${depth}-${idx}-${node.href}`,
          start: 0,
          end: node.label.length,
          matchText: node.label,
          preview: node.label,
          contextLabel: `目录层级 ${depth}`,
          target: { href: node.href },
        });
      }
      if (node.subitems?.length) walk(node.subitems as Array<{ label: string; href: string; subitems?: Array<{ label: string; href: string; subitems?: unknown[] }> }>, depth + 1);
    });
  };

  walk(toc, 1);
  return results;
};

export const buildPdfPageSearchResults = (opts: { numPages: number; query: string; limit?: number }): SearchResultItem[] => {
  const { numPages, query, limit = 20 } = opts;
  const keyword = query.trim();
  if (!keyword || numPages <= 0) return [];

  const pageNum = Number(keyword);
  if (!Number.isFinite(pageNum)) return [];

  const normalized = Math.max(1, Math.min(numPages, Math.floor(pageNum)));
  return [
    {
      id: `pdf-page-${normalized}`,
      start: 0,
      end: keyword.length,
      matchText: keyword,
      preview: `跳转到第 ${normalized} 页`,
      contextLabel: `PDF 页码定位`,
      target: { page: normalized },
    },
  ].slice(0, limit);
};

export const getSearchCacheKey = (book: Book, query: string, caseSensitive: boolean) =>
  `reader.search.cache:${book.id}:${book.type}:${caseSensitive ? '1' : '0'}:${query.trim().toLocaleLowerCase()}`;

export async function loadSearchCache(book: Book, query: string, caseSensitive: boolean): Promise<SearchResultItem[] | null> {
  const key = getSearchCacheKey(book, query, caseSensitive);
  const cached = await getReaderMeta<{ results: SearchResultItem[]; updatedAt: number }>(key);
  if (!cached?.results || !Array.isArray(cached.results)) return null;
  return cached.results;
}

export async function saveSearchCache(book: Book, query: string, caseSensitive: boolean, results: SearchResultItem[]) {
  const key = getSearchCacheKey(book, query, caseSensitive);
  await saveReaderMeta(key, { results, updatedAt: Date.now() });
}
