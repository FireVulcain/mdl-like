"use strict";

/**
 * Episode recaps from TheReviewGeek, the second site for Korean dramas,
 * read from the reader's own browser. It writes one post per episode,
 * "<Title> – K-drama Episode 4 Recap & Review" (the last one "… Recap,
 * Review & Ending Explained"), often for dramas Dramabeans skips.
 *
 * There is no drama page or tag to start from, so the drama is found by
 * the site's own search (/?s=<title>, then /page/2/?s=…): the posts whose
 * title, before the dash, is the MDL title or one of its "also known as"
 * are the recaps, and the episode is read from the rest of the title. A
 * search also lists the season-2 news and the "upcoming K-dramas" lists —
 * titles that do not say "Episode N" are passed over.
 *
 * The text is the paragraphs of div.entry-content up to the <hr>: after it
 * comes "The Episode Review", the writer's opinion and guesses, which are
 * not the story. The ad slots between paragraphs are divs, not paragraphs.
 *
 * The site sits behind Cloudflare. The service worker fetches it first;
 * when that comes back as the challenge, the worker asks a thereviewgeek.com
 * tab to fetch instead, as for CPOPHome (see background.js and
 * tab-fetch.js), and the reader is told to open one when there is none.
 *
 * `fetchHtml(url)` is the service worker's fetch (see content.js); it
 * resolves to { ok, status, url, text }. `onProgress(read, of)` hears each
 * recap land, for the line under the checkbox.
 */
