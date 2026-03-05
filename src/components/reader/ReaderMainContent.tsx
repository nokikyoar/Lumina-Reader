import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, ChevronLeft, ChevronRight, ExternalLink, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ReactReader } from 'react-reader';
import { ReaderToolbar } from './ReaderToolbar';
import { ReaderPdfView } from './ReaderPdfView';
import { ReaderMarkdownView } from './ReaderMarkdownView';
import { ReaderTextView } from './ReaderTextView';
import { SelectionMenu, NoteDialog } from '../SelectionTools';
import { EpubTocItem, ReadingMode, SidebarPositionMode } from './readerShared';
import { ReaderLayoutWidth } from './readerUtils';
import { SearchMatchRange, renderTxtContentWithHighlights } from './textHighlightUtils';
import { Highlight } from '@/lib/db';

interface ReaderMainContentProps {
  book: any;
  styles: any;
  theme: any;
  fontSize: number;
  setFontSize: (n: number) => void;
  setTheme: (v: any) => void;
  layoutWidth: ReaderLayoutWidth;
  setLayoutWidth: (v: ReaderLayoutWidth) => void;
  readingMode: ReadingMode;
  setReadingMode: (m: ReadingMode) => void;
  isEpub: boolean;
  isWeb: boolean;
  showSidebar: boolean;
  setShowSidebar: (v: boolean) => void;
  activeTab: any;
  onOpenContents: () => void;
  sidebarPositionMode: SidebarPositionMode;
  setSidebarPositionMode: (m: SidebarPositionMode) => void;
  onBack: () => void;
  onAddBookmark: () => void;
  selectionPos: { x: number; y: number } | null;
  setSelectionPos: (v: null) => void;
  addHighlight: (color: 'yellow' | 'green' | 'blue' | 'red', note?: string) => void;
  setShowNoteDialog: (v: boolean) => void;
  showNoteDialog: boolean;
  handleAskAI: () => void;
  location: string | number;
  setLocation: (v: any) => void;
  readerContent: any;
  epubReady: boolean;
  epubHardError: boolean;
  epubLoadedOnce: boolean;
  epubRetryNonce: number;
  attachRendition: (r: any) => void;
  setEpubToc: (toc: EpubTocItem[]) => void;
  setEpubLoadedOnce: (v: boolean) => void;
  setEpubHardError: (v: boolean) => void;
  setEpubAttempt: (v: number) => void;
  setEpubRetryNonce: (fn: (n: number) => number) => void;
  readerStyles: any;
  numPages: number;
  setNumPages: (n: number) => void;
  txtContainerRef: any;
  textPagedPagesPerView: 1 | 2 | 3;
  onTextScroll: (pos: number) => void;
  dedupedHighlights: Highlight[];
  searchMatchRanges: SearchMatchRange[];
  activeSearchResultId?: string;
  webUrl: string;
  setWebUrl: (v: string) => void;
  normalizeWebInputUrl: (v: string) => string;
  setWebFrameStatus: (v: any) => void;
  setWebFrameHint: (v: string) => void;
  webBridgeConnected: boolean;
  webBridgeVersion: string | null;
  webBridgeLastAction: string | null;
  webBridgeLastError: string | null;
  webFrameHint: string | null;
  webFrameStatus: string;
  webBlockedByPolicy: boolean;
  onOpenWebExternally: () => void;
  onRetryWebEmbed: () => void;
  onClearBlockedHost: () => void;
  webIframeRef: any;
  touchStartX: number | null;
  setTouchStartX: (v: number | null) => void;
  turnTextPage: (dir: 'prev' | 'next') => void;
  textPagedMetrics: { current: number; total: number };
  bookmarkToast: string | null;
  persistTelemetry: { failureCount: number; backoffLevel: 0 | 1 | 2; consecutiveFailureCount: number; retryCount: number; lastReason: string | null };
}

