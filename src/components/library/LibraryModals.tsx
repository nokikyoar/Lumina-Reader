import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ImagePlus, RefreshCcw, Trash2, Upload, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Book, Category } from '@/lib/db';

interface LibraryModalsProps {
  showUploadModal: boolean;
  setShowUploadModal: React.Dispatch<React.SetStateAction<boolean>>;
  getRootProps: () => Record<string, unknown>;
  getInputProps: () => Record<string, unknown>;
  isDragActive: boolean;
  bookToEdit: Book | null;
  setBookToEdit: React.Dispatch<React.SetStateAction<Book | null>>;
  editTitle: string;
  setEditTitle: React.Dispatch<React.SetStateAction<string>>;
  editAuthor: string;
  setEditAuthor: React.Dispatch<React.SetStateAction<string>>;
  editCover?: string;
  onEditCoverFile: (file: File | null) => Promise<void>;
  onResetCover: () => void;
  isProcessingCover: boolean;
  handleSaveEdit: () => void;
  deleteConfirm: { isOpen: boolean; bookId: string | null };
  setDeleteConfirm: React.Dispatch<React.SetStateAction<{ isOpen: boolean; bookId: string | null }>>;
  confirmDelete: () => void;
  categoryToRename: Category | null;
  setCategoryToRename: React.Dispatch<React.SetStateAction<Category | null>>;
  renameCategoryName: string;
  setRenameCategoryName: React.Dispatch<React.SetStateAction<string>>;
  handleRenameCategory: () => void;
  categoryToDelete: Category | null;
  setCategoryToDelete: React.Dispatch<React.SetStateAction<Category | null>>;
  deleteCategoryMode: 'keep-books' | 'delete-books';
  setDeleteCategoryMode: React.Dispatch<React.SetStateAction<'keep-books' | 'delete-books'>>;
  handleDeleteCategory: () => void;
}

const overlayClass = 'absolute inset-0 bg-slate-950/45 backdrop-blur-md';
const panelClass = 'relative z-10 overflow-hidden border border-slate-200/80 bg-white/95 backdrop-blur-xl shadow-[0_28px_80px_-38px_rgba(15,23,42,0.45)]';
const primaryButtonClass = 'rounded-xl bg-gradient-to-r from-[#0052FF] to-[#4D7CFF] px-4 py-2 font-medium text-white shadow-[0_14px_30px_-16px_rgba(0,82,255,0.8)] transition-all duration-200 hover:-translate-y-0.5 hover:opacity-95';
const ghostButtonClass = 'rounded-xl px-4 py-2 text-slate-600 transition-all duration-200 hover:-translate-y-0.5 hover:bg-slate-100';

