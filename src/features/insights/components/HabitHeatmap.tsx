interface Props {
  streakDays: number;
  activeDaysIn30d: number;
  preferredTimeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  heatmap: Array<{ date: string; minutes: number }>;
}

const levelClass = (minutes: number) => {
  if (minutes >= 60) return 'bg-[#0052FF]';
  if (minutes >= 30) return 'bg-[#4D7CFF]';
  if (minutes >= 10) return 'bg-[#8FB2FF]';
  if (minutes > 0) return 'bg-[#DBE7FF]';
  return 'bg-slate-100';
};

const labelMap = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
  night: 'Late night',
};

export function HabitHeatmap({ streakDays, activeDaysIn30d, preferredTimeOfDay, heatmap }: Props) {
  const chunks = chunkByWeek(heatmap);

  return (
    <section className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_22px_46px_-34px_rgba(15,23,42,0.45)] md:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-serif font-bold text-slate-900">Reading habits</h3>
          <p className="text-sm text-slate-500">30-day activity heatmap and time-of-day preference</p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm text-slate-700">
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">Streak {streakDays} days</span>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">Active {activeDaysIn30d}/30 days</span>
          <span className="rounded-full border border-[#0052FF]/20 bg-[#0052FF]/5 px-3 py-1 text-[#1E3A8A]">Prefers {labelMap[preferredTimeOfDay]}</span>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200/80 bg-slate-50/50 p-3">
        <div className="inline-flex gap-2">
          {chunks.map((week, wIdx) => (
            <div key={`w-${wIdx}`} className="grid grid-rows-7 gap-1">
              {week.map((d) => (
                <div key={d.date} className="group relative h-4 w-4 rounded-sm">
                  <div className={`h-4 w-4 rounded-sm ${levelClass(d.minutes)}`} />
                  <div className="pointer-events-none absolute -top-10 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded bg-slate-900 px-2 py-1 text-xs text-white group-hover:block">
                    {d.date} / {d.minutes} min
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
        <span>Low</span>
        <Legend swatch="bg-slate-100" />
        <Legend swatch="bg-[#DBE7FF]" />
        <Legend swatch="bg-[#8FB2FF]" />
        <Legend swatch="bg-[#4D7CFF]" />
        <Legend swatch="bg-[#0052FF]" />
        <span>High</span>
      </div>
    </section>
  );
}

function Legend({ swatch }: { swatch: string }) {
  return <span className={`inline-block h-3 w-3 rounded-sm ${swatch}`} />;
}

function chunkByWeek(data: Array<{ date: string; minutes: number }>) {
  const weeks: Array<Array<{ date: string; minutes: number }>> = [];
  let current: Array<{ date: string; minutes: number }> = [];
  data.forEach((d, idx) => {
    current.push(d);
    if (current.length === 7 || idx === data.length - 1) {
      while (current.length < 7) {
        current.push({ date: `${d.date}-pad-${current.length}`, minutes: 0 });
      }
      weeks.push(current);
      current = [];
    }
  });
  return weeks;
}
