import { openDB, DBSchema } from 'idb';
import { v4 as uuidv4 } from 'uuid';

export interface Highlight {
  id: string;
  text: string;
  note?: string;
  color: 'yellow' | 'green' | 'blue' | 'red';
  cfiRange?: string; // For EPUB
  page?: number; // For PDF
  position?: number; // For TXT scrollTop (legacy/fallback)
  txtStart?: number; // For TXT
  txtEnd?: number; // For TXT
  createdAt: number;
}

export interface Bookmark {
  id: string;
  label?: string;
  cfiRange?: string;
  page?: number;
  position?: number;
  createdAt: number;
}

export interface ReaderStateSnapshot {
  version: 1 | 2;
  updatedAt: number;
  lastLocation: string | number;
  normalizedProgress: number;
  readingMode: 'scroll' | 'paged';
  theme: 'light' | 'sepia' | 'dark' | 'e-ink';
  fontSize: number;
  layoutWidth: 'narrow' | 'standard' | 'wide';
  activeTab: 'chat' | 'contents' | 'highlights' | 'bookmarks' | 'search';
  showSidebar: boolean;
  sidebarPositionMode: 'left' | 'right' | 'smart';
  highlightColorFilter?: 'all' | 'yellow' | 'green' | 'blue' | 'red';
  pagination?: {
    currentPage: number;
    totalPages: number;
    pagesPerView?: number;
  };
  epub?: {
    cfi?: string;
  };
  pdf?: {
    page?: number;
    totalPages?: number;
  };
}

export type ReaderStateSnapshotInput = Partial<ReaderStateSnapshot> & { version?: number };

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

export function normalizeReaderStateSnapshot(input: ReaderStateSnapshotInput | undefined, fallback?: Partial<ReaderStateSnapshot>): ReaderStateSnapshot | undefined {
  if (!input && !fallback) return undefined;

  const source = { ...(fallback || {}), ...(input || {}) } as Partial<ReaderStateSnapshot> & { version?: number };

  const readingMode = source.readingMode === 'paged' ? 'paged' : 'scroll';
  const theme = source.theme === 'dark' || source.theme === 'sepia' || source.theme === 'e-ink' ? source.theme : 'light';
  const layoutWidth = source.layoutWidth === 'narrow' || source.layoutWidth === 'wide' ? source.layoutWidth : 'standard';
  const activeTab = source.activeTab === 'contents' || source.activeTab === 'highlights' || source.activeTab === 'bookmarks' || source.activeTab === 'search' ? source.activeTab : 'chat';
  const sidebarPositionMode = source.sidebarPositionMode === 'left' || source.sidebarPositionMode === 'smart' ? source.sidebarPositionMode : 'right';
  const highlightColorFilter =
    source.highlightColorFilter === 'yellow' || source.highlightColorFilter === 'green' || source.highlightColorFilter === 'blue' || source.highlightColorFilter === 'red'
      ? source.highlightColorFilter
      : 'all';

  const lastLocation = typeof source.lastLocation === 'string' || isFiniteNumber(source.lastLocation) ? source.lastLocation : 0;
  const normalizedProgress = isFiniteNumber(source.normalizedProgress) ? Math.min(1, Math.max(0, source.normalizedProgress)) : 0;
  const fontSize = isFiniteNumber(source.fontSize) ? Math.min(200, Math.max(50, Math.round(source.fontSize))) : 100;

  const snapshot: ReaderStateSnapshot = {
    version: source.version === 2 ? 2 : 1,
    updatedAt: isFiniteNumber(source.updatedAt) ? source.updatedAt : Date.now(),
    lastLocation,
    normalizedProgress,
    readingMode,
    theme,
    fontSize,
    layoutWidth,
    activeTab,
    showSidebar: typeof source.showSidebar === 'boolean' ? source.showSidebar : true,
    sidebarPositionMode,
    highlightColorFilter,
  };

  if (source.pagination && isFiniteNumber(source.pagination.currentPage) && isFiniteNumber(source.pagination.totalPages)) {
    snapshot.pagination = {
      currentPage: Math.max(1, Math.round(source.pagination.currentPage)),
      totalPages: Math.max(1, Math.round(source.pagination.totalPages)),
      pagesPerView: isFiniteNumber(source.pagination.pagesPerView) ? Math.max(1, Math.round(source.pagination.pagesPerView)) : undefined,
    };
  }

  if (source.epub?.cfi && typeof source.epub.cfi === 'string') {
    snapshot.epub = { cfi: source.epub.cfi };
  }

  if (source.pdf && (isFiniteNumber(source.pdf.page) || isFiniteNumber(source.pdf.totalPages))) {
    snapshot.pdf = {
      page: isFiniteNumber(source.pdf.page) ? Math.max(1, Math.round(source.pdf.page)) : undefined,
      totalPages: isFiniteNumber(source.pdf.totalPages) ? Math.max(1, Math.round(source.pdf.totalPages)) : undefined,
    };
  }

  return snapshot;
}

