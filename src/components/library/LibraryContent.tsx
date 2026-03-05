import { AnimatePresence, motion } from 'motion/react';
import { BookMarked, BookOpen, Check, Edit2, FileCode2, FileText, Globe, Highlighter, MoreVertical, NotebookPen, Plus, Pin, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Book, Category } from '@/lib/db';
import { BookCoverFallback } from './BookCoverFallback';

interface LibraryContentProps {
  books: Book[];
  categories: Category[];
  filteredBooks: Book[];
  loading: boolean;
  selectedCategoryId: string | null;
  setSelectedCategoryId: (id: string | null) => void;
  editingBookId: string | null;
  setEditingBookId: (id: string | null) => void;
  setCategoryToRename: (category: Category | null) => void;
  setRenameCategoryName: (name: string) => void;
  setCategoryToDelete: (category: Category | null) => void;
  setDeleteCategoryMode: (mode: 'keep-books' | 'delete-books') => void;
  showCategoryInput: boolean;
  setShowCategoryInput: (show: boolean) => void;
  newCategoryName: string;
  setNewCategoryName: (name: string) => void;
  handleAddCategory: () => void;
  handleEditClick: (book: Book) => void;
  handleUpdateCategory: (book: Book, categoryName: string | undefined) => void;
  handleTogglePinBook: (book: Book) => void;
  handleDelete: (e: React.MouseEvent, id: string) => void;
  onSelectBook: (book: Book) => void;
  onShowUpload: () => void;
  onOpenInsights: () => void;
}

