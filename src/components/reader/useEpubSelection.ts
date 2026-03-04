import { useCallback, useEffect, useRef } from 'react';
import { Highlight } from '@/lib/db';
import { getEpubContentMaxWidth, ReaderLayoutWidth, Theme } from './readerUtils';

type RenditionRef = {
  annotations?: { add: (...args: unknown[]) => void };
  themes?: {
    register: (...args: unknown[]) => void;
    select: (...args: unknown[]) => void;
  };
  hooks?: {
    content?: { register: (cb: (contents: { document?: Document }) => void) => void };
  };
  on?: (...args: unknown[]) => void;
  getRange?: (cfiRange: string) => { toString: () => string };
};

interface UseEpubSelectionParams {
  theme: Theme;
  fontSize: number;
  layoutWidth: ReaderLayoutWidth;
  readingMode: 'scroll' | 'paged';
  highlights: Highlight[];
  setCurrentContext: (value: string) => void;
  setTempSelection: (value: { text: string; cfiRange?: string; txtStart?: number; txtEnd?: number } | null) => void;
  setSelectionPos: (value: { x: number; y: number } | null) => void;
}

const ACTIVE_THEME_NAME = 'lumina-reader-active-theme';
const CONTENT_STYLE_ID = 'lumina-reader-force-theme-style';
const MENU_GAP = 12;
const MENU_HALF_WIDTH = 140;

const EPUB_HIGHLIGHT_STYLE: Record<'yellow' | 'green' | 'blue' | 'red', Record<string, string>> = {
  yellow: { fill: '#facc15', 'fill-opacity': '0.32', 'mix-blend-mode': 'multiply' },
  green: { fill: '#4ade80', 'fill-opacity': '0.32', 'mix-blend-mode': 'multiply' },
  blue: { fill: '#60a5fa', 'fill-opacity': '0.32', 'mix-blend-mode': 'multiply' },
  red: { fill: '#f87171', 'fill-opacity': '0.3', 'mix-blend-mode': 'multiply' },
};

const getClampedSelectionMenuPosition = (rect: DOMRect) => {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  const rawX = rect.left + rect.width / 2;
  const rawY = rect.top - MENU_GAP;

  const x = Math.min(Math.max(rawX, MENU_HALF_WIDTH), Math.max(MENU_HALF_WIDTH, viewportWidth - MENU_HALF_WIDTH));
  const y = Math.min(Math.max(rawY, 56), viewportHeight - 24);

  return { x, y };
};

const getThemeTokens = (theme: Theme) => {
  if (theme === 'dark') {
    return {
      text: '#e2e8f0',
      heading: '#f8fafc',
      muted: '#cbd5e1',
      bg: '#020617',
      link: '#f59e0b',
      quote: '#94a3b8',
      codeBg: 'rgba(148,163,184,0.14)',
      border: 'rgba(148,163,184,0.35)',
      selectionBg: '#f59e0b',
      selectionText: '#0f172a',
    };
  }

  if (theme === 'sepia') {
    return {
      text: '#5b4636',
      heading: '#4c3a2a',
      muted: '#7d6452',
      bg: '#f4ecd8',
      link: '#b45309',
      quote: '#8a705d',
      codeBg: 'rgba(138,112,93,0.16)',
      border: 'rgba(138,112,93,0.3)',
      selectionBg: '#ea580c',
      selectionText: '#fff7e8',
    };
  }

  if (theme === 'e-ink') {
    return {
      text: '#171717',
      heading: '#0a0a0a',
      muted: '#525252',
      bg: '#f5f5f5',
      link: '#262626',
      quote: '#404040',
      codeBg: 'rgba(82,82,82,0.12)',
      border: 'rgba(23,23,23,0.35)',
      selectionBg: '#171717',
      selectionText: '#f5f5f5',
    };
  }

  return {
    text: '#111827',
    heading: '#0f172a',
    muted: '#374151',
    bg: '#ffffff',
    link: '#b45309',
    quote: '#4b5563',
    codeBg: 'rgba(17,24,39,0.08)',
    border: 'rgba(75,85,99,0.25)',
    selectionBg: '#ea580c',
    selectionText: '#ffffff',
  };
};

