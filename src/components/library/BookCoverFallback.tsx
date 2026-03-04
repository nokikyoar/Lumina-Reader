import { Book } from '@/lib/db';
import { cn } from '@/lib/utils';
import { splitTextByVisualWidth } from './coverTextLayout';
import { pickCoverPalette } from './coverPalette';

interface BookCoverFallbackProps {
  title: string;
  author?: string;
  type: Book['type'];
  className?: string;
  titleClassName?: string;
}

export function BookCoverFallback({ title, author, type, className, titleClassName }: BookCoverFallbackProps) {
  const lines = splitTextByVisualWidth(title || 'Untitled', { maxLines: 5, maxLineWidth: 7.6 });
  const palette = pickCoverPalette(`${type}:${title}:${author || ''}`);

  return (
    <div
      className={cn('w-full h-full p-6 text-white relative overflow-hidden', className)}
      style={{
        backgroundImage: `linear-gradient(140deg, ${palette.bg1} 0%, ${palette.bg2} 58%, ${palette.bg3 || palette.bg2} 100%)`,
      }}
    >
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(circle at 18% 8%, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0) 58%)',
        }}
      />
      <div className="absolute inset-0 rounded-none bg-white/[0.07]" />

      <div className="relative h-full flex flex-col">
        <div className="mt-1 flex-1 flex items-center min-h-0">
          <h3 className={cn('font-serif font-bold text-xl leading-snug drop-shadow-sm break-words pr-1', titleClassName)} style={{ color: palette.text }}>
            {lines.map((line, index) => (
              <span key={`${line}-${index}`} className="block leading-snug">
                {line}
              </span>
            ))}
          </h3>
        </div>

        <p className="text-sm line-clamp-1" style={{ color: palette.subtleText }}>{author || 'Unknown Author'}</p>
      </div>
    </div>
  );
}
