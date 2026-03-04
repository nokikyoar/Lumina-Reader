import { useEffect, useMemo, useRef, useState } from 'react';
import { BookMarked, Bot, ChevronDown, ChevronRight, Clock3, List, Pencil, Search, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { Book, Bookmark, Highlight } from '@/lib/db';
import { ChatSidebar } from '../ChatSidebar';
import { SidebarTab, Theme } from './readerUtils';
import { HighlightsPanel } from './HighlightsPanel';

interface EpubTocItem {
  label: string;
  href: string;
  subitems?: EpubTocItem[];
}
type HighlightColor = Highlight['color'];

interface ReaderSidebarProps {
  showSidebar: boolean;
  activeTab: SidebarTab;
  setActiveTab: (tab: SidebarTab) => void;
  side?: 'left' | 'right';
  styles: {
    bg: string;
    sidebarBorder: string;
    tabInactiveText: string;
    tabHoverText: string;
    listItemHoverBg: string;
    noteCardBg: string;
    noteCardHoverBg: string;
    noteCardBorder: string;
    subtleText: string;
  };
  book: Book;
  currentContext: string;
  quotedText: string | null;
  onClearQuote: () => void;
  onClose: () => void;
  theme: Theme;
  markdownToc: Array<{ level: number; text: string; id: string }>;
  epubToc: EpubTocItem[];
  scrollToHeading: (id: string) => void;
  goToEpubHref: (href: string) => void;
  highlights: Highlight[];
  bookmarks: Bookmark[];
  focusedBookmarkId?: string | null;
  onHighlightClick: (hl: Highlight) => void;
  onBookmarkClick: (bookmark: Bookmark) => void;
  onDeleteBookmark: (bookmarkId: string) => void;
  onRenameBookmark: (bookmarkId: string, label: string) => void;
  onDeleteHighlight: (highlightId: string) => void;
  onUpdateHighlight: (highlightId: string, patch: Partial<Highlight>) => void;
  onExportHighlights: () => void;
  currentMdHeadingId?: string;
  estimatedReadingMinutes?: number;
  highlightColorFilter: HighlightColor | 'all';
  onHighlightColorFilterChange: (value: HighlightColor | 'all') => void;
  searchQuery: string;
  searchCaseSensitive: boolean;
  searchResults: Array<{ id: string; preview: string; matchText: string; contextLabel: string }>;
  activeSearchResultId?: string | null;
  onSearchQueryChange: (value: string) => void;
  onSearchCaseSensitiveChange: (value: boolean) => void;
  onSearchResultClick: (resultId: string) => void;
  onSearchPrev: () => void;
  onSearchNext: () => void;
  searchSupported: boolean;
  searchSupportHint?: string;
}

function EpubTocTree({ items, goToEpubHref, listItemHoverBg }: { items: EpubTocItem[]; goToEpubHref: (href: string) => void; listItemHoverBg: string }) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggle = (key: string) => setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));

  const renderItems = (nodes: EpubTocItem[], level = 1) =>
    nodes.map((item, index) => {
      const key = `${item.href}-${level}-${index}`;
      const hasChildren = !!item.subitems?.length;
      const isCollapsed = !!collapsed[key];

      return (
        <div key={key}>
          <div className="flex items-center gap-1">
            {hasChildren ? (
              <button className={cn('p-1 rounded transition-colors', listItemHoverBg)} onClick={() => toggle(key)}>
                {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            ) : (
              <span className="w-6" />
            )}
            <button
              onClick={() => goToEpubHref(item.href)}
              className={cn('flex-1 text-left py-2 px-2 rounded-lg text-sm transition-all duration-200 hover:-translate-y-0.5 truncate block', listItemHoverBg)}
              style={{ paddingLeft: `${(level - 1) * 12 + 4}px` }}
            >
              {item.label}
            </button>
          </div>
          {hasChildren && !isCollapsed && <div>{renderItems(item.subitems || [], level + 1)}</div>}
        </div>
      );
    });

  return <div className="space-y-1">{renderItems(items)}</div>;
}

