import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  Book,
  Category,
  deleteBook,
  deleteCategory,
  getAllBooks,
  getAllCategories,
  getBook,
  saveBook,
  saveCategory,
} from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { useDropzone } from 'react-dropzone';
import ePub from 'epubjs';
import { pdfjs } from 'react-pdf';
import { LibraryHeader } from './library/LibraryHeader';
import { LibraryContent } from './library/LibraryContent';
import { LibraryModals } from './library/LibraryModals';
import { splitTextByVisualWidth } from './library/coverTextLayout';
import { pickCoverPalette } from './library/coverPalette';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

interface LibraryProps {
  onSelectBook: (book: Book) => void;
}

const INVALID_TITLE_PATTERNS = [
  /^untitled$/i,
  /^new\s+document$/i,
  /^document$/i,
  /^slide\s*\d+$/i,
  /^幻灯片\s*\d+$/i,
  /^powerpoint\s*演示文稿$/i,
  /^microsoft\s*powerpoint/i,
  /^adobe\s*acrobat\s*document$/i,
];

function stripBookExtension(fileName: string) {
  return fileName.replace(/\.(txt|pdf|epub|md)$/i, '');
}

function normalizeText(input: string | null | undefined) {
  return (input || '').replace(/\s+/g, ' ').trim();
}

function isMeaningfulTitle(value: string | null | undefined) {
  const title = normalizeText(value);
  if (!title) return false;
  if (title.length < 2) return false;
  if (INVALID_TITLE_PATTERNS.some((pattern) => pattern.test(title))) return false;
  return true;
}

function sanitizeAuthor(raw: unknown): string | undefined {
  if (Array.isArray(raw)) {
    const merged = raw.map((item) => normalizeText(String(item))).filter(Boolean).join(', ');
    return merged || undefined;
  }

  const author = normalizeText(typeof raw === 'string' ? raw : undefined);
  if (!author) return undefined;
  if (/^unknown\s*author$/i.test(author)) return undefined;
  return author;
}

function inferAuthorAndTitleFromFilename(fileNameNoExt: string) {
  const normalized = normalizeText(fileNameNoExt);
  const separators = [' - ', ' — ', ' – ', '_-_'];

  for (const separator of separators) {
    if (!normalized.includes(separator)) continue;
    const parts = normalized.split(separator).map((part) => normalizeText(part)).filter(Boolean);
    if (parts.length < 2) continue;
    const inferredAuthor = parts[0];
    const inferredTitle = parts.slice(1).join(' - ');
    if (isMeaningfulTitle(inferredTitle)) {
      return {
        author: inferredAuthor || undefined,
        title: inferredTitle,
      };
    }
  }

  return {
    author: undefined,
    title: normalized,
  };
}

function createFallbackCover(title: string, author?: string) {
  const safeTitle = normalizeText(title) || 'Untitled';
  const safeAuthor = normalizeText(author) || 'Unknown Author';
  const palette = pickCoverPalette(`${safeTitle}:${safeAuthor}`);

  const titleLines = splitTextByVisualWidth(safeTitle, { maxLines: 4, maxLineWidth: 8.2 });
  const lineHeight = 68;
  const titleStartY = 230;
  const titleText = titleLines
    .map((line, index) => `<tspan x="72" y="${titleStartY + index * lineHeight}">${line}</tspan>`)
    .join('');

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="600" height="900" viewBox="0 0 600 900">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${palette.bg1}"/>
          <stop offset="58%" stop-color="${palette.bg2}"/>
          <stop offset="100%" stop-color="${palette.bg3 || palette.bg2}"/>
        </linearGradient>
        <radialGradient id="shine" cx="0.2" cy="0.1" r="0.9">
          <stop offset="0%" stop-color="rgba(255,255,255,0.22)"/>
          <stop offset="100%" stop-color="rgba(255,255,255,0)"/>
        </radialGradient>
      </defs>
      <rect width="600" height="900" fill="url(#g)" rx="36"/>
      <rect width="600" height="900" fill="url(#shine)" rx="36"/>
      <rect x="40" y="40" width="520" height="820" rx="26" fill="rgba(255,255,255,0.07)"/>
      <text fill="${palette.text}" font-size="54" font-family="Georgia, serif" font-weight="700">${titleText}</text>
      <text x="72" y="760" fill="${palette.subtleText}" font-size="26" font-family="Inter, Arial, sans-serif">${safeAuthor}</text>
      <text x="72" y="810" fill="${palette.subtleText}" font-size="20" font-family="Inter, Arial, sans-serif" letter-spacing="4">LUMINA READER</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

async function blobToDataURL(blob: Blob): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read blob as data URL'));
    reader.readAsDataURL(blob);
  });
}

