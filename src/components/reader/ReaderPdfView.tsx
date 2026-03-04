import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Document, Page, pdfjs } from 'react-pdf';
import { cn } from '@/lib/utils';
import { getPdfMaxWidth, ReaderLayoutWidth, ReaderThemePalette } from './readerUtils';

type ReadingMode = 'scroll' | 'paged';
type PdfRenderMeta = { view?: number[] };

interface ReaderPdfViewProps {
  file: string | ArrayBuffer;
  fontSize: number;
  theme: 'light' | 'dark' | 'sepia' | 'e-ink';
  styles: ReaderThemePalette;
  layoutWidth: ReaderLayoutWidth;
  location: string | number;
  setLocation: React.Dispatch<React.SetStateAction<string | number>>;
  setNumPages: React.Dispatch<React.SetStateAction<number>>;
  progress?: number;
  containerId?: string;
  readingMode: ReadingMode;
  onPageVisibleChange?: (page: number) => void;
  highlights?: Array<{ text: string; color: 'yellow' | 'green' | 'blue' | 'red'; page?: number }>;
}

const WINDOW_BEFORE = 3;
const WINDOW_AFTER = 5;
const PAGE_GAP = 16;
const PDF_HL_BG: Record<'yellow' | 'green' | 'blue' | 'red', string> = {
  yellow: 'rgba(250, 204, 21, 0.35)',
  green: 'rgba(74, 222, 128, 0.35)',
  blue: 'rgba(96, 165, 250, 0.35)',
  red: 'rgba(248, 113, 113, 0.30)',
};
const STOP_WORDS = new Set(['the', 'a', 'an', 'and', 'or', 'to', 'of', 'in', 'on', 'for', 'with', 'is', 'are', 'was', 'were', 'be', 'as', 'by', 'at', 'it']);

pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

