import {
  getAllBooks,
  getAllReadingSessions,
  getReaderMeta,
  saveReadingSession,
  saveReaderMeta,
} from '@/lib/db';
import { AnalyticsFilters, ReadingSession } from '../types';

const LEGACY_KEY = 'reader.analytics.sessions.v1';
const MIGRATION_KEY = 'reader.analytics.migrated.v1';

export async function appendReadingSession(session: ReadingSession) {
  await saveReadingSession(session);
}

export async function getReadingSessions(filters?: AnalyticsFilters): Promise<ReadingSession[]> {
  await migrateLegacySessionsIfNeeded();
  const sessions = await getAllReadingSessions();
  if (!filters) return sessions;
  const since = Date.now() - filters.rangeDays * 24 * 60 * 60 * 1000;
  return sessions.filter((s) => s.endAt >= since);
}

export async function getBooksSnapshot() {
  return getAllBooks();
}

export async function getInsightsGoalMinutes() {
  return (await getReaderMeta<number>('reader.analytics.goal.dailyMinutes')) || 30;
}

export async function setInsightsGoalMinutes(value: number) {
  const safe = Math.max(5, Math.min(600, Math.round(value)));
  await saveReaderMeta('reader.analytics.goal.dailyMinutes', safe);
}

async function migrateLegacySessionsIfNeeded() {
  const migrated = await getReaderMeta<boolean>(MIGRATION_KEY);
  if (migrated) return;

  const legacy = (await getReaderMeta<ReadingSession[]>(LEGACY_KEY)) || [];
  for (const session of legacy) {
    await saveReadingSession(session);
  }

  await saveReaderMeta(MIGRATION_KEY, true);
}
