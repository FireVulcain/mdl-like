import { useEffect, useState } from "react";

export function useDebounce<T extends (...args: any[]) => void>(callback: T, delay: number) {
    const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);

    return (...args: Parameters<T>) => {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
        const newTimeoutId = setTimeout(() => {
            callback(...args);
        }, delay);
        setTimeoutId(newTimeoutId);
    };
}
