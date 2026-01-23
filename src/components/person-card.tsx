import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { UnifiedPerson } from "@/services/media.service";
import Image from "next/image";

interface PersonCardProps {
    person: UnifiedPerson;
    className?: string;
}

export function PersonCard({ person, className }: PersonCardProps) {
    return (
        <Link href={`/cast/${person.externalId}`} className={cn("group block", className)}>
            <Card className="overflow-hidden border-0 bg-transparent shadow-none transition-transform duration-300 group-hover:scale-105">
                <div className="relative aspect-[2/3] w-full overflow-hidden rounded-md bg-secondary">
                    {person.profileImage ? (
                        <Image
                            src={person.profileImage}
                            alt={person.name}
                            fill
                            className="object-cover transition-opacity duration-300 group-hover:opacity-80"
                            sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 20vw"
                        />
                    ) : (
                        <div className="flex h-full items-center justify-center text-muted-foreground">No Image</div>
                    )}
                    <div className="absolute right-2 top-2">
                        <Badge variant="secondary" className="bg-purple-500/80 text-xs text-white backdrop-blur-sm">
                            {person.knownForDepartment}
                        </Badge>
                    </div>
                </div>
                <CardContent className="p-2">
                    <h3 className="line-clamp-1 font-semibold leading-tight text-foreground transition-colors group-hover:text-primary">
                        {person.name}
                    </h3>
                    {person.knownFor.length > 0 && (
                        <p className="text-sm text-muted-foreground line-clamp-1">
                            {person.knownFor.map((work) => work.title).join(", ")}
                        </p>
                    )}
                </CardContent>
            </Card>
        </Link>
    );
}
