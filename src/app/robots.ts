import type { MetadataRoute } from "next";

/**
 * Nothing here is worth crawling, and crawling it is not free.
 *
 * Every page but /login and /u/<id> requires an account, so a crawler gets a
 * redirect — but it pays for one first: the request still goes through the
 * middleware, which decrypts a session token on the way to deciding there
 * isn't one. That is CPU, billed, thousands of times over, for a redirect.
 * Public profiles are worse, being a real render against the database.
 *
 * A shared /u/<id> link keeps working exactly as before. This asks crawlers
 * not to go looking for them, which is a different thing from hiding them.
 */
export default function robots(): MetadataRoute.Robots {
    return {
        rules: [{ userAgent: "*", disallow: "/" }],
    };
}
