import { mediaService } from "@/services/media.service";
import { TrendingSection } from "@/components/trending-section";

export async function TrendingData() {
    const trending = await mediaService.getTrending();
    return <TrendingSection items={trending} />;
}
