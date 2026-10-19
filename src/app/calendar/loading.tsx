/**
 * This file has to exist even though the page carries its own Suspense
 * fallback: that one only appears once the route has committed, and a route
 * with no loading file of its own falls back to the nearest ancestor's — which
 * here is src/app/loading.tsx, the home page's hero and rails. Deleting this
 * file does not mean "no skeleton", it means "the wrong one".
 */
import { ScheduleSkeleton } from "@/components/schedule-skeleton";

export default function Loading() {
    return <ScheduleSkeleton />;
}
