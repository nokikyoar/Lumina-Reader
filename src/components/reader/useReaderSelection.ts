import { useCallback, useEffect, useState } from 'react';
import { Highlight } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

interface UseReaderSelectionParams {
  bookType: string;
  location: string | number;
  showSidebar: boolean;
  setShowSidebar: (show: boolean) => void;
  setActiveTab: (tab: 'chat' | 'highlights' | 'bookmarks' | 'contents') => void;
  renditionRef: React.RefObject<{ annotations?: { add: (...args: unknown[]) => void } } | null>;
  txtContainerRef: React.RefObject<HTMLDivElement | null>;
  setHighlights: React.Dispatch<React.SetStateAction<Highlight[]>>;
  setLocation: React.Dispatch<React.SetStateAction<string | number>>;
}

const MENU_GAP = 12;
const MENU_HALF_WIDTH = 140;

const EPUB_HIGHLIGHT_STYLE: Record<'yellow' | 'green' | 'blue' | 'red', Record<string, string>> = {
  yellow: { fill: '#facc15', 'fill-opacity': '0.32', 'mix-blend-mode': 'multiply' },
  green: { fill: '#4ade80', 'fill-opacity': '0.32', 'mix-blend-mode': 'multiply' },
  blue: { fill: '#60a5fa', 'fill-opacity': '0.32', 'mix-blend-mode': 'multiply' },
  red: { fill: '#f87171', 'fill-opacity': '0.3', 'mix-blend-mode': 'multiply' },
};

const getClampedSelectionMenuPosition = (rect: DOMRect) => {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  const rawX = rect.left + rect.width / 2;
  const rawY = rect.top - MENU_GAP;

  const x = Math.min(Math.max(rawX, MENU_HALF_WIDTH), Math.max(MENU_HALF_WIDTH, viewportWidth - MENU_HALF_WIDTH));
  const y = Math.min(Math.max(rawY, 56), viewportHeight - 24);

  return { x, y };
};

export function useReaderSelection({
  bookType,
  location,
  showSidebar,
  setShowSidebar,
  setActiveTab,
  renditionRef,
  txtContainerRef,
  setHighlights,
  setLocation,
}: UseReaderSelectionParams) {
  const [selectionPos, setSelectionPos] = useState<{ x: number; y: number } | null>(null);
  const [tempSelection, setTempSelection] = useState<{ text: string; cfiRange?: string; txtStart?: number; txtEnd?: number } | null>(null);
  const [currentContext, setCurrentContext] = useState('');
  const [quotedText, setQuotedText] = useState<string | null>(null);
  const [showNoteDialog, setShowNoteDialog] = useState(false);

  const clearSelectionState = useCallback(() => {
    setSelectionPos(null);
    setTempSelection(null);
    setCurrentContext('');
  }, []);

  useEffect(() => {
    const handleSelection = () => {
      if (bookType === 'epub') return;
      if (showNoteDialog) return;

      const selection = window.getSelection();
      const text = selection?.toString().trim() || '';

      // Keep the cached selection while action menu is open.
      // This prevents losing tempSelection when the browser clears native selection
      // right before clicking Highlight / Save Note.
      if (!selection || !text || selection.rangeCount === 0) {
        if (selectionPos) return;
        clearSelectionState();
        return;
      }

      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        clearSelectionState();
        return;
      }

      setSelectionPos(getClampedSelectionMenuPosition(rect));
      setTempSelection({ text });
      setCurrentContext(text);
    };

    document.addEventListener('mouseup', handleSelection);
    document.addEventListener('selectionchange', handleSelection);
    document.addEventListener('contextmenu', handleSelection);
    return () => {
      document.removeEventListener('mouseup', handleSelection);
      document.removeEventListener('selectionchange', handleSelection);
      document.removeEventListener('contextmenu', handleSelection);
    };
  }, [bookType, clearSelectionState, showNoteDialog, selectionPos]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('.selection-menu') || target.closest('.note-dialog-root')) return;
      clearSelectionState();
    };

    window.addEventListener('mousedown', handleClick);
    return () => window.removeEventListener('mousedown', handleClick);
  }, [clearSelectionState]);

  const handleAskAI = () => {
    if (!tempSelection) return;
    setQuotedText(tempSelection.text);
    clearSelectionState();
    setActiveTab('chat');
    if (!showSidebar) setShowSidebar(true);
  };

  const addHighlight = (color: 'yellow' | 'green' | 'blue' | 'red', note?: string) => {
    if (!tempSelection) return;

    const newHighlight: Highlight = {
      id: uuidv4(),
      text: tempSelection.text,
      color,
      note,
      cfiRange: tempSelection.cfiRange,
      page: bookType === 'pdf' && typeof location === 'number' ? location : undefined,
      position: (bookType === 'txt' || bookType === 'md' || bookType === 'web') && typeof location === 'number' ? location : undefined,
      txtStart: tempSelection.txtStart,
      txtEnd: tempSelection.txtEnd,
      createdAt: Date.now(),
    };

    setHighlights((prev) => [...prev, newHighlight]);

    if (bookType === 'epub' && renditionRef.current && tempSelection.cfiRange) {
      renditionRef.current.annotations?.add('highlight', tempSelection.cfiRange, {}, undefined, `hl-${color}`, EPUB_HIGHLIGHT_STYLE[color]);
    }

    clearSelectionState();
    setShowNoteDialog(false);
    setActiveTab('highlights');
    if (!showSidebar) setShowSidebar(true);
  };

  const handleHighlightClick = (hl: Highlight) => {
    if (bookType === 'epub' && hl.cfiRange) setLocation(hl.cfiRange);
    else if (bookType === 'pdf' && hl.page) setLocation(hl.page);
    else if ((bookType === 'txt' || bookType === 'md' || bookType === 'web') && hl.position !== undefined && txtContainerRef.current) {
      setLocation(hl.position);
      txtContainerRef.current.scrollTop = hl.position;
    }
  };

  return {
    selectionPos,
    setSelectionPos,
    tempSelection,
    setTempSelection,
    currentContext,
    setCurrentContext,
    quotedText,
    setQuotedText,
    showNoteDialog,
    setShowNoteDialog,
    handleAskAI,
    addHighlight,
    handleHighlightClick,
  };
}
