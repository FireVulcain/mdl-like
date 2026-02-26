import { tmdb, TMDB_CONFIG, TMDBProvider } from "@/lib/tmdb";
import Image from "next/image";

// Countries to check in order of preference
const PREFERRED_COUNTRIES = ["US", "GB", "CA", "AU", "DE", "FR"];

type CountryData = {
    link: string;
    flatrate?: TMDBProvider[];
    buy?: TMDBProvider[];
    rent?: TMDBProvider[];
};

export async function WatchProvidersRow({ type, id }: { type: "movie" | "tv"; id: string }) {
    let countryData: CountryData | undefined;

    try {
        const data = await tmdb.getWatchProviders(type, id);
        const results = data.results || {};

        for (const code of PREFERRED_COUNTRIES) {
            if (results[code]) {
                countryData = results[code];
                break;
            }
        }
        if (!countryData) {
            countryData = Object.values(results)[0];
        }
    } catch {
        return null;
    }

    if (!countryData) return null;

    const streaming = countryData.flatrate || [];
    const buyRent = [...(countryData.buy || []), ...(countryData.rent || [])];
    const isStreaming = streaming.length > 0;
    const providers = isStreaming ? streaming : buyRent;

    if (providers.length === 0) return null;

    // Deduplicate by provider_id
    const seen = new Set<number>();
    const unique = providers.filter((p) => {
        if (seen.has(p.provider_id)) return false;
        seen.add(p.provider_id);
        return true;
    });

    return (
        <>
            <span className="text-gray-400 font-medium self-center">Watch</span>
            <div className="flex flex-wrap gap-1.5 items-center">
                {unique.slice(0, 6).map((p) => (
                    <a
                        key={p.provider_id}
                        href={countryData!.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={p.provider_name}
                        className="shrink-0"
                    >
                        <Image
                            unoptimized={true}
                            src={TMDB_CONFIG.w500Image(p.logo_path)}
                            alt={p.provider_name}
                            width={26}
                            height={26}
                            className="rounded-md hover:scale-110 transition-transform"
                        />
                    </a>
                ))}
                {!isStreaming && <span className="text-xs text-gray-500">Buy / Rent</span>}
            </div>
        </>
    );
}
