/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { Library } from '@/components/Library';
import { Reader } from '@/components/Reader';
import { Book } from '@/lib/db';
import { InsightsPage } from '@/features/insights/InsightsPage';

type AppView = 'library' | 'reader' | 'insights';

export default function App() {
  const [view, setView] = useState<AppView>('library');
  const [currentBook, setCurrentBook] = useState<Book | null>(null);

  const openReader = (book: Book) => {
    setCurrentBook(book);
    setView('reader');
  };

  const backToLibrary = () => {
    setCurrentBook(null);
    setView('library');
  };

  return (
    <div className="min-h-screen bg-brand-light">
      {view === 'reader' && currentBook ? (
        <Reader book={currentBook} onBack={backToLibrary} />
      ) : view === 'insights' ? (
        <InsightsPage onBack={() => setView('library')} />
      ) : (
        <div>
          <Library onSelectBook={openReader} onOpenInsights={() => setView('insights')} />
        </div>
      )}
    </div>
  );
}
