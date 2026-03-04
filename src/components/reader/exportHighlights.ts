import { Highlight } from '@/lib/db';

export function exportHighlights(bookId: string, bookTitle: string, highlights: Highlight[]) {
  const exportedAt = new Date().toISOString();
  const payload = { bookId, bookTitle, exportedAt, highlights };

  const jsonBlob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const jsonUrl = URL.createObjectURL(jsonBlob);
  const jsonA = document.createElement('a');
  jsonA.href = jsonUrl;
  jsonA.download = `lumina-highlights-${bookId}.json`;
  jsonA.click();
  URL.revokeObjectURL(jsonUrl);

  const mdLines = [
    '# Highlights Export',
    '',
    `- Book: ${bookTitle}`,
    `- Book ID: ${bookId}`,
    `- Exported At: ${exportedAt}`,
    '',
    ...highlights.flatMap((item, index) => [
      `## ${index + 1}. ${item.color.toUpperCase()} highlight`,
      '',
      `> ${item.text}`,
      '',
      item.note ? `**Note (Markdown):**\n\n${item.note}` : '**Note:** _(empty)_',
      '',
      `- ID: ${item.id}`,
      `- Created At: ${new Date(item.createdAt).toISOString()}`,
      '',
    ]),
  ];

  const mdBlob = new Blob([mdLines.join('\n')], { type: 'text/markdown;charset=utf-8' });
  const mdUrl = URL.createObjectURL(mdBlob);
  const mdA = document.createElement('a');
  mdA.href = mdUrl;
  mdA.download = `lumina-highlights-${bookId}.md`;
  mdA.click();
  URL.revokeObjectURL(mdUrl);
}
