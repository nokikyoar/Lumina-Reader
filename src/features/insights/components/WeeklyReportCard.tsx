interface Props {
  currentWeekMinutes: number;
  previousWeekMinutes: number;
  weekOverWeekRatio: number;
}

export function WeeklyReportCard({ currentWeekMinutes, previousWeekMinutes, weekOverWeekRatio }: Props) {
  const ratioPct = `${Math.abs(Math.round(weekOverWeekRatio * 100))}%`;
  const trendText = weekOverWeekRatio > 0 ? `Up ${ratioPct} vs last week` : weekOverWeekRatio < 0 ? `Down ${ratioPct} vs last week` : 'Flat vs last week';
  const trendColor = weekOverWeekRatio > 0 ? 'text-emerald-600' : weekOverWeekRatio < 0 ? 'text-rose-600' : 'text-slate-600';

  return (
    <section className="relative overflow-hidden rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_22px_46px_-34px_rgba(15,23,42,0.45)] md:p-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_0%,rgba(77,124,255,0.1)_0%,rgba(77,124,255,0)_45%)]" />
      <div className="relative z-10">
        <h3 className="text-lg font-serif font-bold text-slate-900">Weekly report</h3>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">This week</p>
            <p className="mt-1.5 text-2xl font-serif font-bold text-slate-900">{currentWeekMinutes} min</p>
          </div>
          <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Last week</p>
            <p className="mt-1.5 text-2xl font-serif font-bold text-slate-900">{previousWeekMinutes} min</p>
          </div>
        </div>
        <p className={`mt-3 text-sm font-semibold ${trendColor}`}>{trendText}</p>
      </div>
    </section>
  );
}
