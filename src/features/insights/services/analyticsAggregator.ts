import { format, isSameDay, startOfDay, subDays } from 'date-fns';
import { Book } from '@/lib/db';
import { AnalyticsDashboardModel, AnalyticsFilters, ReadingSession } from '../types';

const clamp = (v: number, min = 0, max = 1) => Math.min(max, Math.max(min, v));

export function buildAnalyticsDashboard(
  sessions: ReadingSession[],
  books: Book[],
  filters: AnalyticsFilters,
  goalMinutes = 30,
): AnalyticsDashboardModel {
  const now = Date.now();
  const dayStart = startOfDay(now).getTime();
  const weekStart = subDays(now, 6).getTime();
  const prevWeekStart = subDays(now, 13).getTime();
  const prevWeekEnd = subDays(now, 7).getTime();
  const monthStart = subDays(now, 29).getTime();
  const rangeStart = subDays(now, filters.rangeDays - 1).getTime();

  const visibleBooks = books.filter((b) => (filters.bookType === 'all' ? true : b.type === filters.bookType));
  const visibleBookIds = new Set(visibleBooks.map((b) => b.id));

  const filteredSessions = sessions.filter((s) => {
    if (s.endAt < rangeStart) return false;
    if (!visibleBookIds.has(s.bookId)) return false;
    if (filters.bookId !== 'all' && s.bookId !== filters.bookId) return false;
    return true;
  });

  const todayMinutes = sumMinutes(filteredSessions.filter((s) => s.endAt >= dayStart));
  const weekMinutes = sumMinutes(filteredSessions.filter((s) => s.endAt >= weekStart));
  const monthMinutes = sumMinutes(filteredSessions.filter((s) => s.endAt >= monthStart));

  const monthSessions = filteredSessions.filter((s) => s.endAt >= monthStart);
  const avgSessionMinutes = monthSessions.length ? Math.round(monthMinutes / monthSessions.length) : 0;
  const deepReadingCount = filteredSessions.filter((s) => s.durationMs >= 10 * 60 * 1000).length;
  const deepReadingRatio = filteredSessions.length ? clamp(deepReadingCount / filteredSessions.length) : 0;

  const heatmap = Array.from({ length: 30 }).map((_, i) => {
    const date = subDays(now, 29 - i);
    const daySessions = filteredSessions.filter((s) => isSameDay(s.endAt, date));
    return { date: format(date, 'yyyy-MM-dd'), minutes: sumMinutes(daySessions) };
  });

  const goalCalendar = heatmap.map((d) => ({
    ...d,
    reached: d.minutes >= goalMinutes,
  }));

  const activeDaysIn30d = heatmap.filter((d) => d.minutes >= 5).length;
  const streakDays = computeStreak(heatmap);

  const todBuckets = { morning: 0, afternoon: 0, evening: 0, night: 0 } as const;
  const mutable = { ...todBuckets };
  filteredSessions.forEach((s) => {
    const hour = new Date(s.startAt).getHours();
    if (hour < 6) mutable.night += s.durationMs;
    else if (hour < 12) mutable.morning += s.durationMs;
    else if (hour < 18) mutable.afternoon += s.durationMs;
    else mutable.evening += s.durationMs;
  });
  const preferredTimeOfDay = (Object.entries(mutable).sort((a, b) => b[1] - a[1])[0]?.[0] || 'evening') as 'morning' | 'afternoon' | 'evening' | 'night';

  const scopedBooks = visibleBooks.filter((b) => (filters.bookId === 'all' ? true : b.id === filters.bookId));
  const topBooks = scopedBooks
    .map((b) => ({ bookId: b.id, title: b.title, progress: normalizeBookProgress(b.progress) }))
    .sort((a, b) => b.progress - a.progress)
    .slice(0, 5);

  const completedBooks = scopedBooks.filter((b) => normalizeBookProgress(b.progress) >= 0.99).length;
  const overallAvgProgress = scopedBooks.length
    ? clamp(scopedBooks.reduce((acc, b) => acc + normalizeBookProgress(b.progress), 0) / scopedBooks.length)
    : 0;

  const trend7d = Array.from({ length: 7 }).map((_, i) => {
    const date = subDays(now, 6 - i);
    const daySessions = filteredSessions.filter((s) => isSameDay(s.endAt, date));
    return {
      date: format(date, 'MM-dd'),
      minutes: sumMinutes(daySessions),
      progressDelta: Number(daySessions.reduce((acc, s) => acc + Math.max(0, s.progressDelta), 0).toFixed(4)),
    };
  });

  const currentWeekMinutes = sumMinutes(filteredSessions.filter((s) => s.endAt >= weekStart));
  const previousWeekMinutes = sumMinutes(filteredSessions.filter((s) => s.endAt >= prevWeekStart && s.endAt <= prevWeekEnd));
  const weekOverWeekRatio = previousWeekMinutes === 0 ? (currentWeekMinutes > 0 ? 1 : 0) : (currentWeekMinutes - previousWeekMinutes) / previousWeekMinutes;

  return {
    habit: { streakDays, activeDaysIn30d, preferredTimeOfDay, heatmap, goalCalendar },
    progress: { overallAvgProgress, completedBooks, topBooks, trend7d },
    duration: { todayMinutes, weekMinutes, monthMinutes, avgSessionMinutes, deepReadingRatio },
    weekly: {
      currentWeekMinutes,
      previousWeekMinutes,
      weekOverWeekRatio: Number(weekOverWeekRatio.toFixed(4)),
    },
  };
}

function sumMinutes(sessions: ReadingSession[]) {
  return Math.round(sessions.reduce((acc, s) => acc + s.durationMs, 0) / 60000);
}

function computeStreak(heatmap: Array<{ date: string; minutes: number }>) {
  let streak = 0;
  for (let i = heatmap.length - 1; i >= 0; i -= 1) {
    if (heatmap[i].minutes >= 5) streak += 1;
    else break;
  }
  return streak;
}

function normalizeBookProgress(progress: number | string | undefined) {
  if (typeof progress === 'number') return clamp(progress <= 1 ? progress : progress / 100);
  if (typeof progress === 'string') {
    const n = Number(progress.replace('%', ''));
    if (Number.isFinite(n)) return clamp(n > 1 ? n / 100 : n);
  }
  return 0;
}