export interface Book {
  id: string;
  title: string;
  author?: string;
  type: 'txt' | 'pdf' | 'epub' | 'md' | 'web';
  content?: ArrayBuffer | string;
  cover?: string; // Base64 encoded image
  addedAt: number;
  category?: string;
  progress?: number | string;
  readingProgress?: Partial<Record<'scroll' | 'paged', number>>;
  readerState?: ReaderStateSnapshot;
  lastRead?: number;
  isPinned?: boolean;
  highlights?: Highlight[];
  bookmarks?: Bookmark[];
}

export interface Category {
  id: string;
  name: string;
  createdAt: number;
}

interface ReaderMeta {
  key: string;
  value: unknown;
  updatedAt: number;
}

interface LuminaDB extends DBSchema {
  books: {
    key: string;
    value: Book;
    indexes: { 'by-date': number };
  };
  categories: {
    key: string;
    value: Category;
  };
  readerMeta: {
    key: string;
    value: ReaderMeta;
  };
}

const DB_NAME = 'lumina-reader-db';

export async function initDB() {
  return openDB<LuminaDB>(DB_NAME, 6, {
    async upgrade(db, oldVersion, _newVersion, transaction) {
      if (oldVersion < 1) {
        const store = db.createObjectStore('books', { keyPath: 'id' });
        store.createIndex('by-date', 'addedAt');
      }

      if (oldVersion < 4) {
        if (!db.objectStoreNames.contains('categories')) {
          db.createObjectStore('categories', { keyPath: 'id' });
        }
      }

      if (oldVersion < 5) {
        if (!db.objectStoreNames.contains('categories')) {
          db.createObjectStore('categories', { keyPath: 'id' });
        }

        const store = transaction.objectStore('categories');
        const count = await store.count();

        if (count === 0) {
          const defaults = ['Work', 'Personal', 'Study'].map((name) => ({
            id: uuidv4(),
            name,
            createdAt: Date.now(),
          }));
          for (const cat of defaults) {
            await store.put(cat);
          }
        }
      }

      if (oldVersion < 6) {
        if (!db.objectStoreNames.contains('readerMeta')) {
          db.createObjectStore('readerMeta', { keyPath: 'key' });
        }
      }
    },
  });
}

export async function saveCategory(category: Category) {
  const db = await initDB();
  return db.put('categories', category);
}

export async function getAllCategories() {
  const db = await initDB();
  return db.getAll('categories');
}

export async function deleteCategory(id: string) {
  const db = await initDB();
  return db.delete('categories', id);
}

export async function saveBook(book: Book) {
  const db = await initDB();
  return db.put('books', book);
}

export async function getAllBooks() {
  const db = await initDB();
  return db.getAllFromIndex('books', 'by-date');
}

export async function getBook(id: string) {
  const db = await initDB();
  return db.get('books', id);
}

export async function deleteBook(id: string) {
  const db = await initDB();
  return db.delete('books', id);
}

export async function saveReaderMeta<T = unknown>(key: string, value: T) {
  const db = await initDB();
  return db.put('readerMeta', { key, value, updatedAt: Date.now() });
}

export async function getReaderMeta<T = unknown>(key: string): Promise<T | undefined> {
  const db = await initDB();
  const result = await db.get('readerMeta', key);
  return result?.value as T | undefined;
}
