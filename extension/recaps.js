"use strict";

/**
 * Episode recaps from Dramabeans, read from the reader's own browser —
 * the site's Cloudflare turns servers away and lets a browser through, and
 * its WordPress API answers from here. One drama is a tag there; its
 * recaps are the tagged posts titled "<title>: Episodes N-M". The content
 * comes back through the API, with the "related posts" tail cut off, and
 * is posted to the app, which keeps it for the chart's next run.
 *
 * `fetchJson(url)` is how the caller reaches the site — the service worker,
 * from a content script (see background.js); a fetch of its own would be
 * held to the page's CORS.
 */
const TrackrRecaps = (() => {
    const DB = "https://dramabeans.com";
    const PAUSE_MS = 400;
    const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

    // The recap's range from its title: "Episode 1 (First Impressions)", "Episodes 13-14 (Final)"
    function rangeOf(title) {
        const m = title.match(/Episodes?\s+(\d+)(?:\s*[-–]\s*(\d+))?/i);
        return m ? { from: +m[1], to: m[2] ? +m[2] : +m[1] } : null;
    }

    function textOf(html) {
        const doc = new DOMParser().parseFromString(html, "text/html");
        for (const el of doc.querySelectorAll("ul")) if (/News bites|dramabeans\.com\/cast\//.test(el.innerHTML)) el.remove();
        for (const el of doc.querySelectorAll("script, style, iframe, figure")) el.remove();
        let text = (doc.body.textContent || "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
        const cut = text.indexOf("RELATED POSTS");
        if (cut > 0) text = text.slice(0, cut).trim();
        return text;
    }

    /**
     * The recaps for one drama: by the tag whose name is the title (or the
     * name given by hand), or, given a recap's URL, by that post's tags.
     * Resolves to { tag, recaps: [{ source, title, url, from, to, text }] }
     * or { error, seen }.
     */
    async function recapsFor(fetchJson, title, hint) {
        let tag = null, seen = [];
        const wanted = hint && !/^https?:/.test(hint) ? hint : title;
        // A recap's URL given by hand: its post carries the drama's tag, and
        // the post's slug names it — "w-two-worlds-episode-1" is under the
        // tag whose slug is "w-two-worlds". Never the post's first tag: that
        // was once "first impressions", and 44 dramas' first episodes went
        // into one chart.
        if (hint && /^https?:\/\/(www\.)?dramabeans\.com\//.test(hint)) {
            const slug = new URL(hint).pathname.replace(/\/+$/, "").split("/").pop();
            const stem = slug.replace(/-episodes?-\d+.*$/, "");
            const posts = await fetchJson(`${DB}/wp-json/wp/v2/posts?slug=${encodeURIComponent(slug)}&_fields=id,tags`);
            const ids = posts.ok && posts.data?.[0]?.tags ? posts.data[0].tags : [];
            const tags = [];
            for (const id of ids) {
                const t = await fetchJson(`${DB}/wp-json/wp/v2/tags/${id}?_fields=id,name,slug,count`);
                if (t.ok && t.data) tags.push(t.data);
            }
            tag = tags.find((t) => t.slug === stem) ?? tags.find((t) => norm(t.name) === norm(title)) ?? tags.find((t) => stem.startsWith(t.slug + "-") || t.slug.startsWith(stem)) ?? null;
            seen = tags.map((t) => t.name);
            if (!tag) return { error: `no tag for "${stem}" on that post`, seen };
        }
        if (!tag) {
            const res = await fetchJson(`${DB}/wp-json/wp/v2/tags?search=${encodeURIComponent(wanted)}&per_page=20&_fields=id,name,count`);
            if (!res.ok) return { error: `dramabeans ${res.status || res.error || "unreachable"}` };
            const tags = Array.isArray(res.data) ? res.data : [];
            seen = seen.concat(tags.map((t) => t.name));
            tag = tags.find((t) => norm(t.name) === norm(wanted)) ?? tags.find((t) => norm(t.name) === norm(title)) ?? null;
        }
        if (!tag) return { error: "no tag with that title", seen: [...new Set(seen)] };

        const list = await fetchJson(`${DB}/wp-json/wp/v2/posts?tags=${tag.id}&per_page=100&_fields=id,title,slug,link,date`);
        if (!list.ok) return { error: `dramabeans ${list.status}` };
        const posts = (list.data || []).map((p) => ({ ...p, plain: (p.title?.rendered || "").replace(/&#8217;|&rsquo;/g, "’").replace(/&amp;/g, "&") })).filter((p) => rangeOf(p.plain));
        if (posts.length === 0) return { error: `tag "${tag.name}" has no episode recaps`, seen: [tag.name] };
        // One drama's recaps share the title before the colon; a tag that
        // mixes several is a generic one, not the drama's
        const shows = [...new Set(posts.map((p) => norm(p.plain.split(/:\s*Episode/i)[0])))];
        if (shows.length > 1) return { error: `tag "${tag.name}" mixes ${shows.length} dramas' recaps — give the drama's own tag or a recap's URL`, seen: [tag.name] };
        posts.sort((a, b) => rangeOf(a.plain).from - rangeOf(b.plain).from);

        const recaps = [];
        for (const p of posts) {
            const one = await fetchJson(`${DB}/wp-json/wp/v2/posts/${p.id}?_fields=content`);
            if (!one.ok || !one.data?.content?.rendered) continue;
            const { from, to } = rangeOf(p.plain);
            const text = textOf(one.data.content.rendered);
            if (text.length < 200) continue;
            recaps.push({ source: "dramabeans", title: p.plain, url: p.link, from, to, text });
            await new Promise((r) => setTimeout(r, PAUSE_MS));
        }
        return { tag: tag.name, recaps };
    }

    return { recapsFor };
})();