export function LibraryContent(props: LibraryContentProps) {
  const {
    books,
    categories,
    filteredBooks,
    loading,
    selectedCategoryId,
    setSelectedCategoryId,
    editingBookId,
    setEditingBookId,
    setCategoryToRename,
    setRenameCategoryName,
    setCategoryToDelete,
    setDeleteCategoryMode,
    showCategoryInput,
    setShowCategoryInput,
    newCategoryName,
    setNewCategoryName,
    handleAddCategory,
    handleEditClick,
    handleUpdateCategory,
    handleTogglePinBook,
    handleDelete,
    onSelectBook,
    onShowUpload,
    onOpenInsights,
  } = props;

  const totalBooks = books.length;
  const recentBook = [...books].sort((a, b) => (b.lastRead || 0) - (a.lastRead || 0))[0];
  const categoriesUsedCount = new Set(books.map((b) => b.category).filter(Boolean)).size;

  const shouldUseGeneratedLook = (book: Book) => !book.cover || (book.type === 'pdf' && book.cover.startsWith('data:image/svg+xml'));

  const getBookStats = (book: Book) => {
    const notesCount = (book.highlights || []).filter((item) => Boolean(item.note?.trim())).length;
    const highlightsCount = (book.highlights || []).length;
    const bookmarksCount = (book.bookmarks || []).length;
    return { notesCount, highlightsCount, bookmarksCount };
  };

  const getWebDomain = (book: Book) => {
    if (book.type !== 'web' || typeof book.content !== 'string') return null;
    try {
      return new URL(book.content).hostname.replace(/^www\./i, '');
    } catch {
      return null;
    }
  };

  const getBookTypeMeta = (bookType: Book['type']) => {
    switch (bookType) {
      case 'pdf':
        return {
          label: 'PDF',
          icon: FileCode2,
          chipClassName: 'border-slate-200 bg-white text-slate-700',
          glowClassName: 'from-[#0052FF]/35 via-[#4D7CFF]/15 to-transparent',
        };
      case 'epub':
        return {
          label: 'EPUB',
          icon: BookOpen,
          chipClassName: 'border-slate-200 bg-white text-slate-700',
          glowClassName: 'from-[#0052FF]/35 via-[#4D7CFF]/15 to-transparent',
        };
      case 'txt':
        return {
          label: 'TXT',
          icon: FileText,
          chipClassName: 'border-slate-200 bg-white text-slate-700',
          glowClassName: 'from-[#0052FF]/35 via-[#4D7CFF]/15 to-transparent',
        };
      case 'md':
        return {
          label: 'Markdown',
          icon: FileText,
          chipClassName: 'border-slate-200 bg-white text-slate-700',
          glowClassName: 'from-[#0052FF]/35 via-[#4D7CFF]/15 to-transparent',
        };
      case 'web':
        return {
          label: 'Web',
          icon: Globe,
          chipClassName: 'border-slate-200 bg-white text-slate-700',
          glowClassName: 'from-[#0052FF]/35 via-[#4D7CFF]/15 to-transparent',
        };
      default:
        return {
          label: String(bookType).toUpperCase(),
          icon: BookOpen,
          chipClassName: 'border-slate-200 bg-white text-slate-700',
          glowClassName: 'from-[#0052FF]/35 via-[#4D7CFF]/15 to-transparent',
        };
    }
  };

  const selectedCategory = categories.find((cat) => cat.id === selectedCategoryId) || null;

  const formatSummary = books.reduce<Record<string, number>>((acc, book) => {
    acc[book.type] = (acc[book.type] || 0) + 1;
    return acc;
  }, {});

  const formatSummaryText = Object.entries(formatSummary)
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => `${getBookTypeMeta(type as Book['type']).label} ${count}`)
    .join(' · ');

  return (
    <main className="mx-auto max-w-7xl px-6 py-10 space-y-10">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
          className="lg:col-span-2 relative overflow-hidden rounded-[28px] border border-slate-200/70 bg-white p-8 shadow-[0_28px_60px_-36px_rgba(15,23,42,0.42)]"
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(77,124,255,0.14)_0%,rgba(77,124,255,0)_45%)]" />
          <div className="pointer-events-none absolute right-0 top-0 h-32 w-32 translate-x-10 -translate-y-10 rounded-full bg-[#4D7CFF]/20 blur-2xl" />

          <div className="relative z-10 flex min-h-[220px] flex-col justify-between">
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <p className="inline-flex items-center rounded-full border border-[#0052FF]/20 bg-[#0052FF]/5 px-3 py-1 text-xs font-semibold tracking-wide text-[#0052FF]">
                  LIBRARY HOME
                </p>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-medium text-slate-500">
                  <span className="h-2 w-2 rounded-full bg-[#4D7CFF] animate-pulse" />
                  Focus mode ready
                </span>
              </div>
              <h2 className="max-w-3xl text-3xl font-serif font-bold leading-[1.08] tracking-[-0.015em] text-slate-900 md:text-4xl">
                {recentBook ? (
                  <>
                    Continue reading{' '}
                    <span className="bg-gradient-to-r from-[#0052FF] to-[#4D7CFF] bg-clip-text text-transparent">
                      “{recentBook.title}”
                    </span>
                  </>
                ) : (
                  <>
                    Build your
                    <span className="bg-gradient-to-r from-[#0052FF] to-[#4D7CFF] bg-clip-text text-transparent"> modern reading library</span>
                  </>
                )}
              </h2>
              <p className="mt-4 max-w-xl text-sm leading-relaxed text-slate-600 md:text-base">
                {recentBook
                  ? 'Structured shelves, cleaner focus, and a premium reading rhythm. Pick up exactly where your flow stopped.'
                  : 'Import your first book and shape a calm, high-focus knowledge workspace.'}
              </p>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              {recentBook && (
                <motion.button
                  whileHover={{ y: -2, scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => onSelectBook(recentBook)}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#0052FF] to-[#4D7CFF] px-5 py-3 text-sm font-semibold text-white shadow-[0_16px_34px_-18px_rgba(0,82,255,0.8)] transition-all duration-300 hover:shadow-[0_24px_42px_-18px_rgba(0,82,255,0.75)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#0052FF]/25"
                >
                  <BookOpen className="h-4 w-4" />
                  Continue Reading
                </motion.button>
              )}

              <motion.button
                whileHover={{ y: -2, scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={onOpenInsights}
                className="inline-flex items-center gap-2 rounded-xl border border-[#4D7CFF]/30 bg-white/90 px-5 py-3 text-sm font-semibold text-[#1E3A8A] shadow-[0_14px_30px_-20px_rgba(30,58,138,0.45)] backdrop-blur transition-all duration-300 hover:border-[#4D7CFF]/50 hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#0052FF]/20"
              >
                <span className="h-2 w-2 rounded-full bg-[#4D7CFF]" />
                View Insights
              </motion.button>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.05, ease: 'easeOut' }}
          className="relative overflow-hidden rounded-[28px] border border-[#1E293B]/90 bg-[#0F172A] p-8 text-white shadow-[0_28px_60px_-34px_rgba(15,23,42,0.72)]"
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_0%,rgba(77,124,255,0.35)_0%,rgba(77,124,255,0)_48%)]" />
          <div className="relative z-10 flex h-full flex-col justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">Overview</h3>
            <div className="space-y-5">
              <div>
                <p className="text-4xl font-serif font-bold leading-none">{totalBooks}</p>
                <p className="mt-2 text-sm text-slate-300">Total Books</p>
              </div>
              <div className="h-px bg-white/15" />
              <div>
                <p className="bg-gradient-to-r from-[#0052FF] to-[#4D7CFF] bg-clip-text text-4xl font-serif font-bold leading-none text-transparent">
                  {categoriesUsedCount}
                </p>
                <p className="mt-2 text-sm text-slate-300">Shelves in Use</p>
              </div>
              <div className="h-px bg-white/15" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Format Mix</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-200">
                  {formatSummaryText || 'No books yet'}
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1, ease: 'easeOut' }}
        className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_18px_42px_-34px_rgba(15,23,42,0.55)]"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-1">
            <label htmlFor="shelf-filter" className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              Shelf Filter
            </label>
            <select
              id="shelf-filter"
              value={selectedCategoryId ?? 'all'}
              onChange={(e) => setSelectedCategoryId(e.target.value === 'all' ? null : e.target.value)}
              className="w-full min-w-[220px] rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none transition-all duration-200 focus:border-[#4D7CFF] focus:ring-4 focus:ring-[#0052FF]/10"
              title="Filter books by shelf"
            >
              <option value="all">All Library</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {selectedCategory && (
              <div className="mr-1 flex items-center gap-1 border-r border-slate-200 pr-3">
                <button
                  onClick={() => {
                    setCategoryToRename(selectedCategory);
                    setRenameCategoryName(selectedCategory.name);
                  }}
                  className="rounded-full p-2 text-slate-400 transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#0052FF]/10 hover:text-[#0052FF] active:scale-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#0052FF]/20"
                  title="Rename shelf"
                  aria-label="Rename shelf"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => {
                    setCategoryToDelete(selectedCategory);
                    setDeleteCategoryMode('keep-books');
                  }}
                  className="rounded-full p-2 text-slate-400 transition-all duration-200 hover:-translate-y-0.5 hover:bg-red-50 hover:text-red-600 active:scale-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-200/60"
                  title="Delete shelf"
                  aria-label="Delete shelf"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            )}

            {showCategoryInput ? (
              <div className="flex items-center rounded-full border border-slate-200 bg-white px-1 py-0.5">
                <input
                  autoFocus
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                  onBlur={() => setTimeout(() => setShowCategoryInput(false), 200)}
                  placeholder="New shelf name"
                  className="w-36 border-none bg-transparent px-3 py-1 text-sm text-slate-900 outline-none placeholder:text-slate-400"
                />
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={handleAddCategory}
                  className="rounded-full bg-gradient-to-r from-[#0052FF] to-[#4D7CFF] p-1.5 text-white transition-all duration-200 hover:-translate-y-0.5 hover:opacity-90 active:scale-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#0052FF]/25"
                  title="Create shelf"
                  aria-label="Create shelf"
                >
                  <Check className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowCategoryInput(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#0052FF]/30 hover:bg-[#0052FF]/5 hover:text-[#0052FF] active:scale-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#0052FF]/20"
                title="Add a new shelf"
              >
                <Plus className="h-4 w-4" />
                Add Shelf
              </button>
            )}
          </div>
        </div>
      </motion.div>

      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Your Collection</span>
          <span className="h-px min-w-[80px] flex-1 bg-slate-200" />
          <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
            {filteredBooks.length} {filteredBooks.length === 1 ? 'Book' : 'Books'}
          </span>
          {selectedCategory && (
            <span className="inline-flex items-center rounded-full border border-[#0052FF]/20 bg-[#0052FF]/5 px-3 py-1 text-xs font-semibold text-[#0052FF]">
              Shelf: {selectedCategory.name}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          <AnimatePresence mode="popLayout">
            {filteredBooks.map((book, index) => {
              const { notesCount, highlightsCount, bookmarksCount } = getBookStats(book);
              const typeMeta = getBookTypeMeta(book.type);
              const TypeIcon = typeMeta.icon;

            return (
              <motion.div
                layout
                key={book.id}
                initial={{ opacity: 0, y: 14, scale: 0.965 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.96 }}
                transition={{ type: 'spring', stiffness: 250, damping: 22, delay: Math.min(index * 0.028, 0.16) }}
                whileHover={{ y: -8, scale: 1.012 }}
                whileTap={{ scale: 0.992 }}
                onClick={() => onSelectBook(book)}
                className={cn('group relative z-0 flex cursor-pointer flex-col transition-transform duration-300', editingBookId === book.id && 'z-50')}
              >
                <div className="relative aspect-[2/3] w-full overflow-hidden rounded-2xl border border-slate-200/90 bg-slate-100 shadow-[0_16px_34px_-20px_rgba(15,23,42,0.55)] transition-all duration-400 group-hover:border-[#4D7CFF]/35 group-hover:shadow-[0_24px_44px_-22px_rgba(15,23,42,0.52)]">
                  <div className={cn('pointer-events-none absolute inset-0 bg-gradient-to-br opacity-0 transition-opacity duration-500 group-hover:opacity-100', typeMeta.glowClassName)} />

                  {!shouldUseGeneratedLook(book) ? (
                    <img src={book.cover} alt={book.title} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.05]" />
                  ) : (
                    <BookCoverFallback title={book.title} author={book.author} type={book.type} />
                  )}

                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent opacity-50 transition-opacity duration-300 group-hover:opacity-95" />

                  {book.isPinned && (
                    <div className="absolute left-2 top-2 z-10 inline-flex items-center gap-1 rounded-full border border-[#4D7CFF]/35 bg-[#0F172A]/65 px-2.5 py-1 text-[10px] font-semibold text-white backdrop-blur-md">
                      <Pin className="h-3 w-3 fill-current text-[#8FB2FF]" />
                      Pinned
                    </div>
                  )}

                  <div className="absolute bottom-2 left-2 right-2 z-10 rounded-xl border border-white/15 bg-black/40 px-2 py-1.5 text-white backdrop-blur-md">
                    <div className="grid grid-cols-3 gap-1 text-[10px] font-semibold">
                      <div className="inline-flex items-center justify-center gap-1 rounded-md bg-white/10 py-1" title="Notes" aria-label={`Notes ${notesCount}`}>
                        <NotebookPen className="h-3 w-3 text-orange-200" />
                        <span>{notesCount}</span>
                      </div>
                      <div className="inline-flex items-center justify-center gap-1 rounded-md bg-white/10 py-1" title="Bookmarks" aria-label={`Bookmarks ${bookmarksCount}`}>
                        <BookMarked className="h-3 w-3 text-sky-200" />
                        <span>{bookmarksCount}</span>
                      </div>
                      <div className="inline-flex items-center justify-center gap-1 rounded-md bg-white/10 py-1" title="Highlights" aria-label={`Highlights ${highlightsCount}`}>
                        <Highlighter className="h-3 w-3 text-emerald-200" />
                        <span>{highlightsCount}</span>
                      </div>
                    </div>
                  </div>

                  <div className="absolute right-2 top-2 translate-y-1 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingBookId(editingBookId === book.id ? null : book.id);
                      }}
                      className="rounded-full bg-white/92 p-2 text-slate-800 shadow-sm transition-all hover:scale-105 hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#0052FF]/25"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </div>

                  {typeof book.progress === 'number' && book.progress > 0 && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/25">
                      <motion.div
                        className="h-full bg-gradient-to-r from-[#0052FF] to-[#4D7CFF]"
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, book.progress * 100)}%` }}
                        transition={{ duration: 0.5, ease: 'easeOut' }}
                      />
                    </div>
                  )}
                </div>

                <div className="mt-4 space-y-2 transition-transform duration-300 group-hover:-translate-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold', typeMeta.chipClassName)}>
                      <TypeIcon className="h-3.5 w-3.5 text-[#0052FF]" />
                      {typeMeta.label}
                    </span>
                    {book.type === 'web' && getWebDomain(book) && (
                      <span className="inline-flex items-center rounded-full border border-[#0052FF]/20 bg-[#0052FF]/5 px-2.5 py-1 text-[11px] font-medium text-[#0052FF]">
                        {getWebDomain(book)}
                      </span>
                    )}
                  </div>

                  <h3 className="line-clamp-2 font-serif text-[17px] font-bold leading-tight text-slate-900 transition-all duration-200 group-hover:text-[#0052FF]">
                    {book.title}
                  </h3>
                  <p className="line-clamp-1 text-sm font-medium text-slate-500">{book.author || 'Unknown Author'}</p>
                </div>

                {editingBookId === book.id && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.96 }}
                    transition={{ type: 'spring', stiffness: 320, damping: 24 }}
                    className="absolute right-0 top-12 z-50 w-56 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="p-1.5">
                      <button
                        onClick={() => handleEditClick(book)}
                        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-700 transition-all duration-200 hover:-translate-y-0.5 hover:bg-slate-50 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#0052FF]/20"
                      >
                        <Edit2 className="h-4 w-4 text-slate-400" /> Edit Details
                      </button>
                      <button
                        onClick={() => handleTogglePinBook(book)}
                        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-700 transition-all duration-200 hover:-translate-y-0.5 hover:bg-slate-50 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#0052FF]/20"
                      >
                        <Pin className={cn('h-4 w-4', book.isPinned ? 'fill-current text-[#0052FF]' : 'text-slate-400')} />
                        {book.isPinned ? 'Unpin book' : 'Pin book'}
                      </button>
                    </div>

                    <div className="my-0.5 h-px bg-slate-100" />

                    <div className="max-h-60 overflow-y-auto p-1.5">
                      {categories.map((cat) => (
                        <button
                          key={cat.id}
                          onClick={() => handleUpdateCategory(book, cat.name)}
                          className={cn(
                            'flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#0052FF]/20',
                            book.category === cat.name ? 'bg-[#0052FF]/8 font-medium text-[#0052FF]' : 'text-slate-600 hover:bg-slate-50'
                          )}
                        >
                          <span className="truncate">{cat.name}</span>
                          {book.category === cat.name && <Check className="h-3.5 w-3.5 shrink-0" />}
                        </button>
                      ))}

                      {book.category && (
                        <button
                          onClick={() => handleUpdateCategory(book, undefined)}
                          className="mt-1 w-full rounded-xl px-3 py-2 text-left text-sm text-slate-500 transition-all duration-200 hover:-translate-y-0.5 hover:bg-slate-50 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#0052FF]/20"
                        >
                          Uncategorized
                        </button>
                      )}
                    </div>

                    <div className="my-0.5 h-px bg-slate-100" />

                    <div className="p-1.5">
                      <button
                        onClick={(e) => handleDelete(e, book.id)}
                        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-red-600 transition-all duration-200 hover:-translate-y-0.5 hover:bg-red-50 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-200/60"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Delete Book
                      </button>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>

        {filteredBooks.length === 0 && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="col-span-full flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white py-28 text-slate-500"
          >
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full border border-slate-200 bg-slate-50">
              <BookOpen className="h-8 w-8 text-slate-300" />
            </div>
            <p className="text-lg font-semibold text-slate-900">No books found</p>
            <p className="mb-6 text-sm">Your library is ready for a fresh first upload.</p>
            <motion.button
              whileHover={{ y: -2, scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              onClick={onShowUpload}
              className="rounded-full bg-gradient-to-r from-[#0052FF] to-[#4D7CFF] px-6 py-2.5 text-sm font-semibold text-white shadow-[0_16px_34px_-18px_rgba(0,82,255,0.8)] transition-all hover:opacity-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#0052FF]/25"
            >
              Add your first book
            </motion.button>
          </motion.div>
        )}
        </div>
      </div>
    </main>
  );
}
