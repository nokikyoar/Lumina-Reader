import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { ReactReaderStyle } from 'react-reader';
import { cn } from '@/lib/utils';

export type Theme = 'light' | 'dark' | 'sepia' | 'e-ink';
export type SidebarTab = 'chat' | 'highlights' | 'bookmarks' | 'contents' | 'search';
export type ReaderLayoutWidth = 'narrow' | 'standard' | 'wide';

export const getLayoutContainerClass = (layoutWidth: ReaderLayoutWidth) => {
  switch (layoutWidth) {
    case 'narrow':
      return 'max-w-3xl';
    case 'wide':
      return 'max-w-6xl';
    default:
      return 'max-w-4xl';
  }
};

export const getEpubContentMaxWidth = (layoutWidth: ReaderLayoutWidth) => {
  switch (layoutWidth) {
    case 'narrow':
      return '760px';
    case 'wide':
      return '1120px';
    default:
      return '920px';
  }
};

export const getPdfMaxWidth = (layoutWidth: ReaderLayoutWidth) => {
  switch (layoutWidth) {
    case 'narrow':
      return 760;
    case 'wide':
      return 1120;
    default:
      return 960;
  }
};

export const CodeBlock = ({ language, children, theme }: { language: string; children: string; theme: Theme }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isDark = theme === 'dark';
  const isEInk = theme === 'e-ink';
  const isSepia = theme === 'sepia';

  const shell = isDark
    ? 'border-slate-700 bg-slate-900'
    : isEInk
      ? 'border-neutral-700 bg-[#f5f5f5]'
      : isSepia
        ? 'border-[#cbb99a] bg-[#f4ecd8]'
        : 'border-gray-200 bg-white';

  const header = isDark
    ? 'bg-slate-800 border-slate-700 text-slate-300'
    : isEInk
      ? 'bg-[#ebebeb] border-neutral-700 text-neutral-700'
      : isSepia
        ? 'bg-[#eadfca] border-[#cbb99a] text-[#7d6452]'
        : 'bg-gray-50 border-gray-200 text-gray-500';

  const copyHover = isDark
    ? 'hover:bg-white/10'
    : isEInk
      ? 'hover:bg-neutral-200'
      : isSepia
        ? 'hover:bg-[#ddceb2]'
        : 'hover:bg-gray-200';

  const copyHoverText = isDark ? 'group-hover:text-slate-100' : isEInk ? 'group-hover:text-neutral-900' : isSepia ? 'group-hover:text-[#5b4636]' : 'group-hover:text-gray-700';

  const syntaxStyle = isDark ? oneDark : oneLight;

  return (
    <div className={cn('relative group my-4 rounded-lg overflow-hidden border shadow-sm', shell)}>
      <div className={cn('flex justify-between items-center px-4 py-2 border-b', header)}>
        <span className="text-xs font-mono uppercase font-semibold">{language || 'text'}</span>
        <button onClick={handleCopy} className={cn('p-1.5 rounded-md transition-colors flex items-center gap-1.5', copyHover)} title="Copy code">
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-green-500" />
              <span className="text-[10px] font-medium text-green-600">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span className={cn('text-[10px] font-medium', copyHoverText)}>Copy</span>
            </>
          )}
        </button>
      </div>
      <SyntaxHighlighter language={language} style={syntaxStyle} customStyle={{ margin: 0, borderRadius: 0, fontSize: '0.9em', lineHeight: '1.5' }} showLineNumbers wrapLines>
        {children}
      </SyntaxHighlighter>
    </div>
  );
};

export const extractHeadings = (markdown: string) => {
  const lines = markdown.split('\n');
  const headings: Array<{ level: number; text: string; id: string }> = [];
  const idMap = new Map<string, number>();

  for (const line of lines) {
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      const level = match[1].length;
      const text = match[2].trim();
      let id = text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
      if (idMap.has(id)) {
        const count = idMap.get(id)! + 1;
        idMap.set(id, count);
        id = `${id}-${count}`;
      } else {
        idMap.set(id, 0);
      }
      headings.push({ level, text, id });
    }
  }

  return headings;
};

