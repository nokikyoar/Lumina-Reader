import { ArrowLeft, Bookmark, Bot, Highlighter as HighlightIcon, List, Minus, Monitor, Moon, PanelLeft, PanelRight, Plus, ScrollText, Sun, Type } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ReaderLayoutWidth, SidebarTab, Theme } from './readerUtils';

type SidebarPositionMode = 'left' | 'right' | 'smart';
type ReadingMode = 'scroll' | 'paged';

interface ReaderToolbarProps {
  title: string;
  author?: string;
  styles: {
    ui: string;
    toolbarGroupBg: string;
    toolbarHoverBg: string;
    toolbarActiveBg: string;
    toolbarActiveText: string;
    subtleText: string;
  };
  fontSize: number;
  setFontSize: React.Dispatch<React.SetStateAction<number>>;
  theme: Theme;
  setTheme: React.Dispatch<React.SetStateAction<Theme>>;
  layoutWidth: ReaderLayoutWidth;
  setLayoutWidth: React.Dispatch<React.SetStateAction<ReaderLayoutWidth>>;
  readingMode: ReadingMode;
  setReadingMode: React.Dispatch<React.SetStateAction<ReadingMode>>;
  disablePagedMode?: boolean;
  onAddBookmark: () => void;
  showSidebar: boolean;
  setShowSidebar: React.Dispatch<React.SetStateAction<boolean>>;
  activeTab: SidebarTab;
  onOpenContents: () => void;
  sidebarPositionMode: SidebarPositionMode;
  setSidebarPositionMode: React.Dispatch<React.SetStateAction<SidebarPositionMode>>;
  onBack: () => void;
}