export function ReaderMainContent(props: ReaderMainContentProps) {
  const p = props;
  return (
    <div className="flex-1 flex flex-col h-full relative min-w-0">
      <ReaderToolbar
        title={p.book.title}
        author={p.book.author}
        styles={p.styles}
        fontSize={p.fontSize}
        setFontSize={p.setFontSize}
        theme={p.theme}
        setTheme={p.setTheme}
        layoutWidth={p.layoutWidth}
        setLayoutWidth={p.setLayoutWidth}
        readingMode={p.readingMode}
        setReadingMode={p.setReadingMode}
        disablePagedMode={p.isEpub || p.isWeb}
        onAddBookmark={p.onAddBookmark}
        showSidebar={p.showSidebar}
        setShowSidebar={p.setShowSidebar}
        activeTab={p.activeTab}
        onOpenContents={p.onOpenContents}
        sidebarPositionMode={p.sidebarPositionMode}
        setSidebarPositionMode={p.setSidebarPositionMode}
        onBack={p.onBack}
      />

      <div className="flex-1 relative overflow-hidden" id="pdf-container">
        <SelectionMenu position={p.selectionPos} theme={p.theme} onClose={() => p.setSelectionPos(null)} onHighlight={(color) => p.addHighlight(color)} onNote={() => p.setShowNoteDialog(true)} onAskAI={p.handleAskAI} />
        <NoteDialog isOpen={p.showNoteDialog} theme={p.theme} onClose={() => p.setShowNoteDialog(false)} onSave={(note) => p.addHighlight('yellow', note)} />

        <AnimatePresence>
          {p.bookmarkToast && (
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={cn('absolute top-16 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full text-sm z-50 pointer-events-none', p.styles.floatingToastBg, p.styles.floatingToastText)}>
              {p.bookmarkToast}
            </motion.div>
          )}
          {p.persistTelemetry.failureCount > 0 && (
            <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={cn('absolute top-28 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full text-xs z-50 pointer-events-none', p.styles.floatingToastBg, p.styles.floatingToastText)} title={`lastReason=${p.persistTelemetry.lastReason || '-'}; retryCount=${p.persistTelemetry.retryCount}; consecutive=${p.persistTelemetry.consecutiveFailureCount}`}>
              {p.persistTelemetry.backoffLevel > 0 ? `Save throttled (${p.persistTelemetry.consecutiveFailureCount} consecutive failures, level L${p.persistTelemetry.backoffLevel})` : `Save retrying (${p.persistTelemetry.failureCount} failures, ${p.persistTelemetry.retryCount} retries)`}
            </motion.div>
          )}
        </AnimatePresence>

        {p.book.type === 'epub' && <div className="h-full w-full relative">{!p.epubLoadedOnce && <div className="absolute inset-0 grid place-items-center text-sm opacity-70">Loading book…</div>}{p.epubReady && !p.epubHardError && p.readerContent instanceof ArrayBuffer && p.readerContent.byteLength > 0 && <ReactReader key={`epub-${p.book.id}-${p.epubRetryNonce}-${p.readingMode}-${p.layoutWidth}`} url={p.readerContent} title={p.book.title} location={p.location} locationChanged={p.setLocation} readerStyles={p.readerStyles} showToc={false} loadingView={null} errorView={null} tocChanged={(toc) => { p.setEpubToc((toc as EpubTocItem[]) || []); p.setEpubLoadedOnce(true); }} epubOptions={p.readingMode === 'paged' ? { flow: 'paginated', manager: 'default', spread: 'none', minSpreadWidth: p.layoutWidth === 'wide' ? 99999 : 0, allowScriptedContent: true } : { flow: 'scrolled', manager: 'continuous', spread: 'none', allowScriptedContent: true }} getRendition={(rendition) => { p.attachRendition(rendition); p.setEpubLoadedOnce(true); }} />}{p.epubHardError && <div className="absolute inset-0 grid place-items-center text-center px-6"><div className="space-y-3"><p className="text-sm opacity-80">Failed to load this book. Please try again.</p><button className="px-3 py-1.5 rounded-md bg-[#0052FF] text-white text-sm" onClick={() => { p.setEpubHardError(false); p.setEpubAttempt(0); p.setEpubRetryNonce((n) => n + 1); }}>Reload</button></div></div>}</div>}

        {p.book.type === 'pdf' && p.readerContent && <ReaderPdfView file={p.readerContent as string | ArrayBuffer} fontSize={p.fontSize} theme={p.theme} styles={p.styles} layoutWidth={p.layoutWidth} location={p.location} setLocation={p.setLocation} setNumPages={p.setNumPages} progress={typeof p.book.readingProgress?.[p.readingMode] === 'number' ? p.book.readingProgress?.[p.readingMode] : typeof p.book.progress === 'number' ? p.book.progress : undefined} containerId="pdf-container" readingMode={p.readingMode} onPageVisibleChange={(page) => p.setLocation(page)} highlights={p.dedupedHighlights} />}

        {p.book.type === 'txt' && typeof p.book.content === 'string' && <ReaderTextView content={p.book.content} styles={p.styles} fontSize={p.fontSize} layoutWidth={p.layoutWidth} txtContainerRef={p.txtContainerRef} onScroll={p.onTextScroll} readingMode={p.readingMode} pagesPerView={p.textPagedPagesPerView} renderedContent={renderTxtContentWithHighlights(p.book.content, p.dedupedHighlights, p.searchMatchRanges, p.activeSearchResultId || undefined)} />}

        {p.book.type === 'md' && typeof p.book.content === 'string' && <ReaderMarkdownView content={p.book.content} theme={p.theme} styles={p.styles} fontSize={p.fontSize} layoutWidth={p.layoutWidth} txtContainerRef={p.txtContainerRef} onScroll={p.onTextScroll} readingMode={p.readingMode} pagesPerView={p.textPagedPagesPerView} />}

        {p.book.type === 'web' && (
          <div className="h-full w-full overflow-auto p-4 md:p-6 lg:p-8">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.24, ease: 'easeOut' }}
              className={cn('mx-auto w-full rounded-2xl border p-3 md:p-4 space-y-3', p.styles.toolbarGroupBg, p.styles.sidebarBorder)}
            >
              <div className="flex flex-col md:flex-row gap-2">
                <input
                  value={p.webUrl}
                  onChange={(e) => p.setWebUrl(e.target.value)}
                  placeholder="Enter website URL, e.g. https://example.com"
                  className={cn('flex-1 rounded-lg px-3 py-2 text-sm outline-none border transition-all duration-200 focus:ring-4 focus:ring-[#0052FF]/10', p.styles.bg, p.styles.text, p.styles.sidebarBorder)}
                />
                <button
                  onClick={() => {
                    const normalized = p.normalizeWebInputUrl(p.webUrl);
                    if (!normalized) return;
                    p.setWebUrl(normalized);
                    p.setWebFrameStatus('loading');
                    p.setWebFrameHint('Recommended production setup: enable the browser extension bridge (content script + postMessage) for in-page selection, highlights, notes, and AI quotes.');
                  }}
                  className="px-3 py-2 rounded-lg bg-gradient-to-r from-[#0052FF] to-[#4D7CFF] text-white text-sm shadow-[0_12px_24px_-14px_rgba(0,82,255,0.8)] transition-all duration-200 hover:-translate-y-0.5 hover:opacity-95"
                >
                  Load URL
                </button>
              </div>

              <div className={cn('text-xs', p.webBridgeConnected ? 'text-emerald-600' : 'text-amber-600')}>
                {p.webBridgeConnected ? `Bridge status: connected${p.webBridgeVersion ? ` (v${p.webBridgeVersion})` : ''}` : 'Bridge status: waiting for extension bridge handshake'}
              </div>
              {p.webBridgeLastAction && <div className="text-xs text-emerald-700">Last bridge action: {p.webBridgeLastAction}</div>}
              {p.webBridgeLastError && <div className="text-xs text-red-600">Last bridge error: {p.webBridgeLastError}</div>}
              {p.webFrameHint && <div className="text-xs text-amber-600">{p.webFrameHint}</div>}

              {p.webBlockedByPolicy && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-amber-900">
                  <div className="flex items-start gap-2">
                    <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                    <div className="space-y-1">
                      <p className="text-xs font-semibold">This page disallows iframe embedding (CSP / X-Frame-Options)</p>
                      <p className="text-xs leading-relaxed opacity-90">This is an origin security policy enforced by the target page. Direct frontend bypass is not possible. The reader has automatically degraded to external-open mode for reliability.</p>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <button
                      onClick={p.onOpenWebExternally}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-2.5 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Open in new tab
                    </button>
                    <button
                      onClick={p.onRetryWebEmbed}
                      className="inline-flex items-center rounded-lg border border-amber-300 bg-white px-2.5 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100"
                    >
                      Retry embed
                    </button>
                    <button
                      onClick={p.onClearBlockedHost}
                      className="inline-flex items-center rounded-lg border border-amber-300 bg-white px-2.5 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100"
                    >
                      Clear host block cache
                    </button>
                  </div>
                </div>
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.24, delay: 0.04, ease: 'easeOut' }}
              className="mt-4 h-[calc(100%-7.5rem)] min-h-[420px] rounded-2xl overflow-hidden border"
            >
              <div className="relative w-full h-full">
                <iframe
                  ref={p.webIframeRef}
                  src={p.normalizeWebInputUrl(p.webUrl)}
                  className="w-full h-full bg-white"
                  sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
                  referrerPolicy="no-referrer"
                  title={p.book.title}
                  onLoad={() => {
                    p.setWebFrameStatus('loaded');
                    p.setWebFrameHint('Page loaded. If in-page capabilities are limited, use the browser extension bridge for robust selection and quoting.');
                  }}
                  onError={() => {
                    p.setWebFrameStatus('error');
                    p.setWebFrameHint('Embedding failed: this page may block iframe embedding via X-Frame-Options/CSP policies.');
                  }}
                />
                {p.webFrameStatus === 'loading' && <div className="absolute inset-0 grid place-items-center text-sm bg-white/80">Trying to embed website...</div>}
                {p.webBlockedByPolicy && (
                  <div className="absolute inset-0 grid place-items-center gap-2 bg-white/92 p-4 text-center">
                    <AlertTriangle className="h-6 w-6 text-amber-500" />
                    <p className="text-sm text-slate-700">This page cannot be embedded. External-open mode is now active.</p>
                    <button
                      onClick={p.onOpenWebExternally}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Open this page in a new tab
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}

        {p.readingMode === 'paged' && (p.book.type === 'txt' || p.book.type === 'md') && p.txtContainerRef.current && <div className="fixed inset-x-0 bottom-0 z-20" onTouchStart={(e) => p.setTouchStartX(e.changedTouches[0]?.clientX ?? null)} onTouchEnd={(e) => { const endX = e.changedTouches[0]?.clientX; if (p.touchStartX === null || typeof endX !== 'number') return; const delta = endX - p.touchStartX; if (delta > 40) p.turnTextPage('prev'); if (delta < -40) p.turnTextPage('next'); p.setTouchStartX(null); }}><div className={cn('mx-auto mb-6 w-fit px-6 py-3 rounded-full flex items-center gap-6 backdrop-blur-md shadow-2xl', p.styles.panelGlassBg, p.styles.panelGlassText)}><button onClick={() => p.turnTextPage('prev')} disabled={p.textPagedMetrics.current <= 1} className="disabled:opacity-30 hover:text-[#0052FF]"><ChevronLeft className="w-6 h-6" /></button><span className="font-mono text-sm">{p.textPagedMetrics.current} / {p.textPagedMetrics.total}</span><button onClick={() => p.turnTextPage('next')} disabled={p.textPagedMetrics.current >= p.textPagedMetrics.total} className="disabled:opacity-30 hover:text-[#0052FF]"><ChevronRight className="w-6 h-6" /></button></div></div>}
      </div>
    </div>
  );
}
