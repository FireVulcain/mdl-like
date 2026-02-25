import { cache } from "react";
import { auth } from "./auth";

/**
 * Returns the current authenticated user's ID.
 * Wrapped with React cache() so auth() is called at most once per request.
 * In SKIP_AUTH mode (dev), returns DEV_USER_ID env var or falls back to "mock-user-1".
 */
export const getCurrentUserId = cache(async (): Promise<string> => {
    if (process.env.SKIP_AUTH === "true") {
        return process.env.DEV_USER_ID ?? "mock-user-1";
    }
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");
    return session.user.id;
});