const TrackrReviewGeek = (() => {
    const RG = "https://www.thereviewgeek.com";
    const PAUSE_MS = 800;
    // How many pages of search results are read before giving up — a
    // 16-episode drama fills two, with its news around it
    const MAX_PAGES = 6;
    const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]/g, "");
    const parse = (html) => new DOMParser().parseFromString(html, "text/html");
    const pause = (ms = PAUSE_MS) => new Promise((r) => setTimeout(r, ms));

    const challenged = (res) => !!res.noTab || res.status === 403 || res.status === 503 || /<title>\s*Just a moment/i.test(res.text || "");
    const blocked = (url, res) => ({ error: res.noTab ? "TheReviewGeek turned the extension away and no thereviewgeek.com tab is open to read from — open one, pass its check, and keep it open" : `the thereviewgeek.com tab is still on its check (${res.status}) — tick the box there`, needsTab: url });

    /**
     * A recap's show and episodes from its title: "The WONDERfools – K-drama
     * Episode 4 Recap & Review" is The WONDERfools, 4–4. A title that is not
     * a recap (news, a season review, a list) is null.
     */
    function recapOf(title) {
        const m = title.match(/^(.*?)\s+[–—-]\s+(?:K-?drama\s+)?Episodes?\s+(\d+)(?:\s*(?:[-–&]|and)\s*(\d+))?\s+Recap/i);
        if (!m) return null;
        const from = +m[2];
        const to = m[3] ? +m[3] : from;
        return to >= from ? { show: m[1].trim(), from, to } : null;
    }

    const clean = (t) => t.replace(/\s+/g, " ").replace(/&amp;/g, "&").trim();

    /** The posts a search page lists: { title, url } */
    function listed(doc) {
        const out = [];
        for (const a of doc.querySelectorAll("article h2.entry-title a[href]")) out.push({ title: clean(a.textContent), url: a.href });
        return out;
    }

    /** The recap's text: the paragraphs before the <hr> that opens the review. */
    function textOf(doc) {
        const entry = doc.querySelector("div.entry-content");
        if (!entry) return "";
        const parts = [];
        for (const el of entry.children) {
            if (el.tagName === "HR") break;
            // a post without its <hr> still heads the opinion: "The Episode Review", "Verdict", "Final Thoughts"
            if (/^H[2-4]$/.test(el.tagName) && /review|verdict|thoughts/i.test(el.textContent)) break;
            if (el.tagName !== "P") continue;
            const t = el.textContent.replace(/\s+/g, " ").trim();
            if (t) parts.push(t);
        }
        return parts.join("\n\n");
    }

    /**
     * The drama's recaps by the site's search, on each title in turn until
     * one finds any. Resolves to { show, posts: [{ title, url, from, to }] }
     * or { error, seen, needsTab? }.
     */
    async function search(fetchHtml, titles) {
        const wanted = new Set(titles.map(norm).filter(Boolean));
        const seen = [];
        const queries = [...new Set(titles.filter((t) => /[a-z]/i.test(t)))].slice(0, 3);
        for (const [qi, q] of queries.entries()) {
            if (qi > 0) await pause();
            const found = new Map();
            let show = null;
            for (let page = 1; page <= MAX_PAGES; page++) {
                const url = page === 1 ? `${RG}/?s=${encodeURIComponent(q)}` : `${RG}/page/${page}/?s=${encodeURIComponent(q)}`;
                if (page > 1) await pause();
                const res = await fetchHtml(url);
                if (challenged(res)) return blocked(url, res);
                // past the last page of results the site answers 404
                if (!res.ok) {
                    if (page === 1) return { error: `TheReviewGeek ${res.status || res.error || "unreachable"}` };
                    break;
                }
                const posts = listed(parse(res.text));
                if (posts.length === 0) break;
                for (const p of posts) {
                    const r = recapOf(p.title);
                    if (r && wanted.has(norm(r.show))) {
                        show = show ?? r.show;
                        if (!found.has(p.url)) found.set(p.url, { title: `${r.show}: Episode${r.from === r.to ? ` ${r.from}` : `s ${r.from}-${r.to}`}`, url: p.url, from: r.from, to: r.to });
                    } else if (r && !seen.includes(r.show)) {
                        seen.push(r.show);
                    }
                }
                // results come newest first; once a page lists none of this
                // drama's recaps after some were found, the rest are older news
                if (found.size && !posts.some((p) => { const r = recapOf(p.title); return r && wanted.has(norm(r.show)); })) break;
            }
            if (found.size) return { show, posts: [...found.values()] };
        }
        return { error: "no recaps with that title on TheReviewGeek", seen: seen.slice(0, 8) };
    }

    /**
     * The recaps for one drama. `drama` is what the page knows: title, the
     * other titles (akas), and the hint given by hand — another title to
     * search, or any recap's URL, whose title names the show as the site
     * writes it. Resolves to { tag, listed, recaps: [{ source, title, url,
     * from, to, text }], skipped } or { error, seen?, needsTab? }.
     */
    async function recapsFor(fetchHtml, drama, onProgress) {
        let titles = [drama.title, ...(drama.akas ?? [])];
        if (drama.hint && /^https?:/.test(drama.hint)) {
            if (!/^https:\/\/(www\.)?thereviewgeek\.com\//.test(drama.hint)) return { error: "the hint is not a TheReviewGeek URL — give one of the drama's recaps there" };
            const res = await fetchHtml(drama.hint);
            if (challenged(res)) return blocked(drama.hint, res);
            if (!res.ok) return { error: `TheReviewGeek ${res.status || res.error || "unreachable"}` };
            const heading = clean(parse(res.text).querySelector("h1.entry-title")?.textContent ?? "");
            const r = recapOf(heading);
            if (!r) return { error: `"${heading || "that page"}" is not an episode recap`, seen: heading ? [heading] : undefined };
            titles = [r.show];
            await pause();
        } else if (drama.hint) {
            titles = [drama.hint, ...titles];
        }

        const found = await search(fetchHtml, titles);
        if (found.error) return found;
        // One post per range, the first found; in episode order
        const posts = [...new Map(found.posts.map((p) => [`${p.from}-${p.to}`, p])).values()].sort((a, b) => a.from - b.from || a.to - b.to);
        const episodes = drama.episodes > 0 ? drama.episodes : null;
        const wanted = posts.filter((p) => episodes === null || p.to <= episodes);
        const range = `${posts[0].from}–${posts[posts.length - 1].to}`;

        const recaps = [];
        const skipped = [];
        for (const [i, p] of wanted.entries()) {
            await pause();
            const res = await fetchHtml(p.url);
            if (challenged(res)) return blocked(p.url, res);
            onProgress?.(i + 1, wanted.length);
            if (!res.ok) {
                skipped.push({ n: p.from, why: `HTTP ${res.status || res.error || "?"}` });
                continue;
            }
            const text = textOf(parse(res.text));
            if (text.length < 200) {
                skipped.push({ n: p.from, why: text.length ? "too short" : "empty" });
                continue;
            }
            recaps.push({ source: "thereviewgeek", title: p.title, url: p.url, from: p.from, to: p.to, text });
        }
        return { tag: found.show, listed: range, recaps, skipped: skipped.length ? skipped.map((s) => `${s.n}: ${s.why}`).join(" · ") : null };
    }

    return { recapsFor };
})();