const applyContentThemeStyle = (doc: Document | undefined, theme: Theme) => {
  if (!doc?.head) return;

  const token = getThemeTokens(theme);
  const styleText = `
:root {
  color-scheme: ${theme === 'dark' ? 'dark' : 'light'};
  --lr-text: ${token.text};
  --lr-heading: ${token.heading};
  --lr-muted: ${token.muted};
  --lr-bg: ${token.bg};
  --lr-link: ${token.link};
  --lr-quote: ${token.quote};
  --lr-code-bg: ${token.codeBg};
  --lr-border: ${token.border};
  --lr-selection-bg: ${token.selectionBg};
  --lr-selection-text: ${token.selectionText};
}
html, body {
  background: var(--lr-bg) !important;
  background-color: var(--lr-bg) !important;
  color: var(--lr-text) !important;
}
body, body * {
  color: var(--lr-text) !important;
  border-color: var(--lr-border) !important;
}
/* 强制覆盖部分 EPUB 自带白底/黑字规则 */
body *:not(img):not(svg):not(video):not(canvas):not(iframe) {
  background: transparent !important;
  background-color: transparent !important;
}
a, a * {
  color: var(--lr-link) !important;
}
h1, h2, h3, h4, h5, h6,
strong, b,
[style*="font-weight: bold"] {
  color: var(--lr-heading) !important;
}
blockquote, q, cite {
  color: var(--lr-quote) !important;
}
code, pre, kbd, samp {
  color: var(--lr-text) !important;
  background-color: var(--lr-code-bg) !important;
}
hr, table, th, td {
  border-color: var(--lr-border) !important;
}
::selection {
  background: var(--lr-selection-bg) !important;
  color: var(--lr-selection-text) !important;
}
`;

  let styleEl = doc.getElementById(CONTENT_STYLE_ID) as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = doc.createElement('style');
    styleEl.id = CONTENT_STYLE_ID;
    doc.head.appendChild(styleEl);
  }
  if (styleEl.textContent !== styleText) {
    styleEl.textContent = styleText;
  }
};

