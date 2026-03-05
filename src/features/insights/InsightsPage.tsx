import { useReadingAnalytics } from './hooks/useReadingAnalytics';
import { DurationCards } from './components/DurationCards';
import { HabitHeatmap } from './components/HabitHeatmap';
import { ProgressTrend } from './components/ProgressTrend';
import { AnalyticsRangeDays } from './types';
import { GoalCalendar } from './components/GoalCalendar';
import { WeeklyReportCard } from './components/WeeklyReportCard';

interface Props {
  onBack: () => void;
}

export function InsightsPage({ onBack }: Props) {
  const {
    dashboard,
    sessions,
    refreshDashboard,
    filters,
    setFilters,
    books,
    goalMinutes,
    todayGoalProgress,
    setGoalMinutes,
  } = useReadingAnalytics();

  const isEmpty = dashboard && sessions.length === 0;

  return (
    <div className="min-h-screen bg-[#fcfcfc] px-4 py-8 text-slate-900 md:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="relative mb-6 overflow-hidden rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-[0_24px_52px_-34px_rgba(15,23,42,0.42)] md:p-8">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_0%,rgba(77,124,255,0.12)_0%,rgba(77,124,255,0)_46%)]" />
          <div className="relative z-10 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="inline-flex items-center rounded-full border border-[#0052FF]/20 bg-[#0052FF]/5 px-3 py-1 text-[11px] font-semibold tracking-wide text-[#0052FF]">
                READING INSIGHTS
              </p>
              <h1 className="mt-3 text-2xl font-serif font-bold text-slate-900 md:text-3xl">Your reading rhythm at a glance</h1>
              <p className="mt-2 text-sm text-slate-500 md:text-base">Habit tracking, progress trends, and reading time analytics in one unified dashboard.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => void refreshDashboard()} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100">
                Refresh
              </button>
              <button onClick={onBack} className="rounded-xl bg-gradient-to-r from-[#0052FF] to-[#4D7CFF] px-4 py-2 text-sm font-semibold text-white shadow-[0_16px_32px_-18px_rgba(0,82,255,0.8)] transition-all hover:-translate-y-0.5 hover:opacity-95">
                Back to Library
              </button>
            </div>
          </div>
        </header>

        <section className="mb-5 grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-500">Time Range</span>
            <select
              value={filters.rangeDays}
              onChange={(e) => setFilters({ rangeDays: Number(e.target.value) as AnalyticsRangeDays })}
              className="rounded-lg border border-slate-200 px-3 py-2"
            >
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-500">Book Type</span>
            <select
              value={filters.bookType}
              onChange={(e) => setFilters({ bookType: e.target.value as typeof filters.bookType, bookId: 'all' })}
              className="rounded-lg border border-slate-200 px-3 py-2"
            >
              <option value="all">All types</option>
              <option value="txt">TXT</option>
              <option value="md">Markdown</option>
              <option value="pdf">PDF</option>
              <option value="epub">EPUB</option>
              <option value="web">Web</option>
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-500">Book</span>
            <select
              value={filters.bookId}
              onChange={(e) => setFilters({ bookId: e.target.value })}
              className="rounded-lg border border-slate-200 px-3 py-2"
            >
              <option value="all">All books</option>
              {books
                .filter((b) => (filters.bookType === 'all' ? true : b.type === filters.bookType))
                .map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.title}
                  </option>
                ))}
            </select>
          </label>
        </section>

        {!dashboard ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">Loading reading analytics...</div>
        ) : isEmpty ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <p className="text-lg font-medium text-slate-700">No analyzable reading data yet</p>
            <p className="mt-2 text-sm text-slate-500">Open a book and read for a few minutes, then come back to see trends and habit insights.</p>
          </div>
        ) : (
          <div className="space-y-5">
            <DurationCards
              data={dashboard.duration}
              goalMinutes={goalMinutes}
              todayGoalProgress={todayGoalProgress}
              onGoalChange={(v) => void setGoalMinutes(v)}
            />
            <WeeklyReportCard
              currentWeekMinutes={dashboard.weekly.currentWeekMinutes}
              previousWeekMinutes={dashboard.weekly.previousWeekMinutes}
              weekOverWeekRatio={dashboard.weekly.weekOverWeekRatio}
            />
            <GoalCalendar goalMinutes={goalMinutes} data={dashboard.habit.goalCalendar} />
            <HabitHeatmap
              streakDays={dashboard.habit.streakDays}
              activeDaysIn30d={dashboard.habit.activeDaysIn30d}
              preferredTimeOfDay={dashboard.habit.preferredTimeOfDay}
              heatmap={dashboard.habit.heatmap}
            />
            <ProgressTrend
              overallAvgProgress={dashboard.progress.overallAvgProgress}
              completedBooks={dashboard.progress.completedBooks}
              topBooks={dashboard.progress.topBooks}
              trend7d={dashboard.progress.trend7d}
            />
          </div>
        )}
      </div>
    </div>
  );
}