async function fileToDataURL(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file as data URL'));
    reader.readAsDataURL(file);
  });
}

export function Library({ onSelectBook }: LibraryProps) {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [editingBookId, setEditingBookId] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [showCategoryInput, setShowCategoryInput] = useState(false);

  const [bookToEdit, setBookToEdit] = useState<Book | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editAuthor, setEditAuthor] = useState('');
  const [editCover, setEditCover] = useState<string | undefined>(undefined);
  const [isProcessingCover, setIsProcessingCover] = useState(false);
  
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; bookId: string | null }>({ isOpen: false, bookId: null });
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showWebModal, setShowWebModal] = useState(false);
  const [webInputUrl, setWebInputUrl] = useState('');
  const [webInputTitle, setWebInputTitle] = useState('');
  const [webInputAuthor, setWebInputAuthor] = useState('Web Source');

  const [categoryToRename, setCategoryToRename] = useState<Category | null>(null);
  const [renameCategoryName, setRenameCategoryName] = useState('');
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
  const [deleteCategoryMode, setDeleteCategoryMode] = useState<'keep-books' | 'delete-books'>('keep-books');

  useEffect(() => {
    loadData();
  }, []);

  const sortBooksIndustrial = (input: Book[]) => {
    return [...input].sort((a, b) => {
      const pinDelta = Number(Boolean(b.isPinned)) - Number(Boolean(a.isPinned));
      if (pinDelta !== 0) return pinDelta;
      return (b.addedAt || 0) - (a.addedAt || 0);
    });
  };

  async function loadData() {
    try {
      const [loadedBooks, loadedCategories] = await Promise.all([getAllBooks(), getAllCategories()]);
      const uniqueBooks = Array.from(new Map(loadedBooks.map((b) => [b.id, b])).values());
      const uniqueCategories = Array.from(new Map(loadedCategories.map((c) => [c.id, c])).values());
      setBooks(sortBooksIndustrial(uniqueBooks));
      setCategories(uniqueCategories.sort((a, b) => a.createdAt - b.createdAt));
    } catch (e) {
      console.error('Failed to load data', e);
    } finally {
      setLoading(false);
    }
  }

  async function extractBookMetadata(file: File, type: Book['type'], content: string | ArrayBuffer) {
    const fileNameNoExt = stripBookExtension(file.name);
    const inferred = inferAuthorAndTitleFromFilename(fileNameNoExt);

    let finalTitle = isMeaningfulTitle(inferred.title) ? inferred.title : fileNameNoExt;
    let finalAuthor = sanitizeAuthor(inferred.author) || 'Unknown Author';
    let cover: string | undefined;

    try {
      if (type === 'epub') {
        const epubBook = ePub((content as ArrayBuffer).slice(0));
        await epubBook.ready;

        const metadata = await epubBook.loaded.metadata;
        const epubTitle = normalizeText(metadata?.title);
        const epubAuthor = sanitizeAuthor(metadata?.creator);

        if (isMeaningfulTitle(epubTitle)) {
          finalTitle = epubTitle;
        }

        if (epubAuthor) {
          finalAuthor = epubAuthor;
        }

        try {
          const coverUrl = await epubBook.coverUrl();
          if (coverUrl) {
            const response = await fetch(coverUrl);
            if (response.ok) {
              const blob = await response.blob();
              cover = await blobToDataURL(blob);
            }
          }
        } catch (coverError) {
          console.warn('Failed to extract EPUB cover', coverError);
        }
      }

      if (type === 'pdf') {
        const doc = await pdfjs.getDocument((content as ArrayBuffer).slice(0)).promise;
        const metadata = await doc.getMetadata();
        const info = metadata.info as { Title?: string; Author?: string } | undefined;

        const pdfTitle = normalizeText(info?.Title);
        const pdfAuthor = sanitizeAuthor(info?.Author);

        if (isMeaningfulTitle(pdfTitle)) {
          finalTitle = pdfTitle;
        } else {
          finalTitle = normalizeText(fileNameNoExt) || finalTitle;
        }

        if (pdfAuthor) {
          finalAuthor = pdfAuthor;
        }
      }

      if ((type === 'txt' || type === 'md') && sanitizeAuthor(inferred.author)) {
        finalAuthor = sanitizeAuthor(inferred.author) || finalAuthor;
      }
    } catch (e) {
      console.error('Failed to extract metadata', e);
    }

    finalTitle = isMeaningfulTitle(finalTitle) ? normalizeText(finalTitle) : normalizeText(fileNameNoExt);
    finalAuthor = sanitizeAuthor(finalAuthor) || 'Unknown Author';

    if (!cover) {
      cover = createFallbackCover(finalTitle, finalAuthor);
    }

    return {
      title: finalTitle,
      author: finalAuthor,
      cover,
    };
  }

  const onDrop = async (acceptedFiles: File[]) => {
    for (const file of acceptedFiles) {
      const type = file.name.endsWith('.epub') ? 'epub' : file.name.endsWith('.pdf') ? 'pdf' : file.name.endsWith('.md') ? 'md' : 'txt';
      const content: string | ArrayBuffer = type === 'txt' || type === 'md' ? await file.text() : await file.arrayBuffer();

      const metadata = await extractBookMetadata(file, type, content);
      const categoryName = categories.find((c) => c.id === selectedCategoryId)?.name;

      await saveBook({
        id: uuidv4(),
        title: metadata.title,
        author: metadata.author,
        type,
        content,
        cover: metadata.cover,
        addedAt: Date.now(),
        progress: 0,
        highlights: [],
        category: categoryName,
      });
    }
    await loadData();
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop: async (files) => {
      await onDrop(files);
      setShowUploadModal(false);
    },
    accept: {
      'text/plain': ['.txt'],
      'text/markdown': ['.md'],
      'application/pdf': ['.pdf'],
      'application/epub+zip': ['.epub'],
    },
  });

  const handleEditClick = (book: Book) => {
    setBookToEdit(book);
    setEditTitle(book.title);
    setEditAuthor(book.author || '');
    setEditCover(book.cover);
    setEditingBookId(null);
  };

  const handleEditCoverFile = async (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('请上传图片格式文件作为封面');
      return;
    }

    setIsProcessingCover(true);
    try {
      const dataUrl = await fileToDataURL(file);
      setEditCover(dataUrl);
    } catch (e) {
      console.error('Failed to process cover image', e);
      alert('封面处理失败，请重试');
    } finally {
      setIsProcessingCover(false);
    }
  };

  const handleResetCover = () => {
    setEditCover(createFallbackCover(editTitle || bookToEdit?.title || 'Untitled', editAuthor || bookToEdit?.author || 'Unknown Author'));
  };

  const handleSaveEdit = async () => {
    if (!bookToEdit) return;
    const normalizedTitle = isMeaningfulTitle(editTitle) ? normalizeText(editTitle) : bookToEdit.title;
    const normalizedAuthor = sanitizeAuthor(editAuthor) || 'Unknown Author';
    const finalCover = editCover || createFallbackCover(normalizedTitle, normalizedAuthor);

    await saveBook({ ...bookToEdit, title: normalizedTitle, author: normalizedAuthor, cover: finalCover });
    setBookToEdit(null);
    await loadData();
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDeleteConfirm({ isOpen: true, bookId: id });
    setEditingBookId(null);
  };

  const confirmDelete = async () => {
    if (!deleteConfirm.bookId) return;
    await deleteBook(deleteConfirm.bookId);
    setDeleteConfirm({ isOpen: false, bookId: null });
    await loadData();
  };
  
  const handleUpdateCategory = async (book: Book, newCat: string | undefined) => {
    await saveBook({ ...book, category: newCat });
    setEditingBookId(null);
    await loadData();
  };

  const handleTogglePinBook = async (book: Book) => {
    await saveBook({ ...book, isPinned: !book.isPinned });
    setEditingBookId(null);
    await loadData();
  };

  const handleAddCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) return;
    if (categories.some((c) => c.name === name)) return alert('Category already exists');
    const newCat = { id: uuidv4(), name, createdAt: Date.now() };
    await saveCategory(newCat);
    setCategories((prev) => [...prev, newCat]);
    setSelectedCategoryId(newCat.id);
    setNewCategoryName('');
    setShowCategoryInput(false);
  };

  const normalizeWebUrl = (input: string) => {
    const trimmed = input.trim();
    if (!trimmed) return '';
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `https://${trimmed}`;
  };

  const handleAddWebBook = async () => {
    const normalizedUrl = normalizeWebUrl(webInputUrl);
    if (!normalizedUrl) {
      alert('请输入有效 URL');
      return;
    }

    const categoryName = categories.find((c) => c.id === selectedCategoryId)?.name;
    const fallbackTitle = (() => {
      try {
        return new URL(normalizedUrl).hostname;
      } catch {
        return 'Web Article';
      }
    })();

    await saveBook({
      id: uuidv4(),
      title: normalizeText(webInputTitle) || fallbackTitle,
      author: normalizeText(webInputAuthor) || 'Web Source',
      type: 'web',
      content: normalizedUrl,
      cover: createFallbackCover(normalizeText(webInputTitle) || fallbackTitle, normalizeText(webInputAuthor) || 'Web Source'),
      addedAt: Date.now(),
      progress: 0,
      highlights: [],
      bookmarks: [],
      category: categoryName,
    });

    setShowWebModal(false);
    setWebInputUrl('');
    setWebInputTitle('');
    setWebInputAuthor('Web Source');
    await loadData();
  };

  const handleRenameCategory = async () => {
    if (!categoryToRename || !renameCategoryName.trim()) return;
    const updatedCategory: Category = { ...categoryToRename, name: renameCategoryName.trim() };
    await saveCategory(updatedCategory);
    const booksToUpdate = books.filter((b) => b.category === categoryToRename.name);
    for (const book of booksToUpdate) {
      const fresh = await getBook(book.id);
      if (fresh) await saveBook({ ...fresh, category: updatedCategory.name });
    }
    setCategoryToRename(null);
    setRenameCategoryName('');
    await loadData();
  };

  const handleDeleteCategory = async () => {
    if (!categoryToDelete) return;
    const booksInCategory = books.filter((b) => b.category === categoryToDelete.name);
    if (deleteCategoryMode === 'delete-books') {
      for (const book of booksInCategory) await deleteBook(book.id);
    } else {
      for (const book of booksInCategory) {
        const fresh = await getBook(book.id);
        if (fresh) await saveBook({ ...fresh, category: undefined });
      }
    }
    await deleteCategory(categoryToDelete.id);
    if (selectedCategoryId === categoryToDelete.id) setSelectedCategoryId(null);
    setCategoryToDelete(null);
    await loadData();
  };

  const filteredBooks = books.filter((b) => {
    const matchesFilter = b.title.toLowerCase().includes(filter.toLowerCase()) || (b.author && b.author.toLowerCase().includes(filter.toLowerCase()));
    const selectedCategoryName = categories.find((c) => c.id === selectedCategoryId)?.name ?? null;
    const matchesCategory = selectedCategoryId === null || b.category === selectedCategoryName;
    return matchesFilter && matchesCategory;
  });

  return (
    <div className="min-h-screen bg-[#fcfcfc] text-gray-900 font-sans selection:bg-brand-orange/20 pb-20">
      <div className="fixed inset-0 opacity-[0.015] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

      <LibraryModals
        showUploadModal={showUploadModal}
        setShowUploadModal={setShowUploadModal}
        getRootProps={getRootProps}
        getInputProps={getInputProps}
        isDragActive={isDragActive}
        bookToEdit={bookToEdit}
        setBookToEdit={setBookToEdit}
        editTitle={editTitle}
        setEditTitle={setEditTitle}
        editAuthor={editAuthor}
        setEditAuthor={setEditAuthor}
        editCover={editCover}
        onEditCoverFile={handleEditCoverFile}
        onResetCover={handleResetCover}
        isProcessingCover={isProcessingCover}
        handleSaveEdit={handleSaveEdit}
        deleteConfirm={deleteConfirm}
        setDeleteConfirm={setDeleteConfirm}
        confirmDelete={confirmDelete}
        categoryToRename={categoryToRename}
        setCategoryToRename={setCategoryToRename}
        renameCategoryName={renameCategoryName}
        setRenameCategoryName={setRenameCategoryName}
        handleRenameCategory={handleRenameCategory}
        categoryToDelete={categoryToDelete}
        setCategoryToDelete={setCategoryToDelete}
        deleteCategoryMode={deleteCategoryMode}
        setDeleteCategoryMode={setDeleteCategoryMode}
        handleDeleteCategory={handleDeleteCategory}
      />

      {showWebModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/45 backdrop-blur-md" onClick={() => setShowWebModal(false)} />
          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.97 }}
            transition={{ duration: 0.24, ease: 'easeOut' }}
            className="relative z-10 w-full max-w-md space-y-4 overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 p-6 shadow-[0_28px_80px_-38px_rgba(15,23,42,0.45)] backdrop-blur-xl"
          >
            <div className="absolute left-0 top-0 h-1 w-full bg-gradient-to-r from-[#0052FF] to-[#4D7CFF]" />
            <motion.h3 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: 0.03 }} className="text-xl font-bold text-slate-900">Add URL</motion.h3>
            <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: 0.06 }} className="text-sm text-slate-500">Paste a web link and save it as a readable item in your collection.</motion.p>
            <motion.input
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: 0.09 }}
              value={webInputUrl}
              onChange={(e) => setWebInputUrl(e.target.value)}
              placeholder="https://example.com/article"
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 transition-all focus:border-[#4D7CFF]/40 focus:outline-none focus:ring-4 focus:ring-[#0052FF]/10"
            />
            <motion.input
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: 0.12 }}
              value={webInputTitle}
              onChange={(e) => setWebInputTitle(e.target.value)}
              placeholder="Title (optional)"
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 transition-all focus:border-[#4D7CFF]/40 focus:outline-none focus:ring-4 focus:ring-[#0052FF]/10"
            />
            <motion.input
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: 0.15 }}
              value={webInputAuthor}
              onChange={(e) => setWebInputAuthor(e.target.value)}
              placeholder="Source (optional)"
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 transition-all focus:border-[#4D7CFF]/40 focus:outline-none focus:ring-4 focus:ring-[#0052FF]/10"
            />
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: 0.18 }} className="flex justify-end gap-2 pt-1">
              <button onClick={() => setShowWebModal(false)} className="rounded-xl px-4 py-2 text-slate-600 transition-all duration-200 hover:-translate-y-0.5 hover:bg-slate-100">Cancel</button>
              <button
                onClick={() => void handleAddWebBook()}
                className="rounded-xl bg-gradient-to-r from-[#0052FF] to-[#4D7CFF] px-4 py-2 text-white shadow-[0_14px_30px_-16px_rgba(0,82,255,0.8)] transition-all duration-200 hover:-translate-y-0.5 hover:opacity-95"
              >
                Add
              </button>
            </motion.div>
          </motion.div>
        </div>
      )}

      <LibraryHeader filter={filter} onFilterChange={setFilter} onAddBook={() => setShowUploadModal(true)} onAddWeb={() => setShowWebModal(true)} />

      <LibraryContent
        books={books}
        categories={categories}
        filteredBooks={filteredBooks}
        loading={loading}
        selectedCategoryId={selectedCategoryId}
        setSelectedCategoryId={setSelectedCategoryId}
        editingBookId={editingBookId}
        setEditingBookId={setEditingBookId}
        setCategoryToRename={setCategoryToRename}
        setRenameCategoryName={setRenameCategoryName}
        setCategoryToDelete={setCategoryToDelete}
        setDeleteCategoryMode={setDeleteCategoryMode}
        showCategoryInput={showCategoryInput}
        setShowCategoryInput={setShowCategoryInput}
        newCategoryName={newCategoryName}
        setNewCategoryName={setNewCategoryName}
        handleAddCategory={handleAddCategory}
        handleEditClick={handleEditClick}
        handleUpdateCategory={handleUpdateCategory}
        handleTogglePinBook={handleTogglePinBook}
        handleDelete={handleDelete}
        onSelectBook={onSelectBook}
        onShowUpload={() => setShowUploadModal(true)}
      />

      {editingBookId && <div className="fixed inset-0 z-40" onClick={() => setEditingBookId(null)} />}
    </div>
  );
}