export function useEpubSelection({
  theme,
  fontSize,
  layoutWidth,
  readingMode,
  highlights,
  setCurrentContext,
  setTempSelection,
  setSelectionPos,
}: UseEpubSelectionParams) {
  const selectedBoundRef = useRef<RenditionRef | null>(null);
  const previousRenditionRef = useRef<RenditionRef | null>(null);
  const appliedHighlightsRef = useRef<Set<string>>(new Set());
  const appliedThemeSignatureRef = useRef<string>('');
  const contentHookBoundRef = useRef<RenditionRef | null>(null);
  const contentSelectionHandlerBoundRef = useRef<WeakSet<Document>>(new WeakSet());

  const pendingStyleRef = useRef<{ theme: Theme; fontSize: number; layoutWidth: ReaderLayoutWidth; readingMode: 'scroll' | 'paged' } | null>(null);
  const latestThemeRef = useRef<Theme>(theme);
  const rafIdRef = useRef<number | null>(null);

  const flushPendingStyle = useCallback(() => {
    const rendition = previousRenditionRef.current;
    const pending = pendingStyleRef.current;
    if (!rendition || !pending) return;

    const { theme: nextTheme, fontSize: nextFontSize, layoutWidth: nextLayoutWidth, readingMode: nextReadingMode } = pending;
    const themeSignature = `${nextTheme}-${nextFontSize}-${nextLayoutWidth}-${nextReadingMode}`;
    if (appliedThemeSignatureRef.current === themeSignature) return;

    const bodyMaxWidth = nextReadingMode === 'paged' ? '100% !important' : `${getEpubContentMaxWidth(nextLayoutWidth)} !important`;
    const bodyPadding = nextReadingMode === 'paged' ? '20px 20px 28px !important' : '28px 24px 40px !important';
    const token = getThemeTokens(nextTheme);

    rendition.themes?.register(ACTIVE_THEME_NAME, {
      body: {
        color: `${token.text} !important`,
        background: `${token.bg} !important`,
        'background-color': `${token.bg} !important`,
        'font-family': 'Libre Baskerville, serif !important',
        'font-size': `${nextFontSize}% !important`,
        'line-height': '1.75 !important',
        width: '100% !important',
        'max-width': bodyMaxWidth,
        margin: '0 auto !important',
        padding: bodyPadding,
        'box-sizing': 'border-box !important',
      },
      'html, body': {
        width: '100% !important',
        'background-color': `${token.bg} !important`,
      },
      'div, section, article, main, p': {
        'max-width': '100% !important',
        color: `${token.text} !important`,
      },
      'img, svg, video, canvas': {
        'max-width': '100% !important',
        height: 'auto !important',
      },
      '::selection': { background: token.selectionBg, color: token.selectionText },
    });

    rendition.themes?.select(ACTIVE_THEME_NAME);

    const iframeDoc = document.querySelector('iframe')?.contentDocument;
    applyContentThemeStyle(iframeDoc, nextTheme);

    appliedThemeSignatureRef.current = themeSignature;
  }, []);

  useEffect(() => {
    latestThemeRef.current = theme;
  }, [theme]);

  const scheduleStyleApply = useCallback(() => {
    if (rafIdRef.current !== null) return;
    rafIdRef.current = window.requestAnimationFrame(() => {
      rafIdRef.current = null;
      flushPendingStyle();
      if (pendingStyleRef.current) {
        const nextSignature = `${pendingStyleRef.current.theme}-${pendingStyleRef.current.fontSize}-${pendingStyleRef.current.layoutWidth}-${pendingStyleRef.current.readingMode}`;
        if (appliedThemeSignatureRef.current !== nextSignature) {
          scheduleStyleApply();
        }
      }
    });
  }, [flushPendingStyle]);

  const attachRendition = useCallback(
    (rendition: RenditionRef | null) => {
      if (!rendition) return;

      if (previousRenditionRef.current !== rendition) {
        previousRenditionRef.current = rendition;
        appliedHighlightsRef.current.clear();
        appliedThemeSignatureRef.current = '';
      }

      if (contentHookBoundRef.current !== rendition) {
        contentHookBoundRef.current = rendition;
        rendition.hooks?.content?.register((contents) => {
          applyContentThemeStyle(contents.document, latestThemeRef.current);

          const doc = contents.document;
          if (!doc || contentSelectionHandlerBoundRef.current.has(doc)) return;
          contentSelectionHandlerBoundRef.current.add(doc);

          const clearWhenSelectionCollapsed = () => {
            const text = doc.defaultView?.getSelection?.()?.toString?.().trim() || '';
            if (text) return;
            setCurrentContext('');
            setTempSelection(null);
            setSelectionPos(null);
          };

          doc.addEventListener('selectionchange', clearWhenSelectionCollapsed);
          doc.addEventListener('mouseup', clearWhenSelectionCollapsed);
        });
      }

      pendingStyleRef.current = { theme, fontSize, layoutWidth, readingMode };
      scheduleStyleApply();

      highlights.forEach((hl) => {
        if (!hl.cfiRange) return;
        const key = `${hl.id}-${hl.cfiRange}-${hl.color}`;
        if (appliedHighlightsRef.current.has(key)) return;
        rendition.annotations?.add('highlight', hl.cfiRange, {}, undefined, `hl-${hl.color}`, EPUB_HIGHLIGHT_STYLE[hl.color]);
        appliedHighlightsRef.current.add(key);
      });

      if (selectedBoundRef.current !== rendition) {
        selectedBoundRef.current = rendition;
        rendition.on?.('selected', (cfiRange: string, contents?: { window?: Window; document?: Document }) => {
          const rangeText = rendition.getRange?.(cfiRange)?.toString?.() || '';
          const text = (rangeText || contents?.window?.getSelection?.()?.toString?.() || '').trim();

          if (!text) {
            setCurrentContext('');
            setTempSelection(null);
            setSelectionPos(null);
            return;
          }

          setCurrentContext(text);
          setTempSelection({ text, cfiRange });

          const selection = contents?.window?.getSelection?.();
          const rangeRect = selection && selection.rangeCount > 0 ? selection.getRangeAt(0).getBoundingClientRect() : null;
          const iframeRect = (contents?.document?.defaultView?.frameElement as HTMLElement | null)?.getBoundingClientRect() ?? document.querySelector('iframe')?.getBoundingClientRect();

          if (rangeRect && iframeRect) {
            const anchorRect = new DOMRect(iframeRect.left + rangeRect.left, iframeRect.top + rangeRect.top, rangeRect.width, rangeRect.height);
            setSelectionPos(getClampedSelectionMenuPosition(anchorRect));
            return;
          }

          if (iframeRect) {
            const fallbackRect = new DOMRect(iframeRect.left + iframeRect.width / 2 - 1, iframeRect.top + 120, 2, 20);
            setSelectionPos(getClampedSelectionMenuPosition(fallbackRect));
          }
        });
      }
    },
    [fontSize, highlights, layoutWidth, readingMode, scheduleStyleApply, setCurrentContext, setSelectionPos, setTempSelection, theme],
  );

  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        window.cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, []);

  return { attachRendition };
}
