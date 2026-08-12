import type { Metadata } from "next";
import { getPersonDetails } from "@/actions/person";

/**
 * The page itself is a client component, so it cannot export generateMetadata.
 * A layout can, and it is the documented way out — it wraps the same route and
 * runs on the server.
 */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
    const person = await getPersonDetails((await params).id).catch(() => null);
    if (!person?.name) return { title: "Person" };
    return { title: person.name, description: person.biography?.replace(/\s+/g, " ").slice(0, 160) || undefined };
}

export default function CastLayout({ children }: { children: React.ReactNode }) {
    return children;
}
