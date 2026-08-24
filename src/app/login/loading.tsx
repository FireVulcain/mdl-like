/**
 * A centred card, nothing else — the sign-in form is the whole page.
 *
 * Present for the same reason the calendar's is: without it this route falls
 * back to src/app/loading.tsx and flashes the home page's hero and rails at
 * someone who is not signed in yet.
 */
import { Line, Block } from "@/components/skeleton-parts";

export default function Loading() {
    return (
        <div className="min-h-screen flex items-center justify-center px-4">
            <div className="w-full max-w-sm space-y-6">
                <div className="space-y-2">
                    <Line w="55%" h={26} />
                    <Line w="80%" h={14} />
                </div>
                <div className="space-y-3">
                    <Block className="h-10 w-full" />
                    <Block className="h-10 w-full" />
                    <Block className="h-10 w-full" />
                </div>
                <Line w="60%" h={12} />
            </div>
        </div>
    );
}
