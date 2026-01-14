import { getWatchlist } from "@/actions/media";
import { WatchlistTable } from "@/components/watchlist-table";

// Mock User ID
const MOCK_USER_ID = "mock-user-1"; 

export default async function WatchlistPage() {
  const watchlist = await getWatchlist(MOCK_USER_ID);

  return (
    <div className="container py-8 space-y-6 m-auto max-w-[80%]">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">My Watchlist</h1>
      </div>
      
      <WatchlistTable items={watchlist} />
    </div>
  );
}