export function ReaderToolbar({
  title,
  author,
  styles,
  fontSize,
  setFontSize,
  theme,
  setTheme,
  layoutWidth,
  setLayoutWidth,
  readingMode,
  setReadingMode,
  disablePagedMode = false,
  onAddBookmark,
  showSidebar,
  setShowSidebar,
  activeTab,
  onOpenContents,
  sidebarPositionMode,
  setSidebarPositionMode,
  onBack,
}: ReaderToolbarProps) {
  return (
    <header className={cn('h-16 flex items-center justify-between px-4 md:px-5 border-b z-10 shrink-0 backdrop-blur-xl', styles.ui)}>
      <div className="flex items-center gap-4">
        <button onClick={onBack} className={cn('p-2 rounded-full transition-all duration-200 hover:-translate-y-0.5', styles.toolbarHoverBg)}>
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex flex-col">
          <h1 className="font-serif font-bold truncate max-w-[150px] md:max-w-xs text-sm md:text-base">{title}</h1>
          <span className={cn('text-xs truncate max-w-[150px]', styles.subtleText)}>{author || 'Unknown Author'}</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className={cn('hidden md:flex items-center rounded-full p-1 mr-2 transition-all duration-200 hover:-translate-y-0.5', styles.toolbarGroupBg)}>
          <button onClick={() => setFontSize((s) => Math.max(50, s - 10))} className={cn('p-1.5 rounded-full transition-all duration-200', styles.toolbarHoverBg)}><Minus className="w-4 h-4" /></button>
          <span className="text-xs font-mono w-8 text-center">{fontSize}%</span>
          <button onClick={() => setFontSize((s) => Math.min(200, s + 10))} className={cn('p-1.5 rounded-full transition-all duration-200', styles.toolbarHoverBg)}><Plus className="w-4 h-4" /></button>
        </div>

        <div className={cn('hidden md:flex items-center rounded-full p-1 mr-2 transition-all duration-200 hover:-translate-y-0.5', styles.toolbarGroupBg)} role="radiogroup" aria-label="Layout width">
          <button onClick={() => setLayoutWidth('narrow')} className={cn('px-2 py-1.5 rounded-full text-[11px] font-medium transition-all duration-200', layoutWidth === 'narrow' && cn(styles.toolbarActiveBg, styles.toolbarActiveText, 'shadow-sm'))} title="Narrow" aria-label="Narrow" aria-checked={layoutWidth === 'narrow'} role="radio">Narrow</button>
          <button onClick={() => setLayoutWidth('standard')} className={cn('px-2 py-1.5 rounded-full text-[11px] font-medium transition-all duration-200', layoutWidth === 'standard' && cn(styles.toolbarActiveBg, styles.toolbarActiveText, 'shadow-sm'))} title="Standard" aria-label="Standard" aria-checked={layoutWidth === 'standard'} role="radio">Standard</button>
          <button onClick={() => setLayoutWidth('wide')} className={cn('px-2 py-1.5 rounded-full text-[11px] font-medium transition-all duration-200', layoutWidth === 'wide' && cn(styles.toolbarActiveBg, styles.toolbarActiveText, 'shadow-sm'))} title="Wide" aria-label="Wide" aria-checked={layoutWidth === 'wide'} role="radio">Wide</button>
        </div>

        <div className={cn('hidden md:flex items-center rounded-full p-1 mr-2 transition-all duration-200 hover:-translate-y-0.5', styles.toolbarGroupBg)} role="radiogroup" aria-label="Reading mode">
          <button onClick={() => setReadingMode('scroll')} className={cn('p-1.5 rounded-full transition-all duration-200', readingMode === 'scroll' && cn(styles.toolbarActiveBg, styles.toolbarActiveText, 'shadow-sm'))} title="Scroll" aria-label="Scroll" aria-checked={readingMode === 'scroll'} role="radio"><ScrollText className="w-4 h-4" /></button>
          <button
            onClick={() => {
              if (disablePagedMode) return;
              setReadingMode('paged');
            }}
            className={cn('px-2 py-1.5 rounded-full text-[11px] font-medium transition-all duration-200', readingMode === 'paged' && cn(styles.toolbarActiveBg, styles.toolbarActiveText, 'shadow-sm'), disablePagedMode && 'opacity-40 cursor-not-allowed')}
            title={disablePagedMode ? 'EPUB supports Scroll mode only' : 'Paged'}
            aria-label={disablePagedMode ? 'EPUB supports Scroll mode only' : 'Paged'}
            aria-checked={readingMode === 'paged'}
            aria-disabled={disablePagedMode}
            role="radio"
            disabled={disablePagedMode}
          >
            Paged
          </button>
        </div>

        <div className={cn('hidden md:flex items-center rounded-full p-1 mr-2 transition-all duration-200 hover:-translate-y-0.5', styles.toolbarGroupBg)}>
          <button onClick={() => setTheme('light')} className={cn('p-1.5 rounded-full transition-all duration-200', theme === 'light' && cn(styles.toolbarActiveBg, styles.toolbarActiveText, 'shadow-sm'))}><Sun className="w-4 h-4" /></button>
          <button onClick={() => setTheme('sepia')} className={cn('p-1.5 rounded-full transition-all duration-200', theme === 'sepia' && cn(styles.toolbarActiveBg, styles.toolbarActiveText, 'shadow-sm'))}><Type className="w-4 h-4" /></button>
          <button onClick={() => setTheme('dark')} className={cn('p-1.5 rounded-full transition-all duration-200', theme === 'dark' && cn(styles.toolbarActiveBg, styles.toolbarActiveText, 'shadow-sm'))}><Moon className="w-4 h-4" /></button>
          <button onClick={() => setTheme('e-ink')} className={cn('p-1.5 rounded-full transition-all duration-200', theme === 'e-ink' && cn(styles.toolbarActiveBg, styles.toolbarActiveText, 'shadow-sm'))}><Monitor className="w-4 h-4" /></button>
        </div>

        <div className={cn('hidden md:flex items-center rounded-full p-1 mr-2 transition-all duration-200 hover:-translate-y-0.5', styles.toolbarGroupBg)} role="radiogroup" aria-label="Sidebar position">
          <button onClick={() => setSidebarPositionMode('left')} className={cn('p-1.5 rounded-full transition-all duration-200', sidebarPositionMode === 'left' && cn(styles.toolbarActiveBg, styles.toolbarActiveText, 'shadow-sm'))} title="Sidebar Left" aria-label="Sidebar Left" aria-checked={sidebarPositionMode === 'left'} role="radio"><PanelLeft className="w-4 h-4" /></button>
          <button onClick={() => setSidebarPositionMode('right')} className={cn('p-1.5 rounded-full transition-all duration-200', sidebarPositionMode === 'right' && cn(styles.toolbarActiveBg, styles.toolbarActiveText, 'shadow-sm'))} title="Sidebar Right" aria-label="Sidebar Right" aria-checked={sidebarPositionMode === 'right'} role="radio"><PanelRight className="w-4 h-4" /></button>
          <button onClick={() => setSidebarPositionMode('smart')} className={cn('px-2 py-1.5 rounded-full text-[11px] font-medium transition-all duration-200', sidebarPositionMode === 'smart' && cn(styles.toolbarActiveBg, styles.toolbarActiveText, 'shadow-sm'))} title="Smart (Contents Left, Others Right)" aria-label="Smart (Contents Left, Others Right)" aria-checked={sidebarPositionMode === 'smart'} role="radio">Smart</button>
        </div>

        <button onClick={onAddBookmark} className={cn('p-2 rounded-full transition-all duration-200 hover:-translate-y-0.5', styles.toolbarHoverBg)} title="Add bookmark"><Bookmark className="w-5 h-5" /></button>

        <button
          onClick={onOpenContents}
          className={cn('p-2 rounded-full transition-all duration-200', showSidebar && activeTab === 'contents' ? 'bg-gradient-to-r from-[#0052FF] to-[#4D7CFF] text-white shadow-[0_10px_22px_-14px_rgba(0,82,255,0.8)]' : styles.toolbarHoverBg)}
          title="Contents"
        >
          <List className="w-5 h-5" />
        </button>

        <button
          onClick={() => setShowSidebar(!showSidebar)}
          className={cn('p-2 rounded-full transition-all duration-200 flex items-center gap-2', showSidebar && activeTab !== 'contents' ? 'bg-gradient-to-r from-[#0052FF] to-[#4D7CFF] text-white shadow-[0_10px_22px_-14px_rgba(0,82,255,0.8)]' : styles.toolbarHoverBg)}
        >
          {activeTab === 'chat' ? <Bot className="w-5 h-5" /> : <HighlightIcon className="w-5 h-5" />}
        </button>
      </div>
    </header>
  );
}