export interface ReaderThemePalette {
  bg: string;
  text: string;
  ui: string;
  toolbarGroupBg: string;
  toolbarHoverBg: string;
  toolbarActiveBg: string;
  toolbarActiveText: string;
  subtleText: string;
  sidebarBorder: string;
  tabInactiveText: string;
  tabHoverText: string;
  listItemHoverBg: string;
  panelGlassBg: string;
  panelGlassText: string;
  noteCardBg: string;
  noteCardHoverBg: string;
  noteCardBorder: string;
  floatingToastBg: string;
  floatingToastText: string;
  divider: string;
  inputBg: string;
  inputBorder: string;
  inputPlaceholder: string;
  inputText: string;
  disabledText: string;
}

export const getThemeStyles = (theme: Theme): ReaderThemePalette => {
  switch (theme) {
    case 'dark':
      return {
        bg: 'bg-slate-950',
        text: 'text-slate-100',
        ui: 'border-slate-800',
        toolbarGroupBg: 'bg-white/10',
        toolbarHoverBg: 'hover:bg-white/15',
        toolbarActiveBg: 'bg-slate-700/80',
        toolbarActiveText: 'text-slate-100',
        subtleText: 'text-slate-400',
        sidebarBorder: 'border-slate-800',
        tabInactiveText: 'text-slate-400',
        tabHoverText: 'hover:text-slate-200',
        listItemHoverBg: 'hover:bg-white/10',
        panelGlassBg: 'bg-slate-900/85',
        panelGlassText: 'text-slate-100',
        noteCardBg: 'bg-slate-800/80',
        noteCardHoverBg: 'hover:bg-slate-700/90',
        noteCardBorder: 'hover:border-[#4D7CFF]/40',
        floatingToastBg: 'bg-slate-900/90',
        floatingToastText: 'text-slate-100',
        divider: 'border-slate-800',
        inputBg: 'bg-slate-800',
        inputBorder: 'border-slate-700',
        inputPlaceholder: 'placeholder-slate-500',
        inputText: 'text-slate-100',
        disabledText: 'text-slate-500',
      };
    case 'sepia':
      return {
        bg: 'bg-[#f4ecd8]',
        text: 'text-[#5b4636]',
        ui: 'border-[#d3c4a9]',
        toolbarGroupBg: 'bg-[#eadfca]',
        toolbarHoverBg: 'hover:bg-[#ddceb2]',
        toolbarActiveBg: 'bg-[#fff7e8]',
        toolbarActiveText: 'text-[#4c3a2a]',
        subtleText: 'text-[#7d6452]',
        sidebarBorder: 'border-[#d3c4a9]',
        tabInactiveText: 'text-[#8a705d]',
        tabHoverText: 'hover:text-[#5b4636]',
        listItemHoverBg: 'hover:bg-[#eadfca]',
        panelGlassBg: 'bg-[#3f2f22]/85',
        panelGlassText: 'text-[#fff7e8]',
        noteCardBg: 'bg-[#f8f0de]',
        noteCardHoverBg: 'hover:bg-[#fff7e8]',
        noteCardBorder: 'hover:border-[#4D7CFF]/40',
        floatingToastBg: 'bg-[#3f2f22]/90',
        floatingToastText: 'text-[#fff7e8]',
        divider: 'border-[#d3c4a9]',
        inputBg: 'bg-[#f8f0de]',
        inputBorder: 'border-[#c9b89b]',
        inputPlaceholder: 'placeholder-[#8a705d]',
        inputText: 'text-[#5b4636]',
        disabledText: 'text-[#a68f7b]',
      };
    case 'e-ink':
      return {
        bg: 'bg-[#f5f5f5]',
        text: 'text-neutral-900',
        ui: 'border-neutral-800',
        toolbarGroupBg: 'bg-neutral-200',
        toolbarHoverBg: 'hover:bg-neutral-300',
        toolbarActiveBg: 'bg-white',
        toolbarActiveText: 'text-neutral-950',
        subtleText: 'text-neutral-600',
        sidebarBorder: 'border-neutral-800',
        tabInactiveText: 'text-neutral-600',
        tabHoverText: 'hover:text-neutral-900',
        listItemHoverBg: 'hover:bg-neutral-200',
        panelGlassBg: 'bg-neutral-900/85',
        panelGlassText: 'text-neutral-100',
        noteCardBg: 'bg-neutral-200',
        noteCardHoverBg: 'hover:bg-white',
        noteCardBorder: 'hover:border-neutral-900/40',
        floatingToastBg: 'bg-neutral-900/90',
        floatingToastText: 'text-neutral-100',
        divider: 'border-neutral-800',
        inputBg: 'bg-[#ebebeb]',
        inputBorder: 'border-neutral-500',
        inputPlaceholder: 'placeholder-neutral-500',
        inputText: 'text-neutral-900',
        disabledText: 'text-neutral-400',
      };
    default:
      return {
        bg: 'bg-white',
        text: 'text-gray-900',
        ui: 'border-gray-200',
        toolbarGroupBg: 'bg-black/5',
        toolbarHoverBg: 'hover:bg-black/5',
        toolbarActiveBg: 'bg-white',
        toolbarActiveText: 'text-gray-900',
        subtleText: 'text-gray-500',
        sidebarBorder: 'border-gray-200',
        tabInactiveText: 'text-gray-500',
        tabHoverText: 'hover:text-gray-700',
        listItemHoverBg: 'hover:bg-black/5',
        panelGlassBg: 'bg-black/80',
        panelGlassText: 'text-white',
        noteCardBg: 'bg-gray-50',
        noteCardHoverBg: 'hover:bg-white',
        noteCardBorder: 'hover:border-[#4D7CFF]/35',
        floatingToastBg: 'bg-black/80',
        floatingToastText: 'text-white',
        divider: 'border-gray-200',
        inputBg: 'bg-white',
        inputBorder: 'border-gray-200',
        inputPlaceholder: 'placeholder-gray-400',
        inputText: 'text-gray-900',
        disabledText: 'text-gray-300',
      };
  }
};

