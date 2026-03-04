import { useCallback, useEffect, useRef } from 'react';
import { Book, Bookmark, Highlight, ReaderStateSnapshot, getBook, saveBook, saveReaderMeta } from '@/lib/db';

interface PersistTelemetry {
  lastSuccessAt: number | null;
  lastFailureAt: number | null;
  retryCount: number;
  failureCount: number;
  consecutiveFailureCount: number;
  backoffLevel: 0 | 1 | 2;
  cooldownUntil: number | null;
  lastReason: string | null;
}

interface UseReaderProgressParams {
  book: Book;
  location: string | number;
  numPages: number;
  readingMode: 'scroll' | 'paged';
  highlights: Highlight[];
  bookmarks: Bookmark[];
  txtContainerRef: React.RefObject<HTMLDivElement | null>;
  renditionRef: React.RefObject<{ location?: { start?: { percentage?: number } } } | null>;
  getReaderStateSnapshot: () => ReaderStateSnapshot;
  onTelemetry?: (telemetry: PersistTelemetry) => void;
}

const RETRY_DELAYS_MS = [300, 1200, 3000] as const;
const CONSECUTIVE_FAILURE_THRESHOLD_L1 = 3;
const CONSECUTIVE_FAILURE_THRESHOLD_L2 = 6;
const TELEMETRY_META_KEY_PREFIX = 'reader.persist.telemetry';

