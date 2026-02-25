import { getContinueWatching } from "@/actions/stats";
import { ContinueWatching } from "@/components/continue-watching";

export async function ContinueWatchingData() {
    const items = await getContinueWatching();
    return <ContinueWatching items={items} />;
}
