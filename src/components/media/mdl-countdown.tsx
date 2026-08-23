import { kuryanaGetNextEpisode, type MdlNextEpisode } from "@/lib/kuryana";
import { NextEpisodeCountdown } from "@/components/next-episode-countdown";

type CountdownProps = React.ComponentProps<typeof NextEpisodeCountdown>;
type NextEpisode = CountdownProps["nextEpisode"];

/**
 * MDL's next-episode data mapped to the countdown's shape.
 *
 * TVmaze and TMDB know the calendar date; MDL knows the exact broadcast time,
 * which is the whole reason for asking it.
 */
function toCountdownEpisode(mdlNext: MdlNextEpisode | null, season: number): NextEpisode {
    if (!mdlNext) return null;
    return {
        airDate: mdlNext.airDate,
        airDateTime: mdlNext.airDateTime,
        episodeNumber: mdlNext.episodeNumber,
        seasonNumber: season,
        name: "",
        seasonEpisodeCount: mdlNext.totalEpisodes ?? undefined,
    };
}

/**
 * The countdown, with its MDL lookup moved off the page's critical path.
 *
 * That lookup is a scrape — around 320ms — and it was awaited before the media
 * page could render a single byte, alone among the page's MDL calls in not
 * sitting behind a boundary. Everything else on the page waited for a clock.
 *
 * Rendered under Suspense with no fallback rather than one built from the
 * TVmaze date: that would show a countdown immediately and then correct it by
 * hours once MDL answered, which is worse than a countdown that arrives a
 * moment later already right. The page around it is streaming in anyway.
 */
export async function MdlCountdown({
    slug,
    season,
    fallbackEpisode,
    ...rest
}: {
    /** Null when the title has no MDL entry; the fallback is then all there is. */
    slug: string | null;
    season: number;
    fallbackEpisode: NextEpisode;
} & Omit<CountdownProps, "nextEpisode">) {
    const mdlNext = slug ? await kuryanaGetNextEpisode(slug) : null;
    const nextEpisode = toCountdownEpisode(mdlNext, season) ?? fallbackEpisode;

    // The MDL-native page only rendered this when one of the two existed; with
    // the lookup inside, that test has to live here too.
    if (!nextEpisode) return null;

    return <NextEpisodeCountdown nextEpisode={nextEpisode} {...rest} />;
}
