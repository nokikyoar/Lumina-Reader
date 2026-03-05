import { useCallback, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { appendReadingSession } from '../services/analyticsRepo';

interface Params {
  bookId: string;
  bookTitle: string;
  getProgress: () => number;
}

const MIN_SESSION_MS = 20_000;
const HEARTBEAT_MS = 60_000;
const SLICE_MS = 5 * 60_000;

type EndReason = 'back' | 'hidden' | 'unload' | 'switch-book' | 'heartbeat-slice';

export function useReadingAnalyticsTracker({ bookId, bookTitle, getProgress }: Params) {
  const sessionRef = useRef<{
    id: string;
    startAt: number;
    startProgress: number;
  } | null>(null);

  const getProgressRef = useRef(getProgress);
  const bookMetaRef = useRef({ bookId, bookTitle });

  useEffect(() => {
    getProgressRef.current = getProgress;
  }, [getProgress]);

  useEffect(() => {
    bookMetaRef.current = { bookId, bookTitle };
  }, [bookId, bookTitle]);

  const start = useCallback(() => {
    if (sessionRef.current) return;
    sessionRef.current = {
      id: uuidv4(),
      startAt: Date.now(),
      startProgress: getProgressRef.current(),
    };
  }, []);

  const flushCurrentSession = useCallback(async (reason: EndReason) => {
    const session = sessionRef.current;
    if (!session) return;

    const endAt = Date.now();
    const durationMs = endAt - session.startAt;
    const endProgress = getProgressRef.current();
    const { bookId: currentBookId, bookTitle: currentBookTitle } = bookMetaRef.current;

    sessionRef.current = null;

    if (durationMs < MIN_SESSION_MS) {
      if (reason === 'heartbeat-slice') start();
      return;
    }

    await appendReadingSession({
      id: session.id,
      bookId: currentBookId,
      bookTitle: currentBookTitle,
      startAt: session.startAt,
      endAt,
      durationMs,
      startProgress: session.startProgress,
      endProgress,
      progressDelta: Math.max(0, Number((endProgress - session.startProgress).toFixed(4))),
    });

    if (reason === 'heartbeat-slice') {
      sessionRef.current = {
        id: uuidv4(),
        startAt: Date.now(),
        startProgress: endProgress,
      };
    }
  }, [start]);

  useEffect(() => {
    start();
    return () => {
      void flushCurrentSession('switch-book');
    };
  }, [bookId, start, flushCurrentSession]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        void flushCurrentSession('hidden');
      } else {
        start();
      }
    };

    const onUnload = () => {
      void flushCurrentSession('unload');
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('beforeunload', onUnload);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('beforeunload', onUnload);
    };
  }, [start, flushCurrentSession]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const session = sessionRef.current;
      if (!session) return;
      if (Date.now() - session.startAt >= SLICE_MS) {
        void flushCurrentSession('heartbeat-slice');
      }
    }, HEARTBEAT_MS);
    return () => window.clearInterval(timer);
  }, [flushCurrentSession]);

  return {
    endSession: (reason: 'back' | 'hidden' | 'unload' | 'switch-book') => flushCurrentSession(reason),
  };
}
