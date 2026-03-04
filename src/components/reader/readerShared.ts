import { ReaderLayoutWidth } from './readerUtils';

export type RenditionRef = {
  annotations?: { add: (...args: unknown[]) => void };
  themes?: { register: (...args: unknown[]) => void; select: (...args: unknown[]) => void };
  location?: { start?: { percentage?: number } };
  display?: (target?: string) => void;
  next?: () => void;
  prev?: () => void;
  on?: (...args: unknown[]) => void;
  getRange?: (cfiRange: string) => { toString: () => string };
  currentLocation?: () => { start?: { cfi?: string } } | undefined;
} | null;

export type EpubTocItem = {
  label: string;
  href: string;
  subitems?: EpubTocItem[];
};

export type SidebarPositionMode = 'left' | 'right' | 'smart';
export type ReadingMode = 'scroll' | 'paged';
export type TextPagedPagesPerView = 1 | 2 | 3;

export const SIDEBAR_POSITION_STORAGE_KEY = 'reader.sidebar.position';
export const LAYOUT_WIDTH_STORAGE_KEY = 'reader.layout.width';
export const READING_MODE_STORAGE_KEY = 'reader.reading.mode';

export const getTextPagedPagesPerView = (layoutWidth: ReaderLayoutWidth): TextPagedPagesPerView => {
  switch (layoutWidth) {
    case 'wide':
      return 1;
    case 'narrow':
      return 3;
    default:
      return 2;
  }
};

export const getInitialSidebarPositionMode = (): SidebarPositionMode => {
  if (typeof window === 'undefined') return 'left';
  const saved = window.localStorage.getItem(SIDEBAR_POSITION_STORAGE_KEY);
  if (saved === 'left' || saved === 'right' || saved === 'smart') return saved;
  return 'left';
};

export const getInitialLayoutWidth = (): ReaderLayoutWidth => {
  if (typeof window === 'undefined') return 'standard';
  const saved = window.localStorage.getItem(LAYOUT_WIDTH_STORAGE_KEY);
  if (saved === 'narrow' || saved === 'standard' || saved === 'wide') return saved;
  return 'standard';
};

export const getInitialReadingMode = (): ReadingMode => {
  if (typeof window === 'undefined') return 'scroll';
  const saved = window.localStorage.getItem(READING_MODE_STORAGE_KEY);
  if (saved === 'scroll' || saved === 'paged') return saved;
  return 'scroll';
};
