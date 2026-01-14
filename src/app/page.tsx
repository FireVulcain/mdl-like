import { MediaCard } from "@/components/media-card";
import { mediaService } from "@/services/media.service";

export default async function Home() {
  const trending = await mediaService.getTrending();

  return (
    <div className="container py-8 space-y-8 m-auto max-w-[80%]">
      <section>
        <h2 className="text-2xl font-bold tracking-tight mb-4">Trending This Week</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {trending.map((media) => (
            <MediaCard key={media.id} media={media} />
          ))}
        </div>
      </section>
    </div>
  );
}
