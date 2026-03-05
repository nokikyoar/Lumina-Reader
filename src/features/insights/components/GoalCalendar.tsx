interface Props {
  goalMinutes: number;
  data: Array<{ date: string; minutes: number; reached: boolean }>;
}

export function GoalCalendar({ goalMinutes, data }: Props) {
  const reachedDays = data.filter((d) => d.reached).length;

  return (
    <section className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_22px_46px_-34px_rgba(15,23,42,0.45)] md:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-serif font-bold text-slate-900">Goal calendar</h3>
          <p className="text-sm text-slate-500">Last 30 days (goal: {goalMinutes} min/day)</p>
        </div>
        <span className="rounded-full border border-[#0052FF]/15 bg-[#0052FF]/5 px-3 py-1 text-sm font-medium text-[#1E3A8A]">Reached {reachedDays}/30 days</span>
      </div>

      <div className="grid grid-cols-10 gap-2 md:grid-cols-15 lg:grid-cols-30">
        {data.map((d) => (
          <div key={d.date} className="group relative">
            <div
              className={`h-6 w-full rounded-md border transition-colors ${
                d.reached
                  ? 'border-[#4D7CFF]/30 bg-gradient-to-br from-[#0052FF] to-[#4D7CFF]'
                  : 'border-slate-200/80 bg-slate-100'
              }`}
            />
            <div className="pointer-events-none absolute -top-10 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded bg-slate-900 px-2 py-1 text-xs text-white group-hover:block">
              {d.date} / {d.minutes} min / {d.reached ? 'Reached' : 'Not reached'}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
