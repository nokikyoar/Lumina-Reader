import { DurationSummary } from '../types';

interface Props {
  data: DurationSummary;
  goalMinutes: number;
  todayGoalProgress: number;
  onGoalChange: (minutes: number) => void;
}

const pct = (v: number) => `${Math.round(v * 100)}%`;

export function DurationCards({ data, goalMinutes, todayGoalProgress, onGoalChange }: Props) {
  return (
    <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
      <Card title="Today" value={`${data.todayMinutes} min`} />
      <Card title="Last 7 days" value={`${data.weekMinutes} min`} />
      <Card title="Last 30 days" value={`${data.monthMinutes} min`} />
      <Card title="Avg session" value={`${data.avgSessionMinutes} min`} />
      <Card title="Deep reading ratio" value={pct(data.deepReadingRatio)} />
      <GoalCard goalMinutes={goalMinutes} todayGoalProgress={todayGoalProgress} onGoalChange={onGoalChange} />
    </section>
  );
}

function Card({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_18px_36px_-30px_rgba(15,23,42,0.45)]">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{title}</p>
      <p className="mt-2 text-2xl font-serif font-bold text-slate-900">{value}</p>
    </div>
  );
}

function GoalCard({
  goalMinutes,
  todayGoalProgress,
  onGoalChange,
}: {
  goalMinutes: number;
  todayGoalProgress: number;
  onGoalChange: (minutes: number) => void;
}) {
  const clamped = Math.max(0, Math.min(1, todayGoalProgress));

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#0052FF]/15 bg-white p-4 shadow-[0_18px_36px_-30px_rgba(0,82,255,0.45)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_90%_0%,rgba(77,124,255,0.16)_0%,rgba(77,124,255,0)_55%)]" />
      <div className="relative z-10">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#4D7CFF]">Daily goal</p>
        <div className="mt-2 flex items-center gap-2">
          <input
            type="number"
            min={5}
            max={600}
            value={goalMinutes}
            onChange={(e) => onGoalChange(Number(e.target.value || 0))}
            className="w-24 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-800 outline-none ring-[#0052FF]/20 transition focus:border-[#4D7CFF]/50 focus:ring-4"
          />
          <span className="text-sm text-slate-600">min</span>
        </div>

        <div className="mt-3 h-2 rounded-full bg-slate-100">
          <div className="h-2 rounded-full bg-gradient-to-r from-[#0052FF] to-[#4D7CFF]" style={{ width: `${Math.round(clamped * 100)}%` }} />
        </div>
        <p className="mt-2 text-xs font-medium text-slate-500">Today: {Math.round(clamped * 100)}%</p>
      </div>
    </div>
  );
}
