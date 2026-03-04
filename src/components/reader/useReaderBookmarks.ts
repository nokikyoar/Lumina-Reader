import { useCallback, useEffect, useState } from 'react';
import { Bookmark, Book } from '@/lib/db';
import { SidebarTab } from './readerUtils';
import { ReadingMode, RenditionRef } from './readerShared';

type UseReaderBookmarksParams = {
  book: Book;
  location: string | number;
  readingMode: ReadingMode;
  showSidebar: boolean;
  bookmarks: Bookmark[];
  setBookmarks: React.Dispatch<React.SetStateAction<Bookmark[]>>;
  setShowSidebar: React.Dispatch<React.SetStateAction<boolean>>;
  setActiveTab: React.Dispatch<React.SetStateAction<SidebarTab>>;
  setLocation: React.Dispatch<React.SetStateAction<string | number>>;
  txtContainerRef: React.RefObject<HTMLDivElement | null>;
  renditionRef: React.RefObject<RenditionRef>;
};

export function useReaderBookmarks({
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
}: UseReaderBookmarksParams) {
  const [bookmarkToast, setBookmarkToast] = useState<string | null>(null);
  const [focusedBookmarkId, setFocusedBookmarkId] = useState<string | null>(null);

  const handleAddBookmark = useCallback(() => {
    const now = Date.now();
    const timeLabel = new Date(now).toLocaleString();

    const isSameTextPosition = (value: number | undefined, target: number) => typeof value === 'number' && Math.abs(value - target) <= 24;

    let duplicate: Bookmark | undefined;
    let candidate: Bookmark | null = null;

    if (book.type === 'epub') {
      const cfi = renditionRef.current?.currentLocation?.()?.start?.cfi;
      if (!cfi) return;
      duplicate = bookmarks.find((item) => item.cfiRange === cfi);
      candidate = {
        id: `bm-${book.id}-${now}`,
        cfiRange: cfi,
        label: `Chapter marker · ${timeLabel}`,
        createdAt: now,
      };
    } else if (book.type === 'pdf') {
      if (typeof location !== 'number') return;
      duplicate = bookmarks.find((item) => item.page === location);
      candidate = {
        id: `bm-${book.id}-${now}`,
        page: location,
        label: `Page ${location} · ${timeLabel}`,
        createdAt: now,
      };
    } else {
      if (typeof location !== 'number') return;
      duplicate = bookmarks.find((item) => isSameTextPosition(item.position, location));
      candidate = {
        id: `bm-${book.id}-${now}`,
        position: location,
        label: `Reading position · ${timeLabel}`,
        createdAt: now,
      };
    }

    if (!candidate) return;

    if (duplicate) {
      setFocusedBookmarkId(duplicate.id);
      setBookmarkToast('Bookmark already exists at this location.');
      setActiveTab('bookmarks');
      if (!showSidebar) setShowSidebar(true);
      return;
    }

    setBookmarks((prev) => [candidate!, ...prev.filter((item) => item.id !== candidate!.id)]);
    setFocusedBookmarkId(candidate.id);
    setBookmarkToast('Bookmark added.');
    setActiveTab('bookmarks');
    if (!showSidebar) setShowSidebar(true);
  }, [book.id, book.type, bookmarks, location, renditionRef, setActiveTab, setBookmarks, setShowSidebar, showSidebar]);

  const handleBookmarkClick = useCallback(
    (bookmark: Bookmark) => {
      setFocusedBookmarkId(bookmark.id);
      if (book.type === 'epub' && bookmark.cfiRange) {
        setLocation(bookmark.cfiRange);
        return;
      }
      if (book.type === 'pdf' && typeof bookmark.page === 'number') {
        setLocation(bookmark.page);
        return;
      }
      if ((book.type === 'txt' || book.type === 'md' || book.type === 'web') && typeof bookmark.position === 'number' && txtContainerRef.current) {
        if (readingMode === 'paged') {
          txtContainerRef.current.scrollLeft = bookmark.position;
        } else {
          txtContainerRef.current.scrollTop = bookmark.position;
        }
        setLocation(bookmark.position);
      }
    },
    [book.type, readingMode, setLocation, txtContainerRef],
  );

  const handleDeleteBookmark = useCallback((bookmarkId: string) => {
    setBookmarks((prev) => prev.filter((item) => item.id !== bookmarkId));
    setFocusedBookmarkId((prev) => (prev === bookmarkId ? null : prev));
  }, [setBookmarks]);

  const handleRenameBookmark = useCallback((bookmarkId: string, label: string) => {
    const normalized = label.trim();
    if (!normalized) return;
    setBookmarks((prev) => prev.map((item) => (item.id === bookmarkId ? { ...item, label: normalized } : item)));
  }, [setBookmarks]);

  useEffect(() => {
    if (!bookmarkToast) return;
    const timer = window.setTimeout(() => setBookmarkToast(null), 1800);
    return () => window.clearTimeout(timer);
  }, [bookmarkToast]);

  useEffect(() => {
    if (!focusedBookmarkId) return;
    const timer = window.setTimeout(() => setFocusedBookmarkId(null), 2200);
    return () => window.clearTimeout(timer);
  }, [focusedBookmarkId]);

  return {
    bookmarkToast,
    setBookmarkToast,
    focusedBookmarkId,
    handleAddBookmark,
    handleBookmarkClick,
    handleDeleteBookmark,
    handleRenameBookmark,
  };
}
