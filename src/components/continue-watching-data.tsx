import { getContinueWatching } from "@/actions/stats";
import { ContinueWatching } from "@/components/continue-watching";

const MOCK_USER_ID = "mock-user-1";

export async function ContinueWatchingData() {
    const items = await getContinueWatching(MOCK_USER_ID);
    return <ContinueWatching items={items} />;
}
