import React, { useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypeRaw from 'rehype-raw';
import { cn } from '@/lib/utils';
import { CodeBlock, getLayoutContainerClass, ReaderLayoutWidth, ReaderThemePalette, Theme } from './readerUtils';

type ReadingMode = 'scroll' | 'paged';

interface ReaderMarkdownViewProps {
  content: string;
  theme: Theme;
  styles: ReaderThemePalette;
  fontSize: number;
  layoutWidth: ReaderLayoutWidth;
  txtContainerRef: React.RefObject<HTMLDivElement | null>;
  onScroll: (position: number) => void;
  readingMode: ReadingMode;
  pagesPerView?: 1 | 2 | 3;
}

export function ReaderMarkdownView({
  content,
  theme,
  styles,
  fontSize,
  layoutWidth,
  txtContainerRef,
  onScroll,
  readingMode,
  pagesPerView = 2,
}: ReaderMarkdownViewProps) {
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
        className={isPaged ? 'h-full' : cn(`mx-auto w-full ${getLayoutContainerClass(layoutWidth)} rounded-2xl px-4 py-2 md:px-8 md:py-4 transition-[max-width] duration-300 ease-out`, styles.toolbarGroupBg)}
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
        <div
          className={cn(
            'prose max-w-none transition-all',
            theme === 'dark' ? 'prose-invert' : '',
            'prose-headings:font-serif prose-headings:font-bold prose-h1:text-3xl prose-h2:text-2xl prose-p:leading-relaxed prose-code:text-[#0052FF] prose-a:text-[#0052FF] hover:prose-a:text-[#4D7CFF]',
            isPaged ? 'h-full' : '',
            isPaged ? '[&>*]:break-inside-avoid-column' : '',
          )}
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
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeRaw, rehypeSlug, rehypeAutolinkHeadings]}
            components={{
              code({ inline, className, children, ...props }: { inline?: boolean; className?: string; children?: React.ReactNode }) {
                const match = /language-(\w+)/.exec(className || '');
                return !inline && match ? (
                  <CodeBlock language={match[1]} theme={theme}>
                    {String(children).replace(/\n$/, '')}
                  </CodeBlock>
                ) : (
                  <code className={className} {...props}>
                    {children}
                  </code>
                );
              },
            }}
          >
            {content}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
