import { kuryanaGetPersonThreads } from "@/lib/kuryana";
import { MdlThreads } from "@/components/media/mdl-threads";

/**
 * MDL comments on a person, streamed in the way the media page does it.
 *
 * The payload is identical to a drama's threads, so this reuses the same list
 * component — only the fetch path and the load-more loader differ.
 */
export async function PersonThreadsSection({ slug }: { slug: string }) {
    const result = await kuryanaGetPersonThreads(slug);
    if (!result || result.disabled || !result.comments || result.comments.length === 0) return null;

    return (
        <MdlThreads
            key={slug}
            initialComments={result.comments}
            total={result.total}
            hasMore={result.has_more}
            mdlId={slug}
            kind="person"
        />
    );
}
