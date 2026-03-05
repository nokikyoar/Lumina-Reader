interface Props {
  overallAvgProgress: number;
  completedBooks: number;
  topBooks: Array<{ bookId: string; title: string; progress: number }>;
  trend7d: Array<{ date: string; minutes: number; progressDelta: number }>;
}

const pct = (v: number) => `${Math.round(v * 100)}%`;

export function ProgressTrend({ overallAvgProgress, completedBooks, topBooks, trend7d }: Props) {
  const maxMinutes = Math.max(1, ...trend7d.map((d) => d.minutes));

  return (
    <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <div className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_22px_46px_-34px_rgba(15,23,42,0.45)] md:p-6">
        <h3 className="text-lg font-serif font-bold text-slate-900">Progress overview</h3>
        <p className="mt-1 text-sm text-slate-500">Average progress and completed books</p>
        <div className="mt-4 flex flex-wrap items-end gap-8">
          <Metric label="Library avg progress" value={pct(overallAvgProgress)} />
          <Metric label="Completed books" value={`${completedBooks}`} />
        </div>

        <div className="mt-5 space-y-3">
          {topBooks.map((b) => (
            <div key={b.bookId}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="truncate text-slate-700">{b.title}</span>
                <span className="font-medium text-slate-900">{pct(b.progress)}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100">
                <div className="h-2 rounded-full bg-gradient-to-r from-[#0052FF] to-[#4D7CFF]" style={{ width: pct(b.progress) }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_22px_46px_-34px_rgba(15,23,42,0.45)] md:p-6">
        <h3 className="text-lg font-serif font-bold text-slate-900">Last 7 days</h3>
        <p className="mt-1 text-sm text-slate-500">Reading minutes + progress delta</p>
        <div className="mt-4 grid grid-cols-7 items-end gap-2">
          {trend7d.map((d) => {
            const h = Math.max(6, Math.round((d.minutes / maxMinutes) * 96));
            return (
              <div key={d.date} className="flex flex-col items-center gap-1">
                <div className="text-[10px] font-medium text-slate-500">+{(d.progressDelta * 100).toFixed(1)}%</div>
                <div className="w-full rounded-md border border-slate-200/80 bg-slate-50 p-1">
                  <div className="w-full rounded bg-gradient-to-t from-[#0052FF] to-[#4D7CFF]" style={{ height: `${h}px` }} />
                </div>
                <div className="text-[10px] text-slate-500">{d.date}</div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</p>
      <p className="mt-1.5 text-2xl font-serif font-bold text-slate-900">{value}</p>
    </div>
  );
}
