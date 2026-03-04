import { useEffect, useMemo, useRef, useState } from 'react';
import { getReaderMeta, saveReaderMeta } from '@/lib/db';

interface UseReadingSpeedEstimatorParams {
  bookId: string;
  bookType: string;
  content: string | ArrayBuffer;
  location: string | number;
  layoutTick: number;
  getNormalizedProgress: () => number;
}

export function useReadingSpeedEstimator({
  bookId,
  bookType,
  content,
  location,
  layoutTick,
  getNormalizedProgress,
}: UseReadingSpeedEstimatorParams) {
  const [globalWpm, setGlobalWpm] = useState(250);
  const [bookWpm, setBookWpm] = useState<number | null>(null);
  const lastLearningAtRef = useRef(Date.now());
  const lastProgressRef = useRef(0);
  const lastProgressAtRef = useRef(Date.now());

  useEffect(() => {
    void getReaderMeta<number>('reader.speed.global.wpm').then((value) => {
      if (typeof value === 'number' && Number.isFinite(value) && value > 80 && value < 800) setGlobalWpm(value);
    });
    void getReaderMeta<number>(`reader.speed.book.${bookId}.wpm`).then((value) => {
      if (typeof value === 'number' && Number.isFinite(value) && value > 80 && value < 800) setBookWpm(value);
    });
  }, [bookId]);

  useEffect(() => {
    const progress = getNormalizedProgress();
    lastProgressRef.current = progress;
    lastProgressAtRef.current = Date.now();
    lastLearningAtRef.current = Date.now();
  }, [bookId, getNormalizedProgress]);

  useEffect(() => {
    const totalWords = typeof content === 'string' ? content.trim().split(/\s+/).filter(Boolean).length : 0;
    if (totalWords < 200) return;

    const timer = window.setInterval(() => {
      const now = Date.now();
      const progress = getNormalizedProgress();
      const deltaProgress = Math.max(0, progress - lastProgressRef.current);
      const elapsedMin = (now - lastLearningAtRef.current) / 60000;

      if (deltaProgress >= 0.002 && elapsedMin >= 0.5) {
        const wordsRead = deltaProgress * totalWords;
        const measuredWpm = wordsRead / Math.max(0.1, elapsedMin);
        if (Number.isFinite(measuredWpm) && measuredWpm >= 80 && measuredWpm <= 800) {
          const nextGlobal = Math.round(globalWpm * 0.85 + measuredWpm * 0.15);
          const prevBook = bookWpm ?? nextGlobal;
          const nextBook = Math.round(prevBook * 0.75 + measuredWpm * 0.25);
          setGlobalWpm(nextGlobal);
          setBookWpm(nextBook);
          void saveReaderMeta('reader.speed.global.wpm', nextGlobal);
          void saveReaderMeta(`reader.speed.book.${bookId}.wpm`, nextBook);
        }
        lastProgressRef.current = progress;
        lastProgressAtRef.current = now;
        lastLearningAtRef.current = now;
      } else if (deltaProgress >= 0.0005) {
        lastProgressRef.current = progress;
        lastProgressAtRef.current = now;
      }
    }, 30000);

    return () => window.clearInterval(timer);
  }, [bookId, content, bookWpm, globalWpm, getNormalizedProgress]);

  const sampleWpm = useMemo(() => {
    if (bookType !== 'md' && bookType !== 'txt') return undefined;
    const totalWords = typeof content === 'string' ? content.trim().split(/\s+/).filter(Boolean).length : 0;
    if (totalWords < 200) return undefined;
    const progress = getNormalizedProgress();
    const delta = Math.max(0, progress - lastProgressRef.current);
    const elapsed = (Date.now() - lastLearningAtRef.current) / 60000;
    if (delta < 0.001 || elapsed < 0.2) return undefined;
    const measured = (delta * totalWords) / Math.max(elapsed, 0.1);
    if (!Number.isFinite(measured) || measured < 80 || measured > 800) return undefined;
    return measured;
  }, [bookType, content, location, getNormalizedProgress]);

  useEffect(() => {
    if (sampleWpm === undefined) return;
    const nextGlobal = Math.round(globalWpm * 0.88 + sampleWpm * 0.12);
    const prevBook = bookWpm ?? nextGlobal;
    const nextBook = Math.round(prevBook * 0.78 + sampleWpm * 0.22);
    setGlobalWpm(nextGlobal);
    setBookWpm(nextBook);
    void saveReaderMeta('reader.speed.global.wpm', nextGlobal);
    void saveReaderMeta(`reader.speed.book.${bookId}.wpm`, nextBook);
    lastLearningAtRef.current = Date.now();
    lastProgressRef.current = getNormalizedProgress();
  }, [sampleWpm, bookId, bookWpm, globalWpm, getNormalizedProgress]);

  const effectiveWpm = useMemo(() => {
    const base = bookWpm ? Math.round(bookWpm * 0.7 + globalWpm * 0.3) : globalWpm;
    const idleMinutes = (Date.now() - lastProgressAtRef.current) / 60000;
    if (idleMinutes <= 2) return base;
    const decay = Math.max(0.6, 1 - (idleMinutes - 2) * 0.06);
    return Math.max(100, Math.round(base * decay));
  }, [bookWpm, globalWpm, location, layoutTick]);

  return { effectiveWpm };
}
