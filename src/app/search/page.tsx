import { redirect } from 'next/navigation';
import { MediaCard } from "@/components/media-card";
import { mediaService } from "@/services/media.service";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q: query } = await searchParams;

  if (!query) {
    redirect('/');
  }

  const results = await mediaService.search(query);

  return (
    <div className="container py-8 space-y-6 m-auto max-w-[80%]">
      <h1 className="text-2xl font-bold">Results for "{query}"</h1>
      {results.length === 0 ? (
        <p className="text-muted-foreground">No results found.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {results.map((media) => (
            <MediaCard key={media.id} media={media} />
          ))}
        </div>
      )}
    </div>
  );
}
