"use client";

import Image from "next/image";

interface Props {
    src: string;
    alt: string;
}

export function MdlPersonImage({ src, alt }: Props) {
    return (
        <div className="relative aspect-2/3 w-full overflow-hidden rounded-xl shadow-2xl ring-2 ring-white/10 hover:ring-white/20 transition-all bg-[linear-gradient(to_right,rgb(31,41,55),rgb(55,65,81),rgb(31,41,55))] bg-size-[200%_100%] animate-shimmer">
            <Image
                src={src}
                alt={alt}
                fill
                unoptimized={true}
                className="object-cover opacity-0 transition-opacity duration-700 ease-out"
                priority
                onLoad={(e) => {
                    const img = e.currentTarget;
                    const container = img.parentElement;
                    setTimeout(() => {
                        img.classList.replace("opacity-0", "opacity-100");
                        container?.classList.remove(
                            "animate-shimmer",
                            "bg-[linear-gradient(to_right,rgb(31,41,55),rgb(55,65,81),rgb(31,41,55))]",
                            "bg-size-[200%_100%]"
                        );
                    }, 100);
                }}
            />
        </div>
    );
}
