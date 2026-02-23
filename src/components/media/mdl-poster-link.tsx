import { getMdlData } from "@/lib/mdl-data";
import { ExternalLink } from "lucide-react";

interface Props {
    externalId: string;
    title: string;
    year: string;
    nativeTitle?: string;
}

const LINK_CLASS =
    "absolute bottom-2 right-2 flex items-center gap-1 px-2 py-1 rounded-lg bg-black/60 backdrop-blur-sm border border-white/10 text-[11px] font-medium text-white/70 hover:text-white hover:bg-black/80 transition-colors";

// Async server component — streams in a direct MDL link once the slug is resolved.
// getMdlData uses React cache(), so this is free if MdlSection already fetched the data.
export async function MdlPosterLink({ externalId, title, year, nativeTitle }: Props) {
    const data = await getMdlData(externalId, title, year, nativeTitle);
    const href = data?.mdlSlug
        ? `https://mydramalist.com/${data.mdlSlug}`
        : `https://mydramalist.com/search?q=${encodeURIComponent(title)}`;

    return (
        <a href={href} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
            <ExternalLink className="size-3" />
            MDL
        </a>
    );
}

// Static fallback rendered immediately while MdlPosterLink is pending.
export function MdlPosterLinkFallback({ title }: { title: string }) {
    return (
        <a
            href={`https://mydramalist.com/search?q=${encodeURIComponent(title)}`}
            target="_blank"
            rel="noopener noreferrer"
            className={LINK_CLASS}
        >
            <ExternalLink className="size-3" />
            MDL
        </a>
    );
}
