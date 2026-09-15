import { cache } from "react";
import { auth } from "./auth";

/**
 * Whether the current reader is the admin: the account whose email is
 * ADMIN_EMAIL — the one seed-admin.ts creates. In SKIP_AUTH mode (dev) the
 * only reader there is counts as admin. Checked on the server wherever it
 * matters: an admin button not rendered is not the guard, the route is.
 */
export const isAdminUser = cache(async (): Promise<boolean> => {
    if (process.env.SKIP_AUTH === "true") return true;
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) return false;
    try {
        const session = await auth();
        return !!session?.user?.email && session.user.email.toLowerCase() === adminEmail.toLowerCase();
    } catch {
        return false;
    }
});
