import Link from 'next/link';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { UnifiedMedia } from "@/services/media.service";
import Image from "next/image";

interface MediaCardProps {
  media: UnifiedMedia;
  className?: string;
}

export function MediaCard({ media, className }: MediaCardProps) {
  return (
    <Link href={`/media/${media.id}`} className={cn("group block", className)}>
      <Card className="overflow-hidden border-0 bg-transparent shadow-none transition-transform duration-300 group-hover:scale-105">
        <div className="relative aspect-[2/3] w-full overflow-hidden rounded-md bg-secondary">
          {media.poster ? (
            <Image
              src={media.poster}
              alt={media.title}
              fill
              className="object-cover transition-opacity duration-300 group-hover:opacity-80"
              sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 20vw"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              No Image
            </div>
          )}
          <div className="absolute right-2 top-2">
            <Badge variant="secondary" className="bg-black/60 font-mono text-xs text-white backdrop-blur-sm">
              {media.originCountry}
            </Badge>
          </div>
          {media.rating > 0 && (
            <div className="absolute left-2 top-2">
              <Badge variant="default" className="bg-yellow-500/90 text-black hover:bg-yellow-500">
                {media.rating.toFixed(1)}
              </Badge>
            </div>
          )}
        </div>
        <CardContent className="p-2">
          <h3 className="line-clamp-1 font-semibold leading-tight text-foreground transition-colors group-hover:text-primary">
            {media.title}
          </h3>
          <p className="text-sm text-muted-foreground">
            {media.year} • {media.type}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
