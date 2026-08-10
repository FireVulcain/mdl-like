// The top progress bar starts itself when a link is clicked. Anything that
// navigates or waits without a link — router.push, a server action — has to say
// so, and these are how it says it.
//
// Window events rather than a context: ProgressBar sits in Providers, near the
// root, and the things that need to talk to it are scattered across the tree.
// A provider wrapped around the whole app to carry one boolean is the more
// expensive answer to the same problem.

export const PROGRESS_START = "trackr:progress-start";
export const PROGRESS_DONE = "trackr:progress-done";

/** Something began that the user cannot see yet: a route change, or a write. */
export function startProgress() {
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(PROGRESS_START));
}

/**
 * Only needed for work that does not end in a route change — a server action
 * that refreshes in place, say. A navigation completes the bar by arriving.
 */
export function doneProgress() {
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(PROGRESS_DONE));
}