export function ReaderPdfView({
  file,
  fontSize,
  theme,
  styles,
  layoutWidth,
  location,
  setLocation,
  setNumPages,
  progress,
  containerId = 'pdf-container',
  readingMode,
  onPageVisibleChange,
  highlights = [],
}: ReaderPdfViewProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [pageWidth, setPageWidth] = useState(600);
  const [loadedNumPages, setLoadedNumPages] = useState(0);
  const [isLoadingDocument, setIsLoadingDocument] = useState(true);
  const [docError, setDocError] = useState<string | null>(null);
  const [anchorPage, setAnchorPage] = useState(1);
  const [avgPageHeight, setAvgPageHeight] = useState(0);
  const [pdfHint, setPdfHint] = useState<string | null>(null);

  const hasInitializedLocationRef = useRef(false);
  const hasAppliedInitialScrollRef = useRef(false);
  const scrollRafRef = useRef<number | null>(null);
  const locationSyncUnlockTimerRef = useRef<number | null>(null);
  const isProgrammaticScrollRef = useRef(false);
  const lastReportedPageRef = useRef(0);
  const pageHeightsRef = useRef<Record<number, number>>({});

  const fileKey = useMemo(() => (typeof file === 'string' ? `url:${file}` : `buffer:${file.byteLength}`), [file]);
  const stableFile = useMemo(() => file, [fileKey, file]);
  const documentOptions = useMemo(() => ({ standardFontDataUrl: '/standard_fonts/', cMapUrl: '/cmaps/', cMapPacked: true }), []);

  const scale = fontSize / 100;
  const fallbackEstimatedHeight = useMemo(() => Math.max(280, pageWidth * scale * 1.42 + PAGE_GAP), [pageWidth, scale]);
  const estimatedPageHeight = avgPageHeight > 0 ? avgPageHeight : fallbackEstimatedHeight;

  useEffect(() => {
    hasInitializedLocationRef.current = false;
    hasAppliedInitialScrollRef.current = false;
    lastReportedPageRef.current = 0;
    pageHeightsRef.current = {};
    setAvgPageHeight(0);
    setLoadedNumPages(0);
    setAnchorPage(1);
    setDocError(null);
    setPdfHint(null);
    setIsLoadingDocument(true);
  }, [fileKey]);

  useEffect(() => {
    if (!pdfHint) return;
    const timer = window.setTimeout(() => setPdfHint(null), 2200);
    return () => window.clearTimeout(timer);
  }, [pdfHint]);

  useEffect(() => () => {
    if (scrollRafRef.current !== null) window.cancelAnimationFrame(scrollRafRef.current);
    if (locationSyncUnlockTimerRef.current !== null) window.clearTimeout(locationSyncUnlockTimerRef.current);
  }, []);

  const currentPage = useMemo(() => {
    if (loadedNumPages <= 0) return 1;
    if (typeof location !== 'number' || Number.isNaN(location)) return 1;
    return Math.min(Math.max(1, Math.floor(location)), loadedNumPages);
  }, [location, loadedNumPages]);

  useEffect(() => {
    const updateWidth = () => {
      const container = document.getElementById(containerId);
      if (!container) return;
      const horizontalPadding = window.innerWidth >= 1024 ? 180 : window.innerWidth >= 768 ? 120 : 32;
      const maxWidth = getPdfMaxWidth(layoutWidth);
      setPageWidth(Math.max(320, Math.min(maxWidth, container.clientWidth - horizontalPadding)));
    };
    window.addEventListener('resize', updateWidth);
    updateWidth();
    return () => window.removeEventListener('resize', updateWidth);
  }, [containerId, layoutWidth]);

  const getPageTopByDom = (page: number) => {
    const root = rootRef.current;
    if (!root) return null;
    const pageContainer = root.querySelector(`[data-page-marker="${page}"]`) as HTMLElement | null;
    if (!pageContainer) return null;
    return pageContainer.offsetTop;
  };

  const getPageFromVisibleCenter = () => {
    const root = rootRef.current;
    if (!root || loadedNumPages <= 0) return 1;
    const centerY = root.scrollTop + root.clientHeight * 0.5;

    let bestPage = 1;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let page = 1; page <= loadedNumPages; page += 1) {
      const pageTop = getPageTopByDom(page) ?? Math.max(0, (page - 1) * estimatedPageHeight);
      const pageCenter = pageTop + estimatedPageHeight * 0.5;
      const distance = Math.abs(pageCenter - centerY);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestPage = page;
      }
    }

    return bestPage;
  };

  useEffect(() => {
    if (readingMode !== 'scroll' || loadedNumPages <= 0) return;
    const root = rootRef.current;
    if (!root) return;

    const target = typeof location === 'number' ? Math.min(loadedNumPages, Math.max(1, Math.floor(location))) : 1;
    setAnchorPage((prev) => (prev === target ? prev : target));

    if (hasAppliedInitialScrollRef.current && target === lastReportedPageRef.current) return;
    if (isProgrammaticScrollRef.current) return;

    const domTop = getPageTopByDom(target);
    const fallbackTop = Math.max(0, (target - 1) * estimatedPageHeight);
    const targetTop = domTop ?? fallbackTop;
    const delta = Math.abs(root.scrollTop - targetTop);
    if (delta <= 4) return;

    isProgrammaticScrollRef.current = true;
    if (locationSyncUnlockTimerRef.current !== null) window.clearTimeout(locationSyncUnlockTimerRef.current);
    locationSyncUnlockTimerRef.current = window.setTimeout(() => {
      isProgrammaticScrollRef.current = false;
      locationSyncUnlockTimerRef.current = null;
    }, 420);

    const pageDistance = Math.abs(target - (lastReportedPageRef.current || target));
    const jumpLikeNavigation = pageDistance > 1;
    const scrollBehavior: ScrollBehavior = !hasAppliedInitialScrollRef.current ? 'auto' : jumpLikeNavigation ? 'auto' : 'smooth';

    if (scrollRafRef.current !== null) window.cancelAnimationFrame(scrollRafRef.current);
    scrollRafRef.current = window.requestAnimationFrame(() => {
      root.scrollTo({ top: targetTop, behavior: scrollBehavior });
      hasAppliedInitialScrollRef.current = true;
      lastReportedPageRef.current = target;
      window.setTimeout(() => {
        const pageContainer = root.querySelector(`[data-page-marker="${target}"]`) as HTMLElement | null;
        if (!pageContainer) return;
        const focusedSpan = findBestHighlightedSpan(pageContainer, target);
        if (!focusedSpan) return;
        const spanRect = focusedSpan.getBoundingClientRect();
        const rootRect = root.getBoundingClientRect();
        const visibleTop = rootRect.top + 24;
        const visibleBottom = rootRect.bottom - 24;
        const isVisible = spanRect.bottom >= visibleTop && spanRect.top <= visibleBottom;
        if (!isVisible) focusedSpan.scrollIntoView({ block: 'center', behavior: jumpLikeNavigation ? 'auto' : 'smooth' });
      }, 90);
      scrollRafRef.current = null;
    });
  }, [readingMode, location, loadedNumPages, estimatedPageHeight]);

  useEffect(() => {
    if (readingMode !== 'scroll') return;
    const root = rootRef.current;
    if (!root || loadedNumPages <= 0) return;

    const handleScroll = () => {
      if (scrollRafRef.current !== null) return;
      scrollRafRef.current = window.requestAnimationFrame(() => {
        const page = getPageFromVisibleCenter();
        setAnchorPage((prev) => (prev === page ? prev : page));
        if (!isProgrammaticScrollRef.current && page !== lastReportedPageRef.current) {
          lastReportedPageRef.current = page;
          onPageVisibleChange?.(page);
        }
        scrollRafRef.current = null;
      });
    };

    root.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => root.removeEventListener('scroll', handleScroll);
  }, [readingMode, loadedNumPages, estimatedPageHeight, onPageVisibleChange]);

  const visiblePages = useMemo(() => {
    if (readingMode === 'paged') return [currentPage];
    if (loadedNumPages <= 0) return [] as number[];
    const start = Math.max(1, anchorPage - WINDOW_BEFORE);
    const end = Math.min(loadedNumPages, anchorPage + WINDOW_AFTER);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }, [readingMode, currentPage, loadedNumPages, anchorPage]);

  const topSpacerHeight = useMemo(() => {
    if (readingMode !== 'scroll' || visiblePages.length === 0) return 0;
    return Math.max(0, (visiblePages[0] - 1) * estimatedPageHeight);
  }, [readingMode, visiblePages, estimatedPageHeight]);

  const bottomSpacerHeight = useMemo(() => {
    if (readingMode !== 'scroll' || visiblePages.length === 0 || loadedNumPages <= 0) return 0;
    const lastVisible = visiblePages[visiblePages.length - 1];
    return Math.max(0, (loadedNumPages - lastVisible) * estimatedPageHeight);
  }, [readingMode, visiblePages, loadedNumPages, estimatedPageHeight]);

  const normalizeToken = (value: string) => value.replace(/\s+/g, ' ').trim().toLowerCase();

  const buildHighlightCandidates = (text: string) => {
    const normalized = normalizeToken(text);
    if (!normalized || normalized.length < 2) return [] as string[];

    const words = normalized.split(' ').filter((w) => w.length >= 2 && !STOP_WORDS.has(w));
    const bigrams: string[] = [];
    for (let i = 0; i < words.length - 1; i += 1) {
      const phrase = `${words[i]} ${words[i + 1]}`;
      if (phrase.length >= 6) bigrams.push(phrase);
    }

    const longWords = words.filter((w) => w.length >= 5);
    return [normalized, ...bigrams, ...longWords].slice(0, 8);
  };

  const getPreparedHighlights = (pageNumber: number) => {
    return highlights
      .filter((h) => (h.page ? h.page === pageNumber : true))
      .map((h) => ({ ...h, candidates: buildHighlightCandidates(h.text || '') }))
      .filter((h) => h.candidates.length > 0)
      .sort((a, b) => (b.text?.length || 0) - (a.text?.length || 0));
  };

  const getSpanMatchScore = (token: string, candidates: string[]) => {
    return candidates.reduce((acc, candidate) => {
      if (token.includes(candidate)) return Math.max(acc, candidate.length + 4);
      if (candidate.includes(token) && token.length >= 5) return Math.max(acc, token.length);
      return acc;
    }, -1);
  };

  const findBestHighlightedSpan = (pageContainer: HTMLElement, pageNumber: number) => {
    const spans = Array.from(pageContainer.querySelectorAll('.textLayer span[data-lumina-hl="1"]')) as HTMLSpanElement[];
    if (spans.length === 0) return null;

    const prepared = getPreparedHighlights(pageNumber);
    if (prepared.length === 0) return spans[0] || null;

    let bestSpan: HTMLSpanElement | null = null;
    let bestScore = -1;

    spans.forEach((span) => {
      const token = normalizeToken(span.textContent || '');
      if (!token) return;
      prepared.forEach((item) => {
        const score = getSpanMatchScore(token, item.candidates);
        if (score > bestScore) {
          bestScore = score;
          bestSpan = span;
        }
      });
    });

    return bestSpan || spans[0] || null;
  };

  const applyPdfHighlightOverlay = (pageNumber: number) => {
    const root = rootRef.current;
    if (!root) return;
    const pageContainer = root.querySelector(`[data-page-marker="${pageNumber}"]`) as HTMLElement | null;
    if (!pageContainer) return;

    const spans = Array.from(pageContainer.querySelectorAll('.textLayer span')) as HTMLSpanElement[];
    if (spans.length === 0) return;

    spans.forEach((span) => {
      if (span.dataset.luminaHl === '1') {
        span.style.backgroundColor = '';
        span.style.borderRadius = '';
        span.style.boxShadow = '';
        delete span.dataset.luminaHl;
      }
    });

    const prepared = getPreparedHighlights(pageNumber);
    if (prepared.length === 0) return;

    spans.forEach((span) => {
      const token = normalizeToken(span.textContent || '');
      if (!token || token.length < 2) return;

      let best: (typeof prepared)[number] | null = null;
      let bestScore = -1;

      prepared.forEach((item) => {
        const score = getSpanMatchScore(token, item.candidates);
        if (score > bestScore) {
          best = item;
          bestScore = score;
        }
      });

      if (!best || bestScore < 6) return;
      span.style.backgroundColor = PDF_HL_BG[best.color];
      span.style.borderRadius = '2px';
      span.style.boxShadow = `0 0 0 1px ${PDF_HL_BG[best.color]}`;
      span.dataset.luminaHl = '1';
    });
  };

  const handlePageRenderSuccess = (pageNumber: number, page: PdfRenderMeta) => {
    if (readingMode === 'scroll') {
      const view = page.view;
      if (Array.isArray(view) && view.length >= 4) {
        const rawWidth = Math.max(1, (view[2] || 0) - (view[0] || 0));
        const rawHeight = Math.max(1, (view[3] || 0) - (view[1] || 0));
        const renderedHeight = Math.max(200, pageWidth * scale * (rawHeight / rawWidth) + PAGE_GAP);
        const prev = pageHeightsRef.current[pageNumber] || 0;
        if (Math.abs(prev - renderedHeight) >= 2) {
          pageHeightsRef.current[pageNumber] = renderedHeight;
          const values = Object.values(pageHeightsRef.current);
          if (values.length > 0) {
            const sample = values.slice(0, 18);
            const nextAvg = sample.reduce((sum, h) => sum + h, 0) / sample.length;
            setAvgPageHeight((old) => (Math.abs(old - nextAvg) >= 6 ? nextAvg : old));
          }
        }
      }
    }
    window.setTimeout(() => applyPdfHighlightOverlay(pageNumber), 0);
  };

  useEffect(() => {
    if (visiblePages.length === 0) return;
    const timer = window.setTimeout(() => {
      visiblePages.forEach((page) => applyPdfHighlightOverlay(page));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [highlights, visiblePages]);

  return (
    <div ref={rootRef} className="h-full w-full overflow-auto flex flex-col items-center pt-8 pb-20">
      <Document
        key={fileKey}
        file={stableFile}
        options={documentOptions}
        onLoadSuccess={({ numPages: totalPages }) => {
          setDocError(null);
          setIsLoadingDocument(false);
          setNumPages(totalPages);
          setLoadedNumPages(totalPages);
          if (hasInitializedLocationRef.current) return;
          hasInitializedLocationRef.current = true;
          if (typeof progress === 'number' && progress > 0 && progress <= 1) {
            setLocation(Math.min(totalPages, Math.max(1, Math.floor(progress * totalPages))));
            return;
          }
          if (typeof location !== 'number' || location < 1 || location > totalPages) setLocation(1);
        }}
        onLoadError={(error) => {
          setLoadedNumPages(0);
          hasInitializedLocationRef.current = false;
          setIsLoadingDocument(false);
          setDocError(error?.message || 'Failed to load PDF file.');
        }}
        loading={<div className="px-4 py-3 text-sm opacity-70">Loading PDF…</div>}
        className="shadow-xl"
      >
        <div className="flex flex-col gap-4">
          {readingMode === 'scroll' && topSpacerHeight > 0 && <div style={{ height: topSpacerHeight }} />}
          {visiblePages.map((pageNumber) => (
            <div key={pageNumber} data-page-marker={String(pageNumber)}>
              <Page
                pageNumber={pageNumber}
                width={pageWidth * scale}
                className={cn('transition-all', theme === 'dark' ? 'filter invert hue-rotate-180' : '')}
                loading={<div className="h-14 grid place-items-center text-xs opacity-60">Loading page {pageNumber}…</div>}
                onRenderSuccess={(p) => handlePageRenderSuccess(pageNumber, p as PdfRenderMeta)}
              />
            </div>
          ))}
          {readingMode === 'scroll' && bottomSpacerHeight > 0 && <div style={{ height: bottomSpacerHeight }} />}
        </div>
      </Document>

      {isLoadingDocument && !docError && (
        <div className={cn('fixed top-20 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full text-xs z-30', styles.floatingToastBg, styles.floatingToastText)}>
          Parsing PDF...
        </div>
      )}

      {pdfHint && !docError && !isLoadingDocument && (
        <div className={cn('fixed top-28 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full text-xs z-30', styles.floatingToastBg, styles.floatingToastText)}>
          {pdfHint}
        </div>
      )}

      {docError && <div className="fixed top-20 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full text-xs z-30 bg-red-500 text-white">PDF load failed: {docError}</div>}

      {readingMode === 'paged' && (
        <div className={cn('fixed bottom-6 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full flex items-center gap-6 backdrop-blur-md shadow-2xl z-20', styles.panelGlassBg, styles.panelGlassText)}>
          <button onClick={() => setLocation(Math.max(1, currentPage - 1))} disabled={currentPage <= 1} className="disabled:opacity-30 hover:text-brand-orange">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <span className="font-mono text-sm">{currentPage}</span>
          <button onClick={() => setLocation(Math.min(loadedNumPages || currentPage + 1, currentPage + 1))} disabled={loadedNumPages > 0 && currentPage >= loadedNumPages} className="disabled:opacity-30 hover:text-brand-orange">
            <ChevronRight className="w-6 h-6" />
          </button>
        </div>
      )}
    </div>
  );
}
