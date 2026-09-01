import { AlertTriangle, CheckCircle2, Clock, XCircle } from "lucide-react";
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
        <div className="space-y-3">
            {jobs.map((job) => {
                const stale = isStale(job.lastRun);
                const failed = job.success === false;
                const Icon = failed ? XCircle : stale || job.warning ? AlertTriangle : CheckCircle2;
                const tone = failed ? "text-dropped" : stale || job.warning ? "text-onhold" : "text-watched";

                return (
                    <div key={job.id} className="rounded-xl border border-line bg-surface-1 p-4">
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-2.5 min-w-0">
                                <Icon className={`size-4 shrink-0 mt-0.5 ${tone}`} />
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold text-fg">{job.label}</p>
                                    <p className="text-xs text-fg-faint leading-snug mt-0.5">{job.what}</p>
                                </div>
                            </div>
                            <div className="text-right shrink-0">
                                <p className="text-xs tabular-nums text-fg-muted">{job.lastRun ? ago(job.lastRun) : "never run"}</p>
                                <p className="text-[11px] text-fg-faint flex items-center justify-end gap-1 mt-0.5">
                                    <Clock className="size-3" />
                                    {job.schedule}
                                </p>
                            </div>
                        </div>

                        {job.figures.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 pl-6.5">
                                {job.figures.map((f) => (
                                    <span key={f.label} className="text-xs text-fg-dim">
                                        <span className="tabular-nums font-medium text-fg-soft">{f.value}</span> {f.label}
                                    </span>
                                ))}
                                {job.durationMs != null && (
                                    <span className="text-xs text-fg-faint tabular-nums">{(job.durationMs / 1000).toFixed(0)}s</span>
                                )}
                            </div>
                        )}

                        {/* Never run and stale are different problems: one is a
                            task that was never created, the other one that has
                            stopped. Both point at Coolify rather than the code. */}
                        {job.lastRun === null ? (
                            <p className="mt-3 pl-6.5 text-xs text-onhold">No scheduled task is calling this yet.</p>
                        ) : stale ? (
                            <p className="mt-3 pl-6.5 text-xs text-onhold">Last run was {ago(job.lastRun)} — the schedule may have stopped.</p>
                        ) : null}

                        {job.warning && <p className="mt-2 pl-6.5 text-xs text-onhold">{job.warning}</p>}
                        {job.error && <p className="mt-2 pl-6.5 text-xs text-dropped">{job.error}</p>}
                    </div>
                );
            })}
        </div>
    );
}
