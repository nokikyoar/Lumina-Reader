import React, { useEffect, useMemo, useState } from 'react';
import { getLayoutContainerClass, ReaderLayoutWidth, ReaderThemePalette } from './readerUtils';

type ReadingMode = 'scroll' | 'paged';

interface ReaderTextViewProps {
  content: string;
  styles: ReaderThemePalette;
  fontSize: number;
  layoutWidth: ReaderLayoutWidth;
  txtContainerRef: React.RefObject<HTMLDivElement | null>;
  onScroll: (position: number) => void;
  renderedContent: React.ReactNode;
  readingMode: ReadingMode;
  pagesPerView?: 1 | 2 | 3;
}

export function ReaderTextView({
  content,
  styles,
  fontSize,
  layoutWidth,
  txtContainerRef,
  onScroll,
  renderedContent,
  readingMode,
  pagesPerView = 2,
}: ReaderTextViewProps) {
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    if (readingMode !== 'paged' || !txtContainerRef.current) return;

    const container = txtContainerRef.current;
    const observer = new ResizeObserver(() => {
      setContainerWidth(container.clientWidth);
    });

    setContainerWidth(container.clientWidth);
    observer.observe(container);

    return () => observer.disconnect();
  }, [readingMode, txtContainerRef]);

  const isPaged = readingMode === 'paged';

  const pageWidth = useMemo(() => {
    if (!isPaged) return containerWidth;
    return Math.max(containerWidth / pagesPerView, 1);
  }, [containerWidth, isPaged, pagesPerView]);

  return (
    <div
      ref={txtContainerRef}
      className={isPaged ? 'h-full w-full overflow-x-auto overflow-y-hidden' : 'h-full w-full overflow-auto px-4 py-6 md:px-10 md:py-10 lg:px-16 lg:py-14'}
      onScroll={(e) => {
        const target = e.target as HTMLDivElement;
        onScroll(isPaged ? target.scrollLeft : target.scrollTop);
      }}
    >
      <div
        className={isPaged ? 'h-full' : `mx-auto w-full ${getLayoutContainerClass(layoutWidth)} rounded-2xl ${styles.toolbarGroupBg} px-4 py-2 md:px-8 md:py-4 transition-[max-width] duration-300 ease-out`}
        style={
          isPaged
            ? {
                columnWidth: `${pageWidth}px`,
                columnGap: '0px',
                height: '100%',
                padding: '24px 0',
              }
            : undefined
        }
      >
        <pre
          className={isPaged ? 'whitespace-pre-wrap font-serif leading-relaxed transition-all h-full' : 'whitespace-pre-wrap font-serif leading-relaxed transition-all'}
          style={
            isPaged
              ? {
                  width: `${pageWidth}px`,
                  boxSizing: 'border-box',
                  paddingInline: '20px',
                  fontSize: `${fontSize}%`,
                }
              : { fontSize: `${fontSize}%` }
          }
        >
          {content ? renderedContent : null}
        </pre>
      </div>
    </div>
  );
}
