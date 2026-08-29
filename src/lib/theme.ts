/**
 * The circle that opens when the theme is switched.
 *
 * Only the animation lives here. Which theme is current, where it is stored and
 * how it is applied before the first paint are all next-themes' job — it was
 * already installed and wired in providers.tsx, and running a second system
 * beside it would mean two sources of truth for one attribute.
 */

/**
 * Runs `apply` inside a View Transition and wipes the new theme in behind a
 * circle growing from the control that was pressed.
 *
 * A View Transition holds a picture of the old page while the new one renders
 * and stacks both as pseudo-elements; all this does is clip the incoming layer.
 *
 * Two reasons to skip it, both worth more than the effect: a browser without
 * startViewTransition, and a reader who has asked their system for reduced
 * motion. A full-screen wipe is precisely what that setting exists to refuse,
 * so it is read on every press rather than once at load — people turn it on
 * mid-session, often because something has just made them ill.
 */
export async function themeTransition(apply: () => void, origin?: Element | null): Promise<void> {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!document.startViewTransition || prefersReducedMotion) {
        apply();
        return;
    }

    // Centre of the button, falling back to the top-right corner if it is gone.
    const rect = origin?.getBoundingClientRect();
    const x = rect ? rect.left + rect.width / 2 : window.innerWidth;
    const y = rect ? rect.top + rect.height / 2 : 0;

    // The radius has to reach the furthest corner, which is the hypotenuse of
    // the larger horizontal and vertical distances. `circle(100%)` is measured
    // against the element's own box rather than the distance to its corners, so
    // it stops short and the last frame lands as a visible jump.
    const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));

    // Suspends every element's own colour transition for the length of the
    // sweep. Measured mid-wipe without it: 671 concurrent animations, 667 of
    // them CSSTransitions fired by the theme class change. With it: five.
    document.documentElement.classList.add("theme-wiping");
    const done = () => document.documentElement.classList.remove("theme-wiping");

    const transition = document.startViewTransition(apply);
    void transition.finished.catch(() => {}).then(done);

    try {
        await transition.ready;
    } catch {
        // A transition can be abandoned — a second click, a navigation. The
        // theme is applied by then, so there is nothing to repair.
        done();
        return;
    }

    document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        {
            duration: 560,
            // Decelerating, not ease-in-out, because what the eye follows is the
            // area being uncovered and area grows as the square of the radius.
            // A radius easing symmetrically therefore reveals far more ground in
            // the second half than the first, and the sweep appears to lurch
            // just as it finishes. Easing the radius out flattens that back.
            // Same curve the rest of the site animates on.
            easing: "cubic-bezier(0.22, 1, 0.36, 1)",
            pseudoElement: "::view-transition-new(root)",
            // Without this the clip reverts to none the instant the animation
            // ends, and the transition is torn down a beat later. Measured, the
            // two land 1ms apart — fine until a frame is dropped, and then
            // whatever the circle had not yet reached appears at once. That is
            // the snap: not the easing, but the last frames going missing and
            // the clip being released before the layer it was clipping.
            fill: "forwards",
        },
    );
}
