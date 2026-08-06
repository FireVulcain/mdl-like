"use client";

import { useEffect, useRef } from "react";

/**
 * Adds click-and-drag panning to a horizontal ScrollArea.
 *
 * The whole problem is telling a drag apart from a click, since every card is a
 * link: the pointer only counts as dragging once it has travelled past a small
 * threshold, and the click that follows is swallowed only in that case. Below
 * the threshold nothing is intercepted, so a normal click still opens the show.
 *
 * Mouse only. Touch already pans natively, and hijacking it would break
 * momentum scrolling for no gain.
 */
const DRAG_THRESHOLD_PX = 5;

// Flick behaviour. Everything below is expressed per millisecond, never per
// frame: a 120Hz display gets twice the frames, so a per-frame friction braked
// twice as fast there and a per-frame step travelled half as far. The constant
// is still written as "what 0.94 meant at 60Hz" and converted with the real
// elapsed time, so the feel is identical on any refresh rate.
const FRICTION_PER_FRAME_AT_60 = 0.94;
const REFERENCE_FRAME_MS = 16.667;
const MIN_VELOCITY = 0.08; // px per ms

// Velocity is averaged over a short trailing window rather than taken from the
// last move alone — a single jittery sample just before release would otherwise
// fling the row, or cancel a deliberate flick.
const VELOCITY_WINDOW_MS = 70;

export function DragScroll({ children, className }: { children: React.ReactNode; className?: string }) {
    const rootRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const root = rootRef.current;
        const viewport = root?.querySelector<HTMLElement>("[data-radix-scroll-area-viewport]");
        if (!root || !viewport) return;

        let pressed = false;
        let dragged = false;
        let startX = 0;
        let startScroll = 0;

        // Pointer events fire faster than frames. Writing scrollLeft on each one
        // forces a layout per event and reads as stutter, so the latest position
        // is stored and applied once per frame instead.
        let targetScroll = 0;
        let rafId = 0;

        let velocity = 0; // px per ms
        let samples: { x: number; t: number }[] = [];
        let lastT = 0;
        let momentumId = 0;

        // Speed across the trailing window: total distance over total time, which
        // ignores a lone outlier sample in a way an instantaneous reading cannot.
        const measureVelocity = () => {
            const cutoff = performance.now() - VELOCITY_WINDOW_MS;
            const recent = samples.filter((s) => s.t >= cutoff);
            if (recent.length < 2) return 0;
            const first = recent[0];
            const last = recent[recent.length - 1];
            const dt = last.t - first.t;
            return dt > 0 ? (last.x - first.x) / dt : 0;
        };

        const applyFrame = () => {
            rafId = 0;
            viewport.scrollLeft = targetScroll;
        };
        const schedule = () => {
            if (!rafId) rafId = requestAnimationFrame(applyFrame);
        };

        const stopMomentum = () => {
            if (momentumId) cancelAnimationFrame(momentumId);
            momentumId = 0;
        };

        let momentumLastT = 0;
        const runMomentum = (now: number) => {
            // Clamped: a backgrounded tab resumes with a huge gap, which would
            // otherwise teleport the row across in a single step.
            const dt = Math.min(now - momentumLastT, 50);
            momentumLastT = now;

            velocity *= Math.pow(FRICTION_PER_FRAME_AT_60, dt / REFERENCE_FRAME_MS);
            if (Math.abs(velocity) < MIN_VELOCITY) {
                momentumId = 0;
                return;
            }
            const max = viewport.scrollWidth - viewport.clientWidth;
            targetScroll = Math.max(0, Math.min(max, targetScroll - velocity * dt));
            viewport.scrollLeft = targetScroll;
            // Stop dead at either end rather than grinding against it
            if (targetScroll === 0 || targetScroll === max) {
                momentumId = 0;
                return;
            }
            momentumId = requestAnimationFrame(runMomentum);
        };

        const onPointerDown = (e: PointerEvent) => {
            if (e.pointerType !== "mouse" || e.button !== 0) return;
            stopMomentum();
            pressed = true;
            dragged = false;
            startX = e.clientX;
            startScroll = viewport.scrollLeft;
            targetScroll = startScroll;
            lastT = performance.now();
            samples = [{ x: e.clientX, t: lastT }];
            velocity = 0;
            addMoveListeners();
        };

        const onPointerMove = (e: PointerEvent) => {
            if (!pressed) return;
            const dx = e.clientX - startX;
            if (!dragged) {
                if (Math.abs(dx) < DRAG_THRESHOLD_PX) return;
                dragged = true;
                root.dataset.dragging = "true";
                viewport.setPointerCapture?.(e.pointerId);
            }

            const now = performance.now();
            lastT = now;
            samples.push({ x: e.clientX, t: now });
            if (samples.length > 12) samples.shift();

            const max = viewport.scrollWidth - viewport.clientWidth;
            targetScroll = Math.max(0, Math.min(max, startScroll - dx));
            schedule();
            e.preventDefault();
        };

        const endPress = () => {
            if (!pressed) return;
            pressed = false;
            removeMoveListeners();
            delete root.dataset.dragging;
            if (dragged) {
                // A stale velocity from a pause before release would fling the row
                // for no reason, so only carry it if the pointer was still moving.
                velocity = measureVelocity();
                if (performance.now() - lastT < 80 && Math.abs(velocity) > MIN_VELOCITY) {
                    momentumLastT = performance.now();
                    momentumId = requestAnimationFrame(runMomentum);
                }
                // Cleared after the click that follows pointerup, not before —
                // otherwise the handler below would no longer know a drag happened.
                setTimeout(() => { dragged = false; }, 0);
            }
        };

        // Capture phase: this runs before the click reaches React's handler on the
        // card, which is the only way to stop a link from navigating.
        const onClickCapture = (e: MouseEvent) => {
            if (!dragged) return;
            e.preventDefault();
            e.stopPropagation();
        };

        // Posters are images inside links; without this the browser starts its own
        // ghost-drag and the pan stops dead.
        const onDragStart = (e: DragEvent) => e.preventDefault();

        // Attached only for the duration of a mouse drag, never left on window.
        // A permanent non-passive pointermove listener makes the browser wait for
        // the handler before it can commit a scroll, which costs touch devices
        // their fast path — on a component that does nothing at all for touch.
        const addMoveListeners = () => {
            window.addEventListener("pointermove", onPointerMove, { passive: false });
            window.addEventListener("pointerup", endPress);
            window.addEventListener("pointercancel", endPress);
        };
        const removeMoveListeners = () => {
            window.removeEventListener("pointermove", onPointerMove);
            window.removeEventListener("pointerup", endPress);
            window.removeEventListener("pointercancel", endPress);
        };

        viewport.addEventListener("pointerdown", onPointerDown);
        root.addEventListener("click", onClickCapture, true);
        root.addEventListener("dragstart", onDragStart);

        return () => {
            stopMomentum();
            if (rafId) cancelAnimationFrame(rafId);
            removeMoveListeners();
            viewport.removeEventListener("pointerdown", onPointerDown);
            root.removeEventListener("click", onClickCapture, true);
            root.removeEventListener("dragstart", onDragStart);
        };
    }, []);

    return (
        // select-none is unconditional, not tied to the drag: selection starts on
        // pointerdown, before the threshold decides it is a drag, so switching it
        // on later still leaves a flash of blue-highlighted captions.
        <div
            ref={rootRef}
            className={`select-none md:cursor-grab md:data-[dragging]:cursor-grabbing ${className ?? ""}`}
        >
            {children}
        </div>
    );
}
