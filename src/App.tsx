/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Library } from '@/components/Library';
import { Reader } from '@/components/Reader';
import { Book } from '@/lib/db';

export default function App() {
  const [currentBook, setCurrentBook] = useState<Book | null>(null);

  return (
    <div className="min-h-screen bg-brand-light">
      {currentBook ? (
        <Reader 
          book={currentBook} 
          onBack={() => setCurrentBook(null)} 
        />
      ) : (
        <Library onSelectBook={setCurrentBook} />
      )}
    </div>
  );
}