export function useReaderProgress({
  book,
  location,
  numPages,
  readingMode,
  highlights,
  bookmarks,
  txtContainerRef,
  renditionRef,
  getReaderStateSnapshot,
  onTelemetry,
}: UseReaderProgressParams) {
  const writingRef = useRef(false);
  const pendingReasonRef = useRef<string | null>(null);
  const debounceTimerRef = useRef<number | null>(null);
  const telemetryFlushTimerRef = useRef<number | null>(null);
  const telemetryRef = useRef<PersistTelemetry>({
    lastSuccessAt: null,
    lastFailureAt: null,
    retryCount: 0,
    failureCount: 0,
    consecutiveFailureCount: 0,
    backoffLevel: 0,
    cooldownUntil: null,
    lastReason: null,
  });

  const getDebounceMsByBackoff = useCallback(() => {
    switch (telemetryRef.current.backoffLevel) {
      case 2:
        return 2200;
      case 1:
        return 1100;
      default:
        return 450;
    }
  }, []);

  const scheduleTelemetryPersist = useCallback(() => {
    if (telemetryFlushTimerRef.current !== null) {
      window.clearTimeout(telemetryFlushTimerRef.current);
    }
    telemetryFlushTimerRef.current = window.setTimeout(() => {
      telemetryFlushTimerRef.current = null;
      void saveReaderMeta(`${TELEMETRY_META_KEY_PREFIX}:${book.id}`, {
        ...telemetryRef.current,
        updatedAt: Date.now(),
      });
    }, 500);
  }, [book.id]);

  const emitTelemetry = useCallback((partial: Partial<PersistTelemetry>) => {
    telemetryRef.current = {
      ...telemetryRef.current,
      ...partial,
    };
    onTelemetry?.(telemetryRef.current);
    scheduleTelemetryPersist();
  }, [onTelemetry, scheduleTelemetryPersist]);

  const dedupeHighlights = useCallback(
    () => highlights.filter((h, i, self) => i === self.findIndex((x) => x.id === h.id)),
    [highlights],
  );

  const dedupeBookmarks = useCallback(
    () => bookmarks.filter((b, i, self) => i === self.findIndex((x) => x.id === b.id)),
    [bookmarks],
  );

  const getNumericProgress = useCallback(() => {
    if ((book.type === 'txt' || book.type === 'md') && txtContainerRef.current) {
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
    if (book.type === 'epub' && typeof renditionRef.current?.location?.start?.percentage === 'number') {
      return Math.min(1, Math.max(0, renditionRef.current.location.start.percentage));
    }
    if (typeof location === 'number' && location <= 1) {
      return Math.min(1, Math.max(0, location));
    }
    return 0;
  }, [book.type, location, numPages, readingMode, txtContainerRef, renditionRef]);

  const writeSnapshot = useCallback(async () => {
    const existing = await getBook(book.id);
    if (!existing) return;

    const progress = getNumericProgress();
    const nextReadingProgress = {
      ...(existing.readingProgress || {}),
      [readingMode]: progress,
    };

    await saveBook({
      ...existing,
      progress,
      readingProgress: nextReadingProgress,
      readerState: getReaderStateSnapshot(),
      lastRead: Date.now(),
      highlights: dedupeHighlights(),
      bookmarks: dedupeBookmarks(),
    });
  }, [book.id, dedupeBookmarks, dedupeHighlights, getNumericProgress, getReaderStateSnapshot, readingMode]);

  const flushPersistQueue = useCallback(async () => {
    if (writingRef.current) return;
    if (!pendingReasonRef.current) return;

    const now = Date.now();
    if (telemetryRef.current.cooldownUntil && now < telemetryRef.current.cooldownUntil) return;

    writingRef.current = true;
    const currentReason = pendingReasonRef.current;
    pendingReasonRef.current = null;
    emitTelemetry({ lastReason: currentReason });

    try {
      let lastError: unknown;
      let localRetries = 0;
      for (const delay of [0, ...RETRY_DELAYS_MS]) {
        if (delay > 0) {
          localRetries += 1;
          emitTelemetry({ retryCount: telemetryRef.current.retryCount + 1 });
          await new Promise((resolve) => window.setTimeout(resolve, delay));
        }
        try {
          await writeSnapshot();
          emitTelemetry({
            lastSuccessAt: Date.now(),
            consecutiveFailureCount: 0,
            backoffLevel: 0,
            cooldownUntil: null,
          });
          lastError = null;
          break;
        } catch (error) {
          lastError = error;
        }
      }

      if (lastError) {
        const nextConsecutive = telemetryRef.current.consecutiveFailureCount + 1;
        const nextBackoff: 0 | 1 | 2 = nextConsecutive >= CONSECUTIVE_FAILURE_THRESHOLD_L2 ? 2 : nextConsecutive >= CONSECUTIVE_FAILURE_THRESHOLD_L1 ? 1 : 0;
        const cooldownUntil = nextBackoff === 2 ? Date.now() + 15000 : nextBackoff === 1 ? Date.now() + 6000 : null;

        emitTelemetry({
          lastFailureAt: Date.now(),
          failureCount: telemetryRef.current.failureCount + 1,
          consecutiveFailureCount: nextConsecutive,
          backoffLevel: nextBackoff,
          cooldownUntil,
        });

        console.error('[reader] persist failed after retries', { reason: currentReason, retries: localRetries, error: lastError, backoffLevel: nextBackoff });
        pendingReasonRef.current = pendingReasonRef.current ?? 'retry-after-failure';
      }
    } finally {
      writingRef.current = false;
      if (pendingReasonRef.current) {
        const delay = getDebounceMsByBackoff();
        window.setTimeout(() => {
          void flushPersistQueue();
        }, delay);
      }
    }
  }, [emitTelemetry, getDebounceMsByBackoff, writeSnapshot]);

  const persistProgress = useCallback(async (reason = 'immediate') => {
    pendingReasonRef.current = reason;
    await flushPersistQueue();
  }, [flushPersistQueue]);

  const schedulePersist = useCallback((reason: string) => {
    pendingReasonRef.current = reason;
    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = window.setTimeout(() => {
      debounceTimerRef.current = null;
      void flushPersistQueue();
    }, getDebounceMsByBackoff());
  }, [flushPersistQueue, getDebounceMsByBackoff]);

  useEffect(() => {
    schedulePersist('state-change');
  }, [schedulePersist, location, readingMode, highlights, bookmarks]);

  useEffect(() => {
    const timer = setInterval(() => {
      void persistProgress('heartbeat');
    }, 12000);
    return () => clearInterval(timer);
  }, [persistProgress]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') void persistProgress('visibility-hidden');
    };
    const handleBeforeUnload = () => void persistProgress('before-unload');

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current);
      }
      if (telemetryFlushTimerRef.current !== null) {
        window.clearTimeout(telemetryFlushTimerRef.current);
      }
    };
  }, [persistProgress]);

  return { persistProgress, dedupeHighlights, dedupeBookmarks };
}
