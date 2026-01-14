import { mediaService } from "@/services/media.service";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";

export default async function CastPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const media = await mediaService.getDetails(id);

  if (!media) {
    notFound();
  }

  return (
    <div className="container py-8 space-y-6 m-auto">
      {/* Header */}
      <div className="space-y-4">
        <Link 
          href={`/media/${id}`} 
          className="inline-flex items-center text-sm text-muted-foreground hover:text-primary transition-colors"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to {media.title}
        </Link>
        
        <div>
           <h1 className="text-3xl font-bold tracking-tight mb-2">Cast & Credits</h1>
           <div className="flex items-center gap-2 text-muted-foreground">
              <span className="font-medium text-foreground">{media.title}</span>
              <span>•</span>
              <span>{media.year}</span>
           </div>
        </div>
      </div>

      <hr className="border-border" />

      {/* Cast Grid */}
      {media.cast && media.cast.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
          {media.cast.map((actor) => (
            <div key={actor.id} className="space-y-3 group">
              <div className="relative aspect-[2/3] w-full overflow-hidden rounded-lg bg-muted shadow-sm transition-transform hover:scale-105">
                {actor.profile ? (
                  <Image 
                    src={actor.profile} 
                    alt={actor.name} 
                    fill 
                    className="object-cover" 
                  />
                ) : (
                   <div className="w-full h-full flex items-center justify-center text-sm text-muted-foreground bg-secondary">
                      No Image
                   </div>
                )}
              </div>
              <div>
                <div className="font-semibold leading-tight">{actor.name}</div>
                <div className="text-sm text-muted-foreground leading-tight mt-1">{actor.character}</div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          No cast information available.
        </div>
      )}
    </div>
  );
}