export function ReaderSidebar(props: ReaderSidebarProps) {
  const {
    showSidebar,
    activeTab,
    setActiveTab,
    side = 'right',
    styles,
    book,
    currentContext,
    quotedText,
    onClearQuote,
    onClose,
    theme,
    markdownToc,
    epubToc,
    scrollToHeading,
    goToEpubHref,
    highlights,
    bookmarks,
    focusedBookmarkId,
    onHighlightClick,
    onBookmarkClick,
    onDeleteBookmark,
    onRenameBookmark,
    onDeleteHighlight,
    onUpdateHighlight,
    onExportHighlights,
    currentMdHeadingId,
    estimatedReadingMinutes,
    highlightColorFilter,
    onHighlightColorFilterChange,
    searchQuery,
    searchCaseSensitive,
    searchResults,
    activeSearchResultId,
    onSearchQueryChange,
    onSearchCaseSensitiveChange,
    onSearchResultClick,
    onSearchPrev,
    onSearchNext,
    searchSupported,
    searchSupportHint,
  } = props;

  const [mdCollapsed, setMdCollapsed] = useState<Record<string, boolean>>({});
  const [editingBookmarkId, setEditingBookmarkId] = useState<string | null>(null);
  const [bookmarkDraft, setBookmarkDraft] = useState('');
  const activeMdItemRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (activeTab !== 'contents') return;
    activeMdItemRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [activeTab, currentMdHeadingId]);

  const groupedMarkdownToc = useMemo(() => {
    if (markdownToc.length === 0) return [] as Array<{ root: { level: number; text: string; id: string }; children: Array<{ level: number; text: string; id: string }> }>;
    const groups: Array<{ root: { level: number; text: string; id: string }; children: Array<{ level: number; text: string; id: string }> }> = [];
    let currentRoot: { level: number; text: string; id: string } | null = null;

    markdownToc.forEach((item) => {
      if (item.level <= 2 || !currentRoot) {
        currentRoot = item;
        groups.push({ root: item, children: [] });
      } else {
        groups[groups.length - 1].children.push(item);
      }
    });

    return groups;
  }, [markdownToc]);

  const colorCounts = useMemo(
    () => highlights.reduce<Record<HighlightColor, number>>((acc, item) => {
      acc[item.color] += 1;
      return acc;
    }, { yellow: 0, green: 0, blue: 0, red: 0 }),
    [highlights],
  );

  const filteredHighlights = useMemo(
    () => highlights.filter((hl) => (highlightColorFilter === 'all' ? true : hl.color === highlightColorFilter)),
    [highlights, highlightColorFilter],
  );

  return (
    <motion.div initial={false} animate={{ width: showSidebar ? 350 : 0, opacity: showSidebar ? 1 : 0 }} className={cn('overflow-hidden h-full shrink-0', side === 'left' ? 'border-r' : 'border-l', styles.sidebarBorder)}>
      <div className="w-[350px] h-full flex flex-col">
        <div className={cn('grid grid-cols-5 border-b', styles.bg, styles.sidebarBorder)}>
          {(['chat', 'contents', 'highlights', 'bookmarks', 'search'] as SidebarTab[]).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={cn('py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors relative', activeTab === tab ? 'text-[#0052FF]' : cn(styles.tabInactiveText, styles.tabHoverText))}>
              {tab === 'chat' ? <Bot className="w-4 h-4" /> : tab === 'contents' ? <List className="w-4 h-4" /> : tab === 'highlights' ? 'H' : tab === 'bookmarks' ? <BookMarked className="w-4 h-4" /> : <Search className="w-4 h-4" />}
              {activeTab === tab && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0052FF]" />}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-hidden relative">
          <div className={cn('absolute inset-0 transition-all duration-300 ease-out', activeTab === 'chat' ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0 pointer-events-none')}>
            <ChatSidebar book={book} currentTextContext={currentContext || (typeof book.content === 'string' ? book.content.slice(0, 1000) : 'Select text to give context to AI.')} quotedText={quotedText} onClearQuote={onClearQuote} onClose={onClose} theme={theme} />
          </div>

          <div className={cn('absolute inset-0 transition-all duration-300 ease-out flex flex-col', activeTab === 'contents' ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0 pointer-events-none', styles.bg)}>
            <div className={cn('border-b px-4 py-2 text-xs flex items-center gap-2', styles.sidebarBorder, styles.subtleText)}><Clock3 className="w-3.5 h-3.5" />Estimated remaining reading: {Math.max(1, estimatedReadingMinutes || 1)} min</div>
            <div className="flex-1 overflow-y-auto p-4">
              {book.type === 'md' ? (
                <div className="space-y-1">
                  {groupedMarkdownToc.map(({ root, children }) => {
                    const isCollapsed = !!mdCollapsed[root.id];
                    const isActive = currentMdHeadingId === root.id;
                    return (
                      <div key={root.id}>
                        <div className="flex items-center gap-1">
                          {children.length > 0 ? (
                            <button className={cn('p-1 rounded transition-colors', styles.listItemHoverBg)} onClick={() => setMdCollapsed((prev) => ({ ...prev, [root.id]: !prev[root.id] }))}>
                              {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>
                          ) : (
                            <span className="w-6" />
                          )}
                          <button ref={isActive ? activeMdItemRef : null} onClick={() => scrollToHeading(root.id)} className={cn('flex-1 text-left py-2 px-2 rounded-lg text-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_24px_-20px_rgba(15,23,42,0.4)]', isActive ? 'bg-[#0052FF]/10 text-[#0052FF] font-medium' : styles.listItemHoverBg)}>
                            {root.text}
                          </button>
                        </div>
                        {children.length > 0 && !isCollapsed && (
                          <div className="ml-6 space-y-1">
                            {children.map((heading) => (
                              <button key={heading.id} onClick={() => scrollToHeading(heading.id)} className={cn('w-full text-left py-2 px-3 rounded-lg text-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_24px_-20px_rgba(15,23,42,0.4)]', currentMdHeadingId === heading.id ? 'bg-[#0052FF]/10 text-[#0052FF] font-medium' : styles.listItemHoverBg)}>
                                {heading.text}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : book.type === 'epub' ? (
                <EpubTocTree items={epubToc} goToEpubHref={goToEpubHref} listItemHoverBg={styles.listItemHoverBg} />
              ) : (
                <div className={cn('text-sm', styles.subtleText)}>No table of contents available.</div>
              )}
            </div>
          </div>

          <HighlightsPanel active={activeTab === 'highlights'} styles={styles} highlights={highlights} filteredHighlights={filteredHighlights} colorCounts={colorCounts} highlightColorFilter={highlightColorFilter} onHighlightColorFilterChange={onHighlightColorFilterChange} onExportHighlights={onExportHighlights} onHighlightClick={onHighlightClick} onDeleteHighlight={onDeleteHighlight} onUpdateHighlight={onUpdateHighlight} />

          <div className={cn('absolute inset-0 transition-all duration-300 ease-out flex flex-col', activeTab === 'bookmarks' ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0 pointer-events-none', styles.bg)}>
            <div className={cn('border-b px-4 py-3 text-xs', styles.sidebarBorder, styles.subtleText)}>Bookmarks: {bookmarks.length}</div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {bookmarks.map((bookmark) => {
                const isFocused = focusedBookmarkId === bookmark.id;
                const isEditing = editingBookmarkId === bookmark.id;
                return (
                  <div key={bookmark.id} className={cn('p-3 rounded-xl text-sm border transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_30px_-22px_rgba(15,23,42,0.45)]', styles.noteCardBg, styles.noteCardBorder, isFocused && 'ring-2 ring-[#0052FF]/40 border-[#0052FF]/30')}>
                    {isEditing ? (
                      <div className="space-y-2">
                        <input autoFocus value={bookmarkDraft} onChange={(e) => setBookmarkDraft(e.target.value)} className="w-full rounded-md border px-2 py-1 text-sm" />
                        <div className="flex justify-end gap-2">
                          <button onClick={() => setEditingBookmarkId(null)} className={cn('text-xs px-2 py-1 rounded-md transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_22px_-18px_rgba(15,23,42,0.4)]', styles.listItemHoverBg)}>Cancel</button>
                          <button onClick={() => { onRenameBookmark(bookmark.id, bookmarkDraft); setEditingBookmarkId(null); }} className="text-xs px-2 py-1 rounded-md bg-[#0052FF] text-white transition-all duration-200 hover:-translate-y-0.5">Save</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <button onClick={() => onBookmarkClick(bookmark)} className="w-full text-left">
                          <p className="font-medium line-clamp-2">{bookmark.label || 'Bookmark'}</p>
                          <p className={cn('text-xs mt-1', styles.subtleText)}>{new Date(bookmark.createdAt).toLocaleString()}</p>
                        </button>
                        <div className="mt-2 flex justify-end gap-2">
                          <button onClick={() => { setEditingBookmarkId(bookmark.id); setBookmarkDraft(bookmark.label || 'Bookmark'); }} className={cn('inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_22px_-18px_rgba(15,23,42,0.4)]', styles.listItemHoverBg)}><Pencil className="w-3.5 h-3.5" />Rename</button>
                          <button onClick={() => onDeleteBookmark(bookmark.id)} className={cn('inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_22px_-18px_rgba(15,23,42,0.4)]', styles.listItemHoverBg)}><Trash2 className="w-3.5 h-3.5" />Delete</button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className={cn('absolute inset-0 transition-all duration-300 ease-out flex flex-col', activeTab === 'search' ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0 pointer-events-none', styles.bg)}>
            <div className={cn('border-b p-4 space-y-3', styles.sidebarBorder)}>
              <input value={searchQuery} onChange={(e) => onSearchQueryChange(e.target.value)} placeholder="Search in full text..." className="w-full rounded-md border px-3 py-2 text-sm" />
              <div className="flex items-center justify-between">
                <label className="inline-flex items-center gap-2 text-xs opacity-80"><input type="checkbox" checked={searchCaseSensitive} onChange={(e) => onSearchCaseSensitiveChange(e.target.checked)} />Case sensitive</label>
                <div className="inline-flex gap-1">
                  <button onClick={onSearchPrev} className={cn('px-2 py-1 text-xs rounded-md transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_22px_-18px_rgba(15,23,42,0.4)]', styles.listItemHoverBg)}>Previous</button>
                  <button onClick={onSearchNext} className={cn('px-2 py-1 text-xs rounded-md transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_22px_-18px_rgba(15,23,42,0.4)]', styles.listItemHoverBg)}>Next</button>
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {!searchSupported ? (
                <p className={cn('text-sm', styles.subtleText)}>{searchSupportHint || 'Full-text search is not supported for this format.'}</p>
              ) : !searchQuery.trim() ? (
                <p className={cn('text-sm', styles.subtleText)}>Type keywords to search the full text.</p>
              ) : searchResults.length === 0 ? (
                <p className={cn('text-sm', styles.subtleText)}>No results found.</p>
              ) : (
                <div className="space-y-2">
                  <p className={cn('text-xs px-1', styles.subtleText)}>{searchResults.length} matches</p>
                  {searchResults.map((item) => (
                    <button key={item.id} onClick={() => onSearchResultClick(item.id)} className={cn('w-full text-left p-3 rounded-lg border transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_30px_-22px_rgba(15,23,42,0.45)]', styles.noteCardBg, styles.noteCardBorder, activeSearchResultId === item.id ? 'ring-2 ring-[#0052FF]/35 border-[#0052FF]/30' : styles.listItemHoverBg)}>
                      <p className={cn('text-xs mb-1', styles.subtleText)}>{item.contextLabel}</p>
                      <p className="text-sm line-clamp-2">{item.preview}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