export function LibraryModals(props: LibraryModalsProps) {
  const {
    showUploadModal,
    setShowUploadModal,
    getRootProps,
    getInputProps,
    isDragActive,
    bookToEdit,
    setBookToEdit,
    editTitle,
    setEditTitle,
    editAuthor,
    setEditAuthor,
    editCover,
    onEditCoverFile,
    onResetCover,
    isProcessingCover,
    handleSaveEdit,
    deleteConfirm,
    setDeleteConfirm,
    confirmDelete,
    categoryToRename,
    setCategoryToRename,
    renameCategoryName,
    setRenameCategoryName,
    handleRenameCategory,
    categoryToDelete,
    setCategoryToDelete,
    deleteCategoryMode,
    setDeleteCategoryMode,
    handleDeleteCategory,
  } = props;

  return (
    <>
      <AnimatePresence>
        {showUploadModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowUploadModal(false)} className={overlayClass} />
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 16 }}
              transition={{ duration: 0.28, ease: 'easeOut' }}
              className={cn(panelClass, 'w-full max-w-2xl rounded-3xl p-7 md:p-8')}
            >
              <div className="absolute left-0 top-0 h-1.5 w-full bg-gradient-to-r from-[#0052FF] to-[#4D7CFF]" />
              <button onClick={() => setShowUploadModal(false)} className="absolute right-6 top-6 rounded-full p-2 transition-colors hover:bg-slate-100/80">
                <X className="h-5 w-5 text-slate-400" />
              </button>

              <motion.h2 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: 0.03 }} className="mb-2 text-3xl font-serif font-bold tracking-tight text-slate-900">Add to Library</motion.h2>
              <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: 0.06 }} className="mb-8 leading-relaxed text-slate-500">Import your favorite stories in PDF, EPUB, TXT, or MD format.</motion.p>

              <div
                {...getRootProps()}
                className={cn(
                  'group flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed bg-gradient-to-b from-white to-slate-50/80 p-12 text-center transition-all duration-300',
                  isDragActive ? 'scale-[1.01] border-[#4D7CFF] bg-[#0052FF]/5' : 'border-slate-200 hover:border-[#4D7CFF]/50 hover:bg-slate-50'
                )}
              >
                <input {...getInputProps()} />
                <div
                  className={cn(
                    'mb-6 flex h-20 w-20 items-center justify-center rounded-full shadow-lg transition-all group-hover:scale-110',
                    isDragActive ? 'bg-gradient-to-r from-[#0052FF] to-[#4D7CFF] text-white shadow-[#0052FF]/30' : 'bg-white text-[#0052FF] shadow-slate-200/70'
                  )}
                >
                  <Upload className="h-8 w-8" />
                </div>
                <p className="mb-2 text-xl font-bold text-slate-900">Click or drag files here</p>
                <p className="mx-auto max-w-xs text-sm leading-relaxed text-slate-400">Supports EPUB, PDF, Markdown, and Text files.</p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {bookToEdit && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setBookToEdit(null)} className={overlayClass} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ duration: 0.26, ease: 'easeOut' }}
              className={cn(panelClass, 'flex max-h-[82vh] w-full max-w-md flex-col rounded-2xl')}
            >
              <div className="border-b border-slate-100/90 bg-gradient-to-r from-white to-[#0052FF]/[0.04] p-5">
                <h3 className="text-xl font-bold text-slate-900">Edit Book Details</h3>
              </div>

              <div className="space-y-4 overflow-y-auto p-5">
                <div className="flex h-[240px] w-full items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                  {editCover ? <img src={editCover} alt="Book cover" className="h-full w-full object-contain" /> : <div className="grid h-full w-full place-items-center text-slate-400">No cover</div>}
                </div>

                <div className="flex flex-wrap gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm transition-colors hover:border-[#4D7CFF]/40 hover:bg-[#0052FF]/5" title="Change Cover">
                    <ImagePlus className="h-4 w-4 text-[#0052FF]" />
                    Change Cover
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        void onEditCoverFile(file);
                        e.currentTarget.value = '';
                      }}
                    />
                  </label>
                  <button onClick={onResetCover} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm transition-colors hover:bg-slate-50" title="Reset Cover">
                    <RefreshCcw className="h-4 w-4" />
                    Reset Cover
                  </button>
                </div>

                {isProcessingCover && <p className="text-xs text-slate-500">Processing cover image, please wait…</p>}

                <input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full rounded-xl border border-slate-300/90 px-3 py-2.5 transition-all focus:border-[#4D7CFF]/40 focus:outline-none focus:ring-4 focus:ring-[#0052FF]/10"
                  placeholder="Title"
                  title="Book Title"
                />
                <input
                  value={editAuthor}
                  onChange={(e) => setEditAuthor(e.target.value)}
                  className="w-full rounded-xl border border-slate-300/90 px-3 py-2.5 transition-all focus:border-[#4D7CFF]/40 focus:outline-none focus:ring-4 focus:ring-[#0052FF]/10"
                  placeholder="Author"
                  title="Book Author"
                />
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-100 bg-white p-5">
                <button onClick={() => setBookToEdit(null)} className={ghostButtonClass}>Cancel</button>
                <button onClick={handleSaveEdit} className={primaryButtonClass}>Save Changes</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deleteConfirm.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDeleteConfirm({ isOpen: false, bookId: null })} className={overlayClass} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className={cn(panelClass, 'w-full max-w-sm rounded-2xl p-6')}
            >
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600"><Trash2 className="h-6 w-6" /></div>
              <h3 className="mb-2 text-center text-xl font-bold">Delete Book?</h3>
              <p className="mb-5 text-center text-sm text-slate-500">This action cannot be undone.</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteConfirm({ isOpen: false, bookId: null })} className={cn(ghostButtonClass, 'flex-1')}>Cancel</button>
                <button onClick={confirmDelete} className="flex-1 rounded-xl bg-red-600 px-4 py-2 text-white transition-colors hover:bg-red-700">Delete</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {categoryToRename && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setCategoryToRename(null)} className={overlayClass} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className={cn(panelClass, 'w-full max-w-sm rounded-2xl p-6')}
            >
              <h3 className="mb-4 text-xl font-bold text-slate-900">Rename Category</h3>
              <input
                value={renameCategoryName}
                onChange={(e) => setRenameCategoryName(e.target.value)}
                className="mb-6 w-full rounded-xl border border-slate-300/90 px-3 py-2.5 transition-all focus:border-[#4D7CFF]/40 focus:outline-none focus:ring-4 focus:ring-[#0052FF]/10"
              />
              <div className="flex gap-3">
                <button onClick={() => setCategoryToRename(null)} className={cn(ghostButtonClass, 'flex-1')}>Cancel</button>
                <button onClick={handleRenameCategory} className={cn(primaryButtonClass, 'flex-1')}>Save</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {categoryToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setCategoryToDelete(null)} className={overlayClass} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className={cn(panelClass, 'w-full max-w-md rounded-2xl p-6')}
            >
              <h3 className="mb-2 text-center text-xl font-bold text-slate-900">Delete Category?</h3>
              <p className="mb-5 text-center text-sm text-slate-500">Choose what to do with books in this category.</p>
              <div className="mb-6 space-y-3">
                <label className={cn('flex cursor-pointer items-center rounded-xl border p-3 transition-colors', deleteCategoryMode === 'keep-books' ? 'border-[#4D7CFF] bg-[#0052FF]/5' : 'border-slate-200 hover:bg-slate-50')}>
                  <input type="radio" checked={deleteCategoryMode === 'keep-books'} onChange={() => setDeleteCategoryMode('keep-books')} />
                  <span className="ml-3 text-sm">Keep books</span>
                </label>
                <label className={cn('flex cursor-pointer items-center rounded-xl border p-3 transition-colors', deleteCategoryMode === 'delete-books' ? 'border-red-500 bg-red-50' : 'border-slate-200 hover:bg-slate-50')}>
                  <input type="radio" checked={deleteCategoryMode === 'delete-books'} onChange={() => setDeleteCategoryMode('delete-books')} />
                  <span className="ml-3 text-sm">Delete books</span>
                </label>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setCategoryToDelete(null)} className={cn(ghostButtonClass, 'flex-1')}>Cancel</button>
                <button onClick={handleDeleteCategory} className="flex-1 rounded-xl bg-red-600 px-4 py-2 text-white transition-colors hover:bg-red-700">Confirm Delete</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