const REQUIRED_THEME_KEYS: Array<keyof ReaderThemePalette> = [
  'bg',
  'text',
  'ui',
  'toolbarGroupBg',
  'toolbarHoverBg',
  'toolbarActiveBg',
  'toolbarActiveText',
  'subtleText',
  'sidebarBorder',
  'tabInactiveText',
  'tabHoverText',
  'listItemHoverBg',
  'panelGlassBg',
  'panelGlassText',
  'noteCardBg',
  'noteCardHoverBg',
  'noteCardBorder',
  'floatingToastBg',
  'floatingToastText',
  'divider',
  'inputBg',
  'inputBorder',
  'inputPlaceholder',
  'inputText',
  'disabledText',
];

export const validateReaderThemePalette = (palette: ReaderThemePalette) => {
  const missing = REQUIRED_THEME_KEYS.filter((key) => !palette[key]);
  if (missing.length > 0) {
    throw new Error(`ReaderThemePalette missing keys: ${missing.join(', ')}`);
  }
  return palette;
};

export const buildReaderStyles = (theme: Theme) => ({
  ...ReactReaderStyle,
  readerArea: {
    ...ReactReaderStyle.readerArea,
    backgroundColor: theme === 'dark' ? '#020617' : theme === 'sepia' ? '#f4ecd8' : theme === 'e-ink' ? '#f5f5f5' : '#fff',
    transition: 'background-color 0.3s',
  },
  titleArea: { display: 'none' },
  reader: {
    ...ReactReaderStyle.reader,
    top: 16,
    left: 16,
    right: 16,
    bottom: 16,
  },
  tocArea: {
    ...ReactReaderStyle.tocArea,
    backgroundColor: theme === 'dark' ? '#0f172a' : theme === 'sepia' ? '#f4ecd8' : theme === 'e-ink' ? '#f5f5f5' : '#f9fafb',
  },
});
