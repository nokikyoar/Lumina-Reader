import { motion } from 'motion/react';
import { BookOpen, Globe, Plus, Search, Sparkles } from 'lucide-react';

interface LibraryHeaderProps {
  filter: string;
  onFilterChange: (value: string) => void;
  onAddBook: () => void;
  onAddWeb: () => void;
}

export function LibraryHeader({ filter, onFilterChange, onAddBook, onAddWeb }: LibraryHeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/80 backdrop-blur-2xl supports-[backdrop-filter]:bg-white/65">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-6 px-6">
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="flex items-center gap-4"
        >
          <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0052FF] to-[#4D7CFF] text-white shadow-[0_14px_30px_-16px_rgba(0,82,255,0.85)]">
            <BookOpen className="h-5 w-5" />
            <Sparkles className="absolute -right-1 -top-1 h-3.5 w-3.5 text-[#CFE0FF] drop-shadow-sm" />
          </div>
          <div className="leading-tight">
            <h1 className="text-xl font-serif font-bold tracking-tight text-slate-900">Lumina</h1>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Reader Workspace</p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05, ease: 'easeOut' }}
          className="hidden max-w-xl flex-1 md:block"
        >
          <div className="group relative">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition-colors duration-300 group-focus-within:text-[#0052FF]" />
            <input
              type="text"
              placeholder="Search your library..."
              value={filter}
              onChange={(e) => onFilterChange(e.target.value)}
              className="w-full rounded-2xl border border-slate-200/80 bg-white py-3 pl-11 pr-4 text-sm font-medium text-slate-800 shadow-[0_8px_24px_-18px_rgba(15,23,42,0.35)] outline-none transition-all duration-300 placeholder:text-slate-400 focus:border-[#4D7CFF]/40 focus:ring-4 focus:ring-[#0052FF]/10"
            />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.35, delay: 0.08, ease: 'easeOut' }}
          className="flex items-center gap-3"
        >
          <button
            onClick={onAddWeb}
            className="group flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 font-medium text-slate-700 transition-all duration-300 hover:-translate-y-0.5 hover:border-[#4D7CFF]/35 hover:text-[#0052FF]"
          >
            <Globe className="h-4 w-4" />
            <span className="hidden sm:inline">Add URL</span>
          </button>
          <button
            onClick={onAddBook}
            className="group flex items-center gap-2 rounded-full bg-gradient-to-r from-[#0052FF] to-[#4D7CFF] px-5 py-2.5 font-medium text-white shadow-[0_14px_30px_-16px_rgba(0,82,255,0.8)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_20px_34px_-16px_rgba(0,82,255,0.75)] active:scale-95"
          >
            <Plus className="h-4 w-4 transition-transform duration-300 group-hover:rotate-90" />
            <span className="hidden sm:inline">Add Book</span>
          </button>
        </motion.div>
      </div>
    </header>
  );
}
