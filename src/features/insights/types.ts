import { Book } from '@/lib/db';

export interface ReadingSession {
  id: string;
  bookId: string;
  bookTitle: string;
  startAt: number;
  endAt: number;
  durationMs: number;
  startProgress: number;
  endProgress: number;
  progressDelta: number;
}

export type AnalyticsRangeDays = 7 | 30 | 90;

export interface AnalyticsFilters {
  rangeDays: AnalyticsRangeDays;
  bookId: string;
  bookType: Book['type'] | 'all';
}

export interface HabitSummary {
  streakDays: number;
  activeDaysIn30d: number;
  preferredTimeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  heatmap: Array<{ date: string; minutes: number }>;
  goalCalendar: Array<{ date: string; minutes: number; reached: boolean }>;
}

export interface ProgressSummary {
  overallAvgProgress: number;
  completedBooks: number;
  topBooks: Array<{ bookId: string; title: string; progress: number }>;
  trend7d: Array<{ date: string; minutes: number; progressDelta: number }>;
}

export interface DurationSummary {
  todayMinutes: number;
  weekMinutes: number;
  monthMinutes: number;
  avgSessionMinutes: number;
  deepReadingRatio: number;
}

export interface WeeklyComparison {
  currentWeekMinutes: number;
  previousWeekMinutes: number;
  weekOverWeekRatio: number;
}

export interface AnalyticsDashboardModel {
  habit: HabitSummary;
  progress: ProgressSummary;
  duration: DurationSummary;
  weekly: WeeklyComparison;
}
