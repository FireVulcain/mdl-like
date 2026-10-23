import type { CronJobStatus } from "@/actions/cron-status";

/**
 * How long ago, said the way someone would say it.
 *
 * The point of this panel is answering "is it still running", so the number
 * that matters is the distance from now — an absolute timestamp makes the
 * reader do that subtraction themselves, every time.
 */
function ago(date: Date): string {
    const mins = Math.floor((Date.now() - date.getTime()) / 60_000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins} min ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return days === 1 ? "yesterday" : `${days} days ago`;
}

/**
 * A job that has not run in over two days has stopped, whatever its last row
 * says. All three are daily, so this is the only way a Coolify task that was
 * deleted, renamed or never created shows up here at all — the row it left
 * behind would otherwise sit there looking healthy for ever.
 */
function isStale(date: Date | null): boolean {
    return date === null || Date.now() - date.getTime() > 2 * 86_400_000;
}

export function CronStatusPanel({ jobs }: { jobs: CronJobStatus[] }) {
    return (
        <div className="divide-y divide-line-soft">
            {jobs.map((job) => {
                const stale = isStale(job.lastRun);
                const failed = job.success === false;
                // The state is the hairline down the left; the words beside it
                // stay in ink, so a late job reads as a sentence, not an alarm.
                const tone = failed ? "bg-dropped" : stale || job.warning ? "bg-onhold" : "bg-watched";

                return (
                    <div key={job.id} className="relative grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 py-3 pl-3.5 first:pt-1 last:pb-1">
                        <span aria-hidden className={`absolute left-0 top-3.5 bottom-3.5 w-0.5 rounded-full ${tone}`} />
                        <div className="min-w-0">
                            <p className="text-sm font-medium text-fg">{job.label}</p>
                            <p className="text-[13px] leading-snug text-fg-dim">{job.what}</p>
                        </div>
                        <div className="text-right text-[13px] tabular-nums text-fg-soft">
                            {job.lastRun ? ago(job.lastRun) : "never run"}
                            <span className="block text-xs text-fg-dim">daily at {job.schedule}</span>
                        </div>
                        {job.figures.length > 0 && (
                            <p className="col-span-2 text-xs tabular-nums text-fg-dim">
                                {job.figures.map((f, i) => (
                                    <span key={f.label}>
                                        {i > 0 && " · "}
                                        <span className="font-medium text-fg-soft">{f.value}</span> {f.label}
                                    </span>
                                ))}
                                {job.durationMs != null && ` · ${(job.durationMs / 1000).toFixed(0)}s`}
                            </p>
                        )}
                        {/* Never run and stale are different problems: one is a
                            task that was never created, the other one that has
                            stopped. Both point at Coolify rather than the code. */}
                        {job.lastRun === null ? (
                            <p className="col-span-2 text-xs text-fg-soft">No scheduled task is calling this yet.</p>
                        ) : stale ? (
                            <p className="col-span-2 text-xs text-fg-soft">Last run was {ago(job.lastRun)}; the schedule may have stopped.</p>
                        ) : null}
                        {job.warning && <p className="col-span-2 text-xs text-fg-soft">{job.warning}</p>}
                        {job.error && <p className="col-span-2 text-xs text-fg-soft">{job.error}</p>}
                    </div>
                );
            })}
        </div>
    );
}
