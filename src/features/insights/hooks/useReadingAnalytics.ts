import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getBooksSnapshot,
  getInsightsGoalMinutes,
  getReadingSessions,
  setInsightsGoalMinutes,
} from '../services/analyticsRepo';
import { buildAnalyticsDashboard } from '../services/analyticsAggregator';
import { AnalyticsDashboardModel, AnalyticsFilters, ReadingSession } from '../types';

const DEFAULT_FILTERS: AnalyticsFilters = {
  rangeDays: 30,
  bookId: 'all',
  bookType: 'all',
};

export function useReadingAnalytics() {
  const [dashboard, setDashboard] = useState<AnalyticsDashboardModel | null>(null);
  const [filters, setFilters] = useState<AnalyticsFilters>(DEFAULT_FILTERS);
  const [books, setBooks] = useState<Array<{ id: string; title: string; type: string }>>([]);
  const [sessions, setSessions] = useState<ReadingSession[]>([]);
  const [goalMinutes, setGoalMinutesState] = useState(30);

  const refreshDashboard = useCallback(
    async (nextFilters?: AnalyticsFilters, nextGoalMinutes?: number) => {
      const targetFilters = nextFilters || filters;
      const targetGoalMinutes = nextGoalMinutes ?? goalMinutes;
      const [allSessions, allBooks] = await Promise.all([
        getReadingSessions(targetFilters),
        getBooksSnapshot(),
      ]);

      setSessions(allSessions);
      setBooks(allBooks.map((b) => ({ id: b.id, title: b.title, type: b.type })));
      setDashboard(buildAnalyticsDashboard(allSessions, allBooks, targetFilters, targetGoalMinutes));
    },
    [filters, goalMinutes],
  );

  useEffect(() => {
    void getInsightsGoalMinutes().then((v) => {
      setGoalMinutesState(v);
      void refreshDashboard(filters, v);
    });
  }, [filters, refreshDashboard]);

  const updateFilters = useCallback((partial: Partial<AnalyticsFilters>) => {
    setFilters((prev) => ({ ...prev, ...partial }));
  }, []);

  const updateGoalMinutes = useCallback(
    async (value: number) => {
      const safe = Math.max(5, Math.min(600, Math.round(value)));
      await setInsightsGoalMinutes(safe);
      setGoalMinutesState(safe);
      await refreshDashboard(filters, safe);
    },
    [filters, refreshDashboard],
  );

  const todayGoalProgress = useMemo(() => {
    if (!dashboard) return 0;
    return Math.min(1, dashboard.duration.todayMinutes / Math.max(1, goalMinutes));
  }, [dashboard, goalMinutes]);

  return {
    dashboard,
    sessions,
    filters,
    books,
    goalMinutes,
    todayGoalProgress,
    setFilters: updateFilters,
    setGoalMinutes: updateGoalMinutes,
    refreshDashboard,
  };
}
