export type Theme = "dark" | "light";

export const THEME_STORAGE_KEY = "trackr-theme";

/**
 * The inline script that runs before the first paint.
 *
 * It has to be a string injected into <head>, not a component or an effect:
 * React has not run at that point, and anything later would let the dark
 * default paint first and then snap to light — the flash this exists to
 * prevent. Kept to one statement and wrapped in try/catch because localStorage
 * throws outright in a locked-down browser, and a theme is not worth a blank
 * page.
 *
 * Only "light" is written. Dark is what bare :root already is, so the absence
 * of the attribute is the dark theme rather than a state needing declaring.
 */
export const THEME_INIT_SCRIPT = `try{if(localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)})==="light")document.documentElement.dataset.theme="light"}catch(e){}`;

/**
 * The current theme is read off the document rather than kept in React state.
 *
 * The pre-paint script has already written it by the time anything renders, so
 * the DOM is the source of truth and a copy in state could only ever disagree
 * with it. Exposed as an external store so components can subscribe the way
 * React wants them to — no effect that immediately sets state, and a server
 * snapshot that matches what the server actually rendered.
 */
const listeners = new Set<() => void>();

export function subscribeTheme(onChange: () => void): () => void {
    listeners.add(onChange);
    return () => {
        listeners.delete(onChange);
    };
}

export function getThemeSnapshot(): Theme {
    return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

/**
 * What the server rendered, which can only be the default: the choice lives in
 * localStorage and no server has ever seen it. The first client render has to
 * agree with this or hydration tears; the correct value arrives one render
 * later, and the page itself is never wrong in the meantime because the
 * pre-paint script styled it before React existed.
 */
export function getThemeServerSnapshot(): Theme {
    return "dark";
}

/** The change itself, with nothing animated about it. */
export function applyTheme(theme: Theme): void {
    const root = document.documentElement;
    if (theme === "light") root.dataset.theme = "light";
    else delete root.dataset.theme;

    try {
        localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
        // A theme that cannot be remembered is still worth having for this visit.
    }

    for (const listener of listeners) listener();
}

/**
 * Switches the theme behind a circle opening from the control that was pressed.
 *
 * The whole effect is a View Transition — the browser holds a picture of the
 * old page while the new one renders, and both are stacked as pseudo-elements
 * we can animate. All this does is clip the incoming layer to a growing circle.
 *
 * Two reasons to fall back to a plain switch, and both matter more than the
 * animation: a browser without startViewTransition, and a reader who has asked
 * their system for reduced motion. A full-screen wipe is exactly the kind of
 * movement that setting exists to refuse, so it is checked every time rather
 * than read once at load — people change it mid-session, often because
 * something on screen has just made them ill.
 */
export async function switchTheme(theme: Theme, origin?: Element | null): Promise<void> {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!document.startViewTransition || prefersReducedMotion) {
        applyTheme(theme);
        return;
    }

    // Centre of the button, falling back to the corner if it is not on screen.
    const rect = origin?.getBoundingClientRect();
    const x = rect ? rect.left + rect.width / 2 : window.innerWidth;
    const y = rect ? rect.top + rect.height / 2 : 0;

    // The radius has to reach the furthest corner, which is the hypotenuse of
    // the larger horizontal and vertical distances. `circle(100%)` is measured
    // against the element's own box, not the distance to its corners, so it
    // stops short and the last frame lands as a visible jump.
    const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));

    const transition = document.startViewTransition(() => applyTheme(theme));

    try {
        await transition.ready;
    } catch {
        // A transition can be abandoned — a second click, a navigation. The
        // theme is already applied by then, so there is nothing to repair.
        return;
    }

    document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        {
            duration: 500,
            easing: "ease-in-out",
            pseudoElement: "::view-transition-new(root)",
        },
    );
}
