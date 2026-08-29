/** Square photo cells, six across as MdlPhotoGrid has them. */
import { Line } from "@/components/skeleton-parts";

export default function Loading() {
    return (
        <div className="container py-8 space-y-8 m-auto">
            <div className="space-y-2">
                <Line w="30%" h={30} />
                <Line w={150} h={14} />
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                {Array.from({ length: 24 }, (_, i) => (
                    <div key={i} className="aspect-square w-full animate-pulse rounded-lg bg-surface-2" />
                ))}
            </div>
        </div>
    );
}
