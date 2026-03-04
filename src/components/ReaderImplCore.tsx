import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Book, Bookmark, Highlight, ReaderStateSnapshot, getReaderMeta, normalizeReaderStateSnapshot, saveReaderMeta } from '@/lib/db';
import { cn } from '@/lib/utils';
import { pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { ReaderLayoutWidth, SidebarTab, Theme, buildReaderStyles, extractHeadings, getThemeStyles, validateReaderThemePalette } from './reader/readerUtils';
import { ReaderSidebar } from './reader/ReaderSidebar';
import { useReaderProgress } from './reader/useReaderProgress';
import { SearchMatchRange } from './reader/textHighlightUtils';
import { useEpubSelection } from './reader/useEpubSelection';
import {
  EpubTocItem,
  getInitialLayoutWidth,
  getInitialReadingMode,
  getInitialSidebarPositionMode,
  getTextPagedPagesPerView,
  LAYOUT_WIDTH_STORAGE_KEY,
  ReadingMode,
  READING_MODE_STORAGE_KEY,
  RenditionRef,
  SIDEBAR_POSITION_STORAGE_KEY,
  SidebarPositionMode,
} from './reader/readerShared';
import { useReaderSearch } from './reader/useReaderSearch';
import { useReaderSelection } from './reader/useReaderSelection';
import { ReaderMainContent } from './reader/ReaderMainContent';
import { useReaderBookmarks } from './reader/useReaderBookmarks';
import { useReadingSpeedEstimator } from './reader/useReadingSpeedEstimator';
import { exportHighlights } from './reader/exportHighlights';
import { useWebBridge } from './reader/useWebBridge';

import 'pdfjs-dist/build/pdf.worker.min.mjs';

pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

interface ReaderProps {
  book: Book;
  onBack: () => void;
}

export function Reader({ book, onBack }: ReaderProps) {
  const persistedState = normalizeReaderStateSnapshot(book.readerState);
  const initialReadingMode = persistedState?.readingMode ?? getInitialReadingMode();

  const [showSidebar, setShowSidebar] = useState(() => persistedState?.showSidebar ?? true);
  const [activeTab, setActiveTab] = useState<SidebarTab>(() => persistedState?.activeTab ?? 'chat');
  const [theme, setTheme] = useState<Theme>(() => persistedState?.theme ?? 'light');
  const [fontSize, setFontSize] = useState(() => persistedState?.fontSize ?? 100);
  const [layoutWidth, setLayoutWidth] = useState<ReaderLayoutWidth>(() => persistedState?.layoutWidth ?? getInitialLayoutWidth());
  const [readingMode, setReadingMode] = useState<ReadingMode>(initialReadingMode);
  const [location, setLocation] = useState<string | number>(() => {
    if (persistedState?.lastLocation !== undefined) return persistedState.lastLocation;
    const modeProgress = typeof book.readingProgress?.[initialReadingMode] === 'number' ? book.readingProgress?.[initialReadingMode] : undefined;
    return modeProgress ?? book.progress ?? 0;
  });
  const [epubToc, setEpubToc] = useState<EpubTocItem[]>([]);
  const [sidebarPositionMode, setSidebarPositionMode] = useState<SidebarPositionMode>(() => persistedState?.sidebarPositionMode ?? getInitialSidebarPositionMode());
  const [epubReady, setEpubReady] = useState(false);
  const [epubRetryNonce, setEpubRetryNonce] = useState(0);
  const [epubAttempt, setEpubAttempt] = useState(0);
  const [epubHardError, setEpubHardError] = useState(false);
  const [epubLoadedOnce, setEpubLoadedOnce] = useState(false);
  const renditionRef = useRef<RenditionRef>(null);
  const txtContainerRef = useRef<HTMLDivElement>(null);
  const webIframeRef = useRef<HTMLIFrameElement | null>(null);
  const webBridgeSourceWindowRef = useRef<Window | null>(null);

  const [highlights, setHighlights] = useState<Highlight[]>(() => {
    const seen = new Set();
    return (book.highlights || []).filter((h) => {
      if (seen.has(h.id)) return false;
      seen.add(h.id);
      return true;
    });
  });

  const [bookmarks, setBookmarks] = useState<Bookmark[]>(() => {
    const seen = new Set();
    return (book.bookmarks || []).filter((b) => {
      if (seen.has(b.id)) return false;
      seen.add(b.id);
      return true;
    });
  });

  const [highlightColorFilter, setHighlightColorFilter] = useState<'all' | 'yellow' | 'green' | 'blue' | 'red'>(() => persistedState?.highlightColorFilter ?? 'all');
  const [persistTelemetry, setPersistTelemetry] = useState<{
    lastSuccessAt: number | null;
    lastFailureAt: number | null;
    retryCount: number;
    failureCount: number;
    consecutiveFailureCount: number;
    backoffLevel: 0 | 1 | 2;
    cooldownUntil: number | null;
    lastReason: string | null;
  }>({
    lastSuccessAt: null,
    lastFailureAt: null,
    retryCount: 0,
    failureCount: 0,
    consecutiveFailureCount: 0,
    backoffLevel: 0,
    cooldownUntil: null,
    lastReason: null,
  });
  const [numPages, setNumPages] = useState(0);
  const [layoutTick, setLayoutTick] = useState(0);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const pageCacheRef = useRef(new Map<string, { total: number; headingPageMap: Record<string, number> }>());
  const [markdownHeadingPageMap, setMarkdownHeadingPageMap] = useState<Record<string, number>>({});

  const pageCacheKey = useMemo(
    () => `${book.id}:${book.type}:${readingMode}:${fontSize}:${layoutWidth}:${theme}`,
    [book.id, book.type, readingMode, fontSize, layoutWidth, theme],
  );

  const markdownToc = useMemo(() => (book.type === 'md' && typeof book.content === 'string' ? extractHeadings(book.content) : []), [book.content, book.type]);
  const readerContent = useMemo(() => book.content, [book.content]);
  const isWeb = book.type === 'web';

  const searchableText = useMemo(() => {
    if ((book.type === 'txt' || book.type === 'md') && typeof book.content === 'string') return book.content;
    return '';
  }, [book.type, book.content]);
  const textPagedPagesPerView = useMemo(() => getTextPagedPagesPerView(layoutWidth), [layoutWidth]);
  const isEpub = book.type === 'epub';
  const styles = validateReaderThemePalette(getThemeStyles(theme));
  const readerStyles = buildReaderStyles(theme);

  const textPagedMetrics = useMemo(() => {
    if (!txtContainerRef.current || (book.type !== 'txt' && book.type !== 'md' && book.type !== 'web') || readingMode !== 'paged') return { current: 1, total: 1 };
    const container = txtContainerRef.current;
    const pageWidth = Math.max(container.clientWidth / textPagedPagesPerView, 1);
    const cachedTotal = pageCacheRef.current.get(pageCacheKey)?.total;
    const total = cachedTotal ?? Math.max(1, Math.ceil(container.scrollWidth / pageWidth));
    const current = Math.min(total, Math.max(1, Math.floor(container.scrollLeft / pageWidth) + 1));
    return { current, total };
  }, [book.type, readingMode, location, layoutTick, pageCacheKey, textPagedPagesPerView]);

  const hasRestoredTextScrollRef = useRef(false);
  const textPagedProgressRef = useRef(0);
  const restorePagedFrameRef = useRef<number | null>(null);
  const epubRelayoutFrameRef = useRef<number | null>(null);

  const getNormalizedProgress = useCallback(() => {
    if ((book.type === 'txt' || book.type === 'md' || book.type === 'web') && txtContainerRef.current) {
      const container = txtContainerRef.current;
      if (readingMode === 'paged') {
        const maxLeft = Math.max(1, container.scrollWidth - container.clientWidth);
        return Math.min(1, Math.max(0, container.scrollLeft / maxLeft));
      }
      const maxTop = Math.max(1, container.scrollHeight - container.clientHeight);
      return Math.min(1, Math.max(0, container.scrollTop / maxTop));
    }

    if (book.type === 'pdf' && typeof location === 'number' && numPages > 0) {
      return Math.min(1, Math.max(0, location / numPages));
    }

    if (book.type === 'epub') {
      if (typeof renditionRef.current?.location?.start?.percentage === 'number') {
        return Math.min(1, Math.max(0, renditionRef.current.location.start.percentage));
      }
      if (typeof location === 'number' && location <= 1) {
        return Math.min(1, Math.max(0, location));
      }
    }

    return 0;
  }, [book.type, location, numPages, readingMode]);

  useEffect(() => {
    void getReaderMeta<{
      lastSuccessAt: number | null;
      lastFailureAt: number | null;
      retryCount: number;
      failureCount: number;
      consecutiveFailureCount: number;
      backoffLevel: 0 | 1 | 2;
      cooldownUntil: number | null;
      lastReason: string | null;
    }>(`reader.persist.telemetry:${book.id}`).then((value) => {
      if (!value) return;
      setPersistTelemetry((prev) => ({
        ...prev,
        ...value,
      }));
    });
  }, [book.id]);

  useEffect(() => {
    setEpubReady(false);
    setEpubHardError(false);
    setEpubLoadedOnce(false);
    const timer = window.setTimeout(() => setEpubReady(true), 120);
    return () => window.clearTimeout(timer);
  }, [book.id, book.type, readingMode, epubRetryNonce]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(SIDEBAR_POSITION_STORAGE_KEY, sidebarPositionMode);
  }, [sidebarPositionMode]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(LAYOUT_WIDTH_STORAGE_KEY, layoutWidth);
  }, [layoutWidth]);

  useEffect(() => {
    if ((isEpub || isWeb) && readingMode !== 'scroll') {
      setReadingMode('scroll');
      return;
    }
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(READING_MODE_STORAGE_KEY, readingMode);
  }, [isEpub, isWeb, readingMode]);

  useEffect(() => {
    const latestState = book.readerState;
    if (latestState?.lastLocation !== undefined) {
      setLocation(latestState.lastLocation);
      return;
    }

    const modeProgress = book.readingProgress?.[readingMode];
    if (typeof modeProgress === 'number') {
      setLocation(modeProgress);
      return;
    }
    if (typeof book.progress === 'number' || typeof book.progress === 'string') {
      setLocation(book.progress);
    }
  }, [book.id, book.progress, book.readingProgress, book.readerState, readingMode]);

  useEffect(() => {
    hasRestoredTextScrollRef.current = false;
    if (restorePagedFrameRef.current !== null) {
      window.cancelAnimationFrame(restorePagedFrameRef.current);
      restorePagedFrameRef.current = null;
    }
    if (epubRelayoutFrameRef.current !== null) {
      window.cancelAnimationFrame(epubRelayoutFrameRef.current);
      epubRelayoutFrameRef.current = null;
    }
  }, [book.id, book.type, readingMode]);

  useEffect(() => {
    if (hasRestoredTextScrollRef.current) return;
    if ((book.type !== 'txt' && book.type !== 'md' && book.type !== 'web') || typeof location !== 'number' || !txtContainerRef.current) return;

    const container = txtContainerRef.current;

    if (readingMode === 'paged') {
      const normalizedTarget = location <= 1
        ? Math.min(1, Math.max(0, location))
        : Math.min(1, Math.max(0, location / Math.max(1, container.scrollWidth - container.clientWidth)));

      textPagedProgressRef.current = normalizedTarget;

      const applyPagedPosition = () => {
        const maxLeft = Math.max(0, container.scrollWidth - container.clientWidth);
        container.scrollLeft = normalizedTarget * maxLeft;
        hasRestoredTextScrollRef.current = true;
        setLayoutTick((t) => t + 1);
      };

      restorePagedFrameRef.current = window.requestAnimationFrame(() => {
        restorePagedFrameRef.current = window.requestAnimationFrame(() => {
          applyPagedPosition();
          restorePagedFrameRef.current = null;
        });
      });

      return;
    }

    if (location <= 1) {
      const scrollHeight = container.scrollHeight - container.clientHeight;
      container.scrollTop = location * Math.max(0, scrollHeight);
    } else {
      container.scrollTop = location;
    }
    hasRestoredTextScrollRef.current = true;
    setLayoutTick((t) => t + 1);
  }, [book.type, location, readingMode, textPagedPagesPerView]);

  useEffect(() => {
    if ((book.type !== 'txt' && book.type !== 'md' && book.type !== 'web') || readingMode !== 'paged' || !txtContainerRef.current) return;
    const container = txtContainerRef.current;
    const pageWidth = Math.max(container.clientWidth / textPagedPagesPerView, 1);
    const total = Math.max(1, Math.ceil(container.scrollWidth / pageWidth));

    let headingPageMap: Record<string, number> = {};
    if (book.type === 'md') {
      const headings = Array.from(container.querySelectorAll('h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]')) as HTMLElement[];
      headingPageMap = headings.reduce<Record<string, number>>((acc, heading) => {
        if (!heading.id) return acc;
        acc[heading.id] = Math.max(1, Math.floor(heading.offsetLeft / pageWidth) + 1);
        return acc;
      }, {});
      setMarkdownHeadingPageMap(headingPageMap);
    } else {
      setMarkdownHeadingPageMap({});
    }

    pageCacheRef.current.set(pageCacheKey, { total, headingPageMap });
    void saveReaderMeta(`page-cache:${pageCacheKey}`, { total, headingPageMap });
  }, [book.type, readingMode, pageCacheKey, layoutTick, textPagedPagesPerView]);

  useEffect(() => {
    void getReaderMeta<{ total: number; headingPageMap: Record<string, number> }>(`page-cache:${pageCacheKey}`).then((cached) => {
      if (!cached || typeof cached.total !== 'number') return;
      pageCacheRef.current.set(pageCacheKey, { total: cached.total, headingPageMap: cached.headingPageMap || {} });
      if (book.type === 'md' && cached.headingPageMap) setMarkdownHeadingPageMap(cached.headingPageMap);
      setLayoutTick((t) => t + 1);
    });
  }, [pageCacheKey, book.type]);

  useEffect(() => {
    if ((book.type !== 'txt' && book.type !== 'md' && book.type !== 'web') || readingMode !== 'paged' || !txtContainerRef.current) return;

    const container = txtContainerRef.current;
    const applyRelayout = () => {
      const maxLeft = Math.max(0, container.scrollWidth - container.clientWidth);
      const clampedProgress = Math.min(1, Math.max(0, textPagedProgressRef.current));
      container.scrollLeft = clampedProgress * maxLeft;
      setLayoutTick((t) => t + 1);
    };

    const frameA = window.requestAnimationFrame(() => {
      const frameB = window.requestAnimationFrame(applyRelayout);
      restorePagedFrameRef.current = frameB;
    });

    return () => {
      window.cancelAnimationFrame(frameA);
      if (restorePagedFrameRef.current !== null) {
        window.cancelAnimationFrame(restorePagedFrameRef.current);
        restorePagedFrameRef.current = null;
      }
    };
  }, [book.type, readingMode, layoutWidth, fontSize]);

  const {
    selectionPos,
    setSelectionPos,
    currentContext,
    quotedText,
    setQuotedText,
    showNoteDialog,
    setShowNoteDialog,
    handleAskAI,
    addHighlight,
    handleHighlightClick,
    setTempSelection,
    setCurrentContext,
  } = useReaderSelection({
    bookType: book.type,
    location,
    showSidebar,
    setShowSidebar,
    setActiveTab,
    renditionRef,
    txtContainerRef,
    setHighlights,
    setLocation,
  });

  const {
    webUrl,
    setWebUrl,
    webFrameStatus,
    setWebFrameStatus,
    webFrameHint,
    setWebFrameHint,
    webBridgeConnected,
    webBridgeVersion,
    webBridgeLastError,
    webBridgeLastAction,
    normalizeWebInputUrl,
  } = useWebBridge({
    isWeb,
    bookContent: book.content,
    webIframeRef,
    webBridgeSourceWindowRef,
    setQuotedText,
    setActiveTab,
    setShowSidebar,
    setTempSelection,
    addHighlight,
  });

  const getReaderStateSnapshot = useCallback((): ReaderStateSnapshot => {
    const normalizedProgress = getNormalizedProgress();
    const base: ReaderStateSnapshot = {
      version: 1,
      updatedAt: Date.now(),
      lastLocation: location,
      normalizedProgress,
      readingMode,
      theme,
      fontSize,
      layoutWidth,
      activeTab,
      showSidebar,
      sidebarPositionMode,
      highlightColorFilter,
    };

    if ((book.type === 'txt' || book.type === 'md' || book.type === 'web') && readingMode === 'paged') {
      base.pagination = {
        currentPage: textPagedMetrics.current,
        totalPages: textPagedMetrics.total,
        pagesPerView: textPagedPagesPerView,
      };
    }

    if (book.type === 'pdf') {
      base.pdf = {
        page: typeof location === 'number' ? location : undefined,
        totalPages: numPages || undefined,
      };
      if (typeof location === 'number' && numPages > 0) {
        base.pagination = {
          currentPage: Math.max(1, Math.round(location)),
          totalPages: Math.max(1, numPages),
        };
      }
    }

    if (book.type === 'epub') {
      const cfi = renditionRef.current?.currentLocation?.()?.start?.cfi;
      if (cfi) base.epub = { cfi };
    }

    return base;
  }, [
    activeTab,
    book.type,
    fontSize,
    getNormalizedProgress,
    layoutWidth,
    location,
    numPages,
    readingMode,
    showSidebar,
    sidebarPositionMode,
    highlightColorFilter,
    textPagedMetrics.current,
    textPagedMetrics.total,
    textPagedPagesPerView,
    theme,
  ]);

  const { persistProgress, dedupeHighlights, dedupeBookmarks } = useReaderProgress({
    book,
    location,
    numPages,
    readingMode,
    highlights,
    bookmarks,
    txtContainerRef,
    renditionRef,
    getReaderStateSnapshot,
    onTelemetry: setPersistTelemetry,
  });

  const dedupedHighlights = useMemo(() => dedupeHighlights(), [dedupeHighlights]);
  const dedupedBookmarks = useMemo(() => dedupeBookmarks(), [dedupeBookmarks]);

  const handleDeleteHighlight = useCallback((highlightId: string) => {
    setHighlights((prev) => prev.filter((item) => item.id !== highlightId));
  }, []);

  const handleUpdateHighlight = useCallback((highlightId: string, patch: Partial<Highlight>) => {
    setHighlights((prev) => prev.map((item) => (item.id === highlightId ? { ...item, ...patch } : item)));
  }, []);

  const { attachRendition } = useEpubSelection({
    theme,
    fontSize,
    layoutWidth,
    readingMode,
    highlights: dedupedHighlights,
    setCurrentContext,
    setTempSelection,
    setSelectionPos,
  });

  useEffect(() => {
    if (book.type !== 'epub') return;
    if (!renditionRef.current) return;
    attachRendition(renditionRef.current);
  }, [book.type, theme, fontSize, layoutWidth, attachRendition]);

  useEffect(() => {
    if (book.type !== 'epub' || readingMode !== 'paged') return;
    const rendition = renditionRef.current;
    if (!rendition?.display) return;

    if (epubRelayoutFrameRef.current !== null) {
      window.cancelAnimationFrame(epubRelayoutFrameRef.current);
      epubRelayoutFrameRef.current = null;
    }

    const frameA = window.requestAnimationFrame(() => {
      epubRelayoutFrameRef.current = window.requestAnimationFrame(() => {
        rendition.display?.();
        epubRelayoutFrameRef.current = null;
      });
    });

    const handleResize = () => {
      if (!renditionRef.current?.display) return;
      if (epubRelayoutFrameRef.current !== null) {
        window.cancelAnimationFrame(epubRelayoutFrameRef.current);
      }
      epubRelayoutFrameRef.current = window.requestAnimationFrame(() => {
        renditionRef.current?.display?.();
        epubRelayoutFrameRef.current = null;
      });
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.cancelAnimationFrame(frameA);
      window.removeEventListener('resize', handleResize);
      if (epubRelayoutFrameRef.current !== null) {
        window.cancelAnimationFrame(epubRelayoutFrameRef.current);
        epubRelayoutFrameRef.current = null;
      }
    };
  }, [book.type, readingMode, layoutWidth, fontSize, theme]);

  useEffect(() => {
    if (book.type !== 'epub') return;
    if (!epubReady || epubLoadedOnce || epubHardError) return;

    const delay = Math.min(2500, 600 * (epubAttempt + 1));
    const timer = window.setTimeout(() => {
      if (epubLoadedOnce) return;
      if (epubAttempt < 2) {
        setEpubAttempt((a) => a + 1);
        setEpubRetryNonce((n) => n + 1);
      } else {
        setEpubHardError(true);
      }
    }, delay);

    return () => window.clearTimeout(timer);
  }, [book.type, epubReady, epubLoadedOnce, epubHardError, epubAttempt]);

  const scrollToHeading = (id: string) => {
    if ((book.type === 'md' || book.type === 'txt' || book.type === 'web') && readingMode === 'paged' && txtContainerRef.current) {
      const page = markdownHeadingPageMap[id] ?? pageCacheRef.current.get(pageCacheKey)?.headingPageMap?.[id];
      if (page && page > 0) {
        const container = txtContainerRef.current;
        const pageWidth = Math.max(container.clientWidth / textPagedPagesPerView, 1);
        const targetLeft = (page - 1) * pageWidth;
        const maxLeft = Math.max(1, container.scrollWidth - container.clientWidth);
        textPagedProgressRef.current = Math.min(1, Math.max(0, targetLeft / maxLeft));
        container.scrollTo({ left: targetLeft, behavior: 'smooth' });
        setLocation(targetLeft);
        setLayoutTick((t) => t + 1);
        return;
      }
    }
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  const goToEpubHref = useCallback((href: string) => {
    renditionRef.current?.display?.(href);
  }, []);

  const {
    bookmarkToast,
    focusedBookmarkId,
    handleAddBookmark,
    handleBookmarkClick,
    handleDeleteBookmark,
    handleRenameBookmark,
    setBookmarkToast,
  } = useReaderBookmarks({
    book,
    location,
    readingMode,
    showSidebar,
    bookmarks,
    setBookmarks,
    setShowSidebar,
    setActiveTab,
    setLocation,
    txtContainerRef,
    renditionRef,
  });

  const {
    searchQuery,
    setSearchQuery,
    searchCaseSensitive,
    setSearchCaseSensitive,
    searchResults,
    activeSearchResultId,
    activeSearchResult,
    goToSearchResult,
    goToPrevSearchResult,
    goToNextSearchResult,
    searchCapability,
  } = useReaderSearch({
    book,
    epubToc,
    numPages,
    searchableText,
    readingMode,
    txtContainerRef,
    setLocation,
    setLayoutTick,
    textPagedProgressRef,
    goToEpubHref,
    onMessage: setBookmarkToast,
  });

  const searchMatchRanges = useMemo<SearchMatchRange[]>(
    () => searchResults.map((item) => ({ id: item.id, start: item.start, end: item.end })),
    [searchResults],
  );

  const handleOpenContents = useCallback(() => {
    setActiveTab('contents');
    setShowSidebar(true);
  }, []);

  const handleBack = async () => {
    await persistProgress();
    onBack();
  };

  const turnTextPage = useCallback((direction: 'prev' | 'next') => {
    const container = txtContainerRef.current;
    if (!container) return;
    const step = Math.max(container.clientWidth / textPagedPagesPerView, 1);
    const delta = direction === 'next' ? step : -step;
    const nextLeft = Math.max(0, Math.min(container.scrollLeft + delta, container.scrollWidth - container.clientWidth));
    const maxLeft = Math.max(1, container.scrollWidth - container.clientWidth);
    textPagedProgressRef.current = Math.min(1, Math.max(0, nextLeft / maxLeft));
    container.scrollTo({ left: nextLeft, behavior: 'smooth' });
    setLocation(nextLeft);
    setLayoutTick((t) => t + 1);
  }, [textPagedPagesPerView]);

  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null) => {
      const el = target as HTMLElement | null;
      if (!el) return false;
      const tag = el.tagName?.toLowerCase();
      return tag === 'input' || tag === 'textarea' || el.isContentEditable;
    };

    const handleKeydown = (e: KeyboardEvent) => {
      if (readingMode !== 'paged') return;
      if (isEditableTarget(e.target)) return;

      const isNext = e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ';
      const isPrev = e.key === 'ArrowLeft' || e.key === 'PageUp';
      if (!isNext && !isPrev) return;

      e.preventDefault();

      if (book.type === 'epub') {
        if (isNext) renditionRef.current?.next?.();
        if (isPrev) renditionRef.current?.prev?.();
        return;
      }

      if (book.type === 'pdf') {
        if (typeof location !== 'number') return;
        if (isNext) setLocation((prev) => (typeof prev === 'number' ? prev + 1 : 1));
        if (isPrev) setLocation((prev) => (typeof prev === 'number' ? Math.max(1, prev - 1) : 1));
        return;
      }

      if (book.type === 'txt' || book.type === 'md' || book.type === 'web') turnTextPage(isNext ? 'next' : 'prev');
    };

    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, [book.type, location, readingMode, turnTextPage]);

  useEffect(() => {
    if (book.type !== 'txt' && book.type !== 'md' && book.type !== 'web') return;
    const handleResize = () => setLayoutTick((t) => t + 1);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [book.type]);

  const { effectiveWpm } = useReadingSpeedEstimator({
    bookId: book.id,
    bookType: book.type,
    content: book.content,
    location,
    layoutTick,
    getNormalizedProgress,
  });

  const currentMdHeadingId = useMemo(() => {
    if (book.type !== 'md' || readingMode !== 'paged') return undefined;
    const currentPage = textPagedMetrics.current;
    let bestId: string | undefined;
    let bestPage = 0;
    Object.entries(markdownHeadingPageMap).forEach(([id, page]) => {
      if (page <= currentPage && page >= bestPage) {
        bestPage = page;
        bestId = id;
      }
    });
    return bestId;
  }, [book.type, readingMode, textPagedMetrics.current, markdownHeadingPageMap]);

  const estimatedReadingMinutes = useMemo(() => {
    if (book.type === 'md' || book.type === 'txt') {
      const words = typeof book.content === 'string' ? book.content.trim().split(/\s+/).filter(Boolean).length : 0;
      const progress = getNormalizedProgress();
      const remainWords = Math.max(0, Math.ceil(words * (1 - progress)));
      return Math.max(1, Math.ceil(remainWords / Math.max(effectiveWpm, 120)));
    }
    if (book.type === 'pdf' || book.type === 'epub') {
      const pages = book.type === 'pdf' ? Math.max(1, numPages || 1) : Math.max(1, epubToc.length || 1);
      return Math.max(1, Math.ceil(pages * 1.2));
    }
    return 1;
  }, [book.type, book.content, numPages, epubToc.length, getNormalizedProgress, effectiveWpm]);

  const resolvedSidebarSide: 'left' | 'right' = sidebarPositionMode === 'smart' ? (activeTab === 'contents' ? 'left' : 'right') : sidebarPositionMode;

  const sidebarProps = {
    showSidebar,
    activeTab,
    setActiveTab,
    styles,
    book,
    currentContext,
    quotedText,
    onClearQuote: () => setQuotedText(null),
    onClose: () => setShowSidebar(false),
    theme,
    markdownToc,
    epubToc,
    goToEpubHref,
    scrollToHeading,
    highlights,
    bookmarks: dedupedBookmarks,
    focusedBookmarkId,
    onHighlightClick: handleHighlightClick,
    onBookmarkClick: handleBookmarkClick,
    onDeleteBookmark: handleDeleteBookmark,
    onRenameBookmark: handleRenameBookmark,
    onDeleteHighlight: handleDeleteHighlight,
    onUpdateHighlight: handleUpdateHighlight,
    onExportHighlights: () => exportHighlights(book.id, book.title, dedupedHighlights),
    currentMdHeadingId,
    estimatedReadingMinutes,
    highlightColorFilter,
    onHighlightColorFilterChange: setHighlightColorFilter,
    searchQuery,
    searchCaseSensitive,
    searchResults,
    activeSearchResultId,
    onSearchQueryChange: setSearchQuery,
    onSearchCaseSensitiveChange: setSearchCaseSensitive,
    onSearchResultClick: goToSearchResult,
    onSearchPrev: goToPrevSearchResult,
    onSearchNext: goToNextSearchResult,
    searchSupported: searchCapability.supported,
    searchSupportHint: searchCapability.reason,
  };

  return (
    <div className={cn('flex h-screen w-full overflow-hidden transition-colors duration-300', styles.bg, styles.text)}>
      {resolvedSidebarSide === 'left' && <ReaderSidebar {...sidebarProps} side="left" />}

      <ReaderMainContent
        book={book}
        styles={styles}
        theme={theme}
        fontSize={fontSize}
        setFontSize={setFontSize}
        setTheme={setTheme}
        layoutWidth={layoutWidth}
        setLayoutWidth={setLayoutWidth}
        readingMode={readingMode}
        setReadingMode={setReadingMode}
        isEpub={isEpub}
        isWeb={isWeb}
        showSidebar={showSidebar}
        setShowSidebar={setShowSidebar}
        activeTab={activeTab}
        onOpenContents={handleOpenContents}
        sidebarPositionMode={sidebarPositionMode}
        setSidebarPositionMode={setSidebarPositionMode}
        onBack={handleBack}
        onAddBookmark={handleAddBookmark}
        selectionPos={selectionPos}
        setSelectionPos={() => setSelectionPos(null)}
        addHighlight={addHighlight}
        setShowNoteDialog={setShowNoteDialog}
        showNoteDialog={showNoteDialog}
        handleAskAI={handleAskAI}
        location={location}
        setLocation={setLocation}
        readerContent={readerContent}
        epubReady={epubReady}
        epubHardError={epubHardError}
        epubLoadedOnce={epubLoadedOnce}
        epubRetryNonce={epubRetryNonce}
        attachRendition={(rendition) => {
          const casted = rendition as RenditionRef;
          renditionRef.current = casted;
          attachRendition(casted);
        }}
        setEpubToc={setEpubToc}
        setEpubLoadedOnce={setEpubLoadedOnce}
        setEpubHardError={setEpubHardError}
        setEpubAttempt={setEpubAttempt}
        setEpubRetryNonce={setEpubRetryNonce}
        readerStyles={readerStyles}
        numPages={numPages}
        setNumPages={setNumPages}
        txtContainerRef={txtContainerRef}
        textPagedPagesPerView={textPagedPagesPerView}
        onTextScroll={(pos) => {
          if (readingMode === 'paged' && txtContainerRef.current) {
            const maxLeft = Math.max(1, txtContainerRef.current.scrollWidth - txtContainerRef.current.clientWidth);
            textPagedProgressRef.current = Math.min(1, Math.max(0, pos / maxLeft));
          }
          setLocation(pos);
          setLayoutTick((t) => t + 1);
        }}
        dedupedHighlights={dedupedHighlights}
        searchMatchRanges={searchMatchRanges}
        activeSearchResultId={activeSearchResult?.id || undefined}
        webUrl={webUrl}
        setWebUrl={setWebUrl}
        normalizeWebInputUrl={normalizeWebInputUrl}
        setWebFrameStatus={setWebFrameStatus}
        setWebFrameHint={setWebFrameHint}
        webBridgeConnected={webBridgeConnected}
        webBridgeVersion={webBridgeVersion}
        webBridgeLastAction={webBridgeLastAction}
        webBridgeLastError={webBridgeLastError}
        webFrameHint={webFrameHint}
        webFrameStatus={webFrameStatus}
        webIframeRef={webIframeRef}
        touchStartX={touchStartX}
        setTouchStartX={setTouchStartX}
        turnTextPage={turnTextPage}
        textPagedMetrics={textPagedMetrics}
        bookmarkToast={bookmarkToast}
        persistTelemetry={persistTelemetry}
      />

      {resolvedSidebarSide === 'right' && <ReaderSidebar {...sidebarProps} side="right" />}
    </div>
  );
}
