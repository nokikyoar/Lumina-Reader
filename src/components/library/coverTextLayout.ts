const CJK_REGEX = /[\u3400-\u9FFF\uF900-\uFAFF\u3040-\u30FF\uAC00-\uD7AF]/;

function charVisualWidth(char: string): number {
  if (CJK_REGEX.test(char)) return 1;
  if (/[A-Z]/.test(char)) return 0.72;
  if (/[a-z0-9]/.test(char)) return 0.6;
  if (/\s/.test(char)) return 0.35;
  return 0.62;
}

export function splitTextByVisualWidth(input: string, options?: { maxLines?: number; maxLineWidth?: number }) {
  const maxLines = options?.maxLines ?? 4;
  const maxLineWidth = options?.maxLineWidth ?? 8.8;
  const normalized = input.replace(/\s+/g, ' ').trim();

  if (!normalized) return ['Untitled'];

  const lines: string[] = [];
  let currentLine = '';
  let currentWidth = 0;

  for (const char of Array.from(normalized)) {
    const width = charVisualWidth(char);
    if (currentLine && currentWidth + width > maxLineWidth) {
      lines.push(currentLine.trimEnd());
      currentLine = char;
      currentWidth = width;
      if (lines.length >= maxLines) break;
      continue;
    }
    currentLine += char;
    currentWidth += width;
  }

  if (lines.length < maxLines && currentLine.trim()) {
    lines.push(currentLine.trimEnd());
  }

  const consumed = lines.join('').replace(/\s+/g, '');
  const source = normalized.replace(/\s+/g, '');
  const isTruncated = consumed.length < source.length;

  if (isTruncated && lines.length > 0) {
    const last = lines[lines.length - 1] || '';
    const trimmedLast = Array.from(last).slice(0, Math.max(1, Array.from(last).length - 1)).join('');
    lines[lines.length - 1] = `${trimmedLast}…`;
  }

  return lines.slice(0, maxLines);
}
