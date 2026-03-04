import { Dispatch, MutableRefObject, RefObject, SetStateAction, useCallback, useEffect, useMemo, useState } from 'react';
import { Book } from '@/lib/db';
import {
  SearchResultItem,
  buildEpubTocSearchResults,
  buildPdfPageSearchResults,
  buildTextSearchResults,
  getSearchCapability,
  loadSearchCache,
  saveSearchCache,
} from './searchAdapters';
import { EpubTocItem, ReadingMode } from './readerShared';

interface UseReaderSearchParams {
  book: Book;
  epubToc: EpubTocItem[];
  numPages: number;
  searchableText: string;
  readingMode: ReadingMode;
  txtContainerRef: RefObject<HTMLDivElement | null>;
  setLocation: Dispatch<SetStateAction<string | number>>;
  setLayoutTick: Dispatch<SetStateAction<number>>;
  textPagedProgressRef: MutableRefObject<number>;
  goToEpubHref: (href: string) => void;
  onMessage: (message: string) => void;
}

export function useReaderSearch({
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
  onMessage,
}: UseReaderSearchParams) {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [searchCaseSensitive, setSearchCaseSensitive] = useState(false);
  const [activeSearchResultId, setActiveSearchResultId] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const searchCapability = useMemo(() => getSearchCapability(book.type), [book.type]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearchQuery(searchQuery), 180);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    const keyword = debouncedSearchQuery.trim();
    if (!keyword || !searchCapability.supported) {
      setSearchResults([]);
      return;
    }

    let cancelled = false;
    void (async () => {
      const cached = await loadSearchCache(book, keyword, searchCaseSensitive);
      if (cached && !cancelled) {
        setSearchResults(cached);
        return;
      }

      let computed: SearchResultItem[] = [];

      if ((book.type === 'txt' || book.type === 'md') && searchableText) {
        computed = buildTextSearchResults({
          text: searchableText,
          query: keyword,
          caseSensitive: searchCaseSensitive,
          type: book.type,
          limit: 500,
        });
      } else if (book.type === 'epub') {
        computed = buildEpubTocSearchResults({ toc: epubToc, query: keyword, caseSensitive: searchCaseSensitive, limit: 200 });
      } else if (book.type === 'pdf') {
        computed = buildPdfPageSearchResults({ numPages, query: keyword, limit: 20 });
      }

      if (cancelled) return;
      setSearchResults(computed);
      void saveSearchCache(book, keyword, searchCaseSensitive, computed);
    })();

    return () => {
      cancelled = true;
    };
  }, [book, book.type, debouncedSearchQuery, epubToc, numPages, searchCaseSensitive, searchCapability.supported, searchableText]);

  const activeSearchResult = useMemo(
    () => searchResults.find((item) => item.id === activeSearchResultId) ?? null,
    [searchResults, activeSearchResultId],
  );

  const goToSearchResult = useCallback((resultId: string) => {
    setActiveSearchResultId(resultId);
    const result = searchResults.find((item) => item.id === resultId);
    if (!result) return;

    if ((book.type === 'txt' || book.type === 'md') && txtContainerRef.current) {
      const container = txtContainerRef.current;
      const ratio = result.target?.ratio ?? (result.start / Math.max(1, searchableText.length));

      if (readingMode === 'paged') {
        const maxLeft = Math.max(0, container.scrollWidth - container.clientWidth);
        const targetLeft = Math.max(0, Math.min(maxLeft, ratio * maxLeft));
        textPagedProgressRef.current = maxLeft > 0 ? targetLeft / maxLeft : 0;
        container.scrollTo({ left: targetLeft, behavior: 'smooth' });
        setLocation(targetLeft);
      } else {
        const maxTop = Math.max(0, container.scrollHeight - container.clientHeight);
        const targetTop = Math.max(0, Math.min(maxTop, ratio * maxTop));
        container.scrollTo({ top: targetTop, behavior: 'smooth' });
        setLocation(targetTop);
      }
      setLayoutTick((t) => t + 1);
      return;
    }

    if (book.type === 'epub' && result.target?.href) {
      goToEpubHref(result.target.href);
      return;
    }

    if (book.type === 'pdf' && typeof result.target?.page === 'number') {
      setLocation(result.target.page);
      return;
    }

    if (book.type === 'epub') onMessage('EPUB 当前仅支持目录级命中定位。');
    if (book.type === 'pdf') onMessage('PDF 当前仅支持页码定位。');
  }, [book.type, goToEpubHref, readingMode, searchResults, searchableText.length, setLayoutTick, setLocation, textPagedProgressRef, txtContainerRef, onMessage]);

  const goToPrevSearchResult = useCallback(() => {
    if (searchResults.length === 0) return;
    if (!activeSearchResultId) return goToSearchResult(searchResults[searchResults.length - 1].id);
    const idx = searchResults.findIndex((item) => item.id === activeSearchResultId);
    const nextIdx = idx <= 0 ? searchResults.length - 1 : idx - 1;
    goToSearchResult(searchResults[nextIdx].id);
  }, [activeSearchResultId, goToSearchResult, searchResults]);

  const goToNextSearchResult = useCallback(() => {
    if (searchResults.length === 0) return;
    if (!activeSearchResultId) return goToSearchResult(searchResults[0].id);
    const idx = searchResults.findIndex((item) => item.id === activeSearchResultId);
    const nextIdx = idx < 0 || idx >= searchResults.length - 1 ? 0 : idx + 1;
    goToSearchResult(searchResults[nextIdx].id);
  }, [activeSearchResultId, goToSearchResult, searchResults]);

  return {
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
  };
}
