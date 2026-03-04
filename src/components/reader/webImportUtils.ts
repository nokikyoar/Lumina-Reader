export interface WebChunk {
  id: string;
  text: string;
}

const BLOCK_SELECTOR = 'h1,h2,h3,h4,h5,h6,p,li,blockquote,pre,code,figcaption';

export function extractReadableTextFromHtml(rawHtml: string): { title?: string; text: string } {
  if (!rawHtml.trim()) return { text: '' };

  const parser = new DOMParser();
  const doc = parser.parseFromString(rawHtml, 'text/html');

  doc.querySelectorAll('script,style,noscript,iframe,svg,canvas,template').forEach((node) => node.remove());

  const title = doc.title?.trim() || undefined;
  const root = doc.querySelector('main,article,[role="main"]') || doc.body;
  if (!root) return { title, text: '' };

  const blockTexts = Array.from(root.querySelectorAll(BLOCK_SELECTOR))
    .map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  const text = (blockTexts.length > 0 ? blockTexts.join('\n\n') : (root.textContent || ''))
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\s+/g, ' ')
    .trim();

  return { title, text };
}

export function chunkTextForRetrieval(text: string, targetSize = 800, overlap = 120, maxChunks = 80): WebChunk[] {
  const clean = text.trim();
  if (!clean) return [];

  const chunks: WebChunk[] = [];
  let cursor = 0;

  while (cursor < clean.length && chunks.length < maxChunks) {
    const end = Math.min(clean.length, cursor + targetSize);
    const slice = clean.slice(cursor, end);
    chunks.push({ id: `chunk-${chunks.length + 1}`, text: slice.trim() });
    if (end >= clean.length) break;
    cursor = Math.max(cursor + 1, end - overlap);
  }

  return chunks.filter((c) => c.text.length > 0);
}

export function pickRelevantChunks(chunks: WebChunk[], query: string, limit = 4): WebChunk[] {
  const q = query.toLowerCase().trim();
  if (!q) return chunks.slice(0, limit);

  const terms = Array.from(new Set(q.split(/\s+/).filter((t) => t.length > 1)));
  const scored = chunks.map((chunk) => {
    const lower = chunk.text.toLowerCase();
    const score = terms.reduce((acc, term) => acc + (lower.includes(term) ? 1 : 0), 0);
    return { chunk, score };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.chunk);
}
