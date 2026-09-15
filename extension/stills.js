"use strict";

/**
 * Character stills from asianwiki, fetched from here — the reader's own
 * browser — because asianwiki's Cloudflare turns every server away and lets
 * a browser through. One click walks every Korean chart the app has, finds
 * its asianwiki page by search, reads the cast tables (a row of photos, a
 * row of actors, a row of characters) and posts them to the app, which
 * matches actors to the chart's people and keeps the photos as stills.
 */
const AW = "https://asianwiki.com";
const PAUSE_MS = 1000;

const norm = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\(.*?\)/g, "").replace(/[^a-z0-9]/g, "");

// api.php answers 500 on asianwiki, so this is the search page a reader
// uses. MediaWiki redirects straight to the article on an exact title match;
// otherwise it lists results. Only exact titles are taken — a near miss
// lands on an actor's page, and their photos on the wrong faces — ranked
// with the year first, then "(Korean Drama)": "W" alone is a Thai film there,
// "W (Korean Drama)" is the one.
async function searchPages(title, year, listOnly = false) {
    // fulltext=1 asks for the result list even when a title matches exactly —
    // "18 Again" lands on a 2009 film, and the drama is one line down the list.
    const res = await fetch(`${AW}/index.php?search=${encodeURIComponent(title)}&fulltext=${listOnly ? 1 : 0}`, { credentials: "omit" });
    if (!res.ok) return { error: `search HTTP ${res.status}` };
    const html = await res.text();
    if (!/index\.php/.test(res.url)) {
        const landed = decodeURIComponent(new URL(res.url).pathname.slice(1)).replace(/_/g, " ");
        return { pages: [landed], html, seen: [landed], landed: true };
    }
    const doc = new DOMParser().parseFromString(html, "text/html");
    const names = [...new Set([...doc.querySelectorAll(".mw-search-result-heading a, .mw-search-results a")]
        .map((a) => a.getAttribute("title") || a.textContent.trim())
        .filter(Boolean))];
    const rank = (n) => (year && n.includes(String(year)) ? 0 : /Korean Drama/i.test(n) ? 1 : 2);
    const pages = names.filter((n) => norm(n) === norm(title)).sort((a, b) => rank(a) - rank(b));
    return { pages, seen: names };
}

// A season carries its number the way MDL writes it — "Alchemy of Souls
// Part 2: Light and Shadow" — while asianwiki names the page by the
// subtitle, or "Season 2", or "2". Each spelling is tried in turn.
function titleVariants(title, given) {
    const out = given ? [given, title] : [title];
    const m = title.match(/^(.*?)\s*(?:Part|Season)\s*(\d+)\s*:?\s*(.*)$/i);
    if (m) {
        const [, base, n, sub] = m;
        if (sub) out.push(`${base}: ${sub}`, `${base} ${sub}`);
        out.push(`${base} Season ${n}`, `${base} ${n}`, `${base} Part ${n}`);
    }
    return [...new Set(out.map((t) => t.trim()))];
}

async function fetchPage(page) {
    const res = await fetch(`${AW}/${encodeURIComponent(page.replace(/ /g, "_"))}`, { credentials: "omit" });
    if (!res.ok) return { error: `HTTP ${res.status}` };
    return { html: await res.text() };
}

// Cast tables: a row of photos, a row of actor links, a row of characters.
// The actor row must be links to pages — that is what tells a cast table
// from any other three rows with pictures. An older page writes the actors
// as plain text; when the strict read finds nothing, a lenient one takes
// the cell's text instead.
function castRows(html) {
    const strict = readCastRows(html, true);
    return strict.length ? strict : readCastRows(html, false);
}

function readCastRows(html, strict) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const rows = [];
    for (const table of doc.querySelectorAll("table")) {
        const trs = [...table.querySelectorAll("tr")].filter((tr) => tr.querySelector("td"));
        for (let i = 0; i + 2 < trs.length; i++) {
            const cells = [...trs[i].querySelectorAll("td")];
            const imgs = cells.map((td) => td.querySelector("img"));
            if (!imgs.some(Boolean)) continue;
            const actors = [...trs[i + 1].querySelectorAll("td")].map((td) => (strict ? td.querySelector("a")?.textContent.trim() : td.textContent.trim()) ?? "");
            const chars = [...trs[i + 2].querySelectorAll("td")].map((td) => td.textContent.trim());
            if (!actors.some(Boolean)) continue;
            imgs.forEach((img, k) => {
                if (img && actors[k]) rows.push({ actor: actors[k], character: chars[k] ?? "", image: new URL(img.getAttribute("src"), AW).href });
            });
            i += 2;
        }
    }
    return rows;
}

async function runStills(appUrl, redo, report) {
    const list = await fetch(`${appUrl}/api/ext/character-maps`, { credentials: "include" });
    if (!list.ok) {
        report(`app: HTTP ${list.status} — logged in to ${appUrl}?`);
        return;
    }
    const { charts } = await list.json();
    const todo = charts.filter((c) => redo || c.withStill === 0);
    report(`${todo.length} chart${todo.length === 1 ? "" : "s"} to do (${charts.length - todo.length} already have stills)`);

    for (const c of todo) {
        const line = report(`${c.title}: searching…`);
        try {
            let posted = false, seen = [], lastError = null;
            for (const variant of titleVariants(c.title, c.asianwiki)) {
                let found = await searchPages(variant, c.year);
                if (found.error) { lastError = found.error; continue; }
                // Landed straight on a page with no cast table: ask for the list instead
                if (found.landed && castRows(found.html).length === 0) {
                    const listed = await searchPages(variant, c.year, true);
                    if (!listed.error && listed.pages.length) found = { ...listed, pages: listed.pages.filter((p) => p !== found.pages[0]) };
                }
                seen = seen.concat(found.seen);
                for (const page of found.pages) {
                    const html = found.html && found.pages[0] === page ? found.html : (await fetchPage(page)).html;
                    if (!html) { lastError = `${page}: could not load`; continue; }
                    const rows = castRows(html);
                    if (rows.length === 0) { lastError = `${page}: no cast table`; continue; }
                    const res = await fetch(`${appUrl}/api/ext/character-maps/stills`, {
                        method: "POST",
                        credentials: "include",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ mdlSlug: c.mdlSlug, page, rows }),
                    });
                    const out = await res.json();
                    if (!res.ok) { lastError = `app ${res.status} ${out.error ?? ""}`; continue; }
                    // Missing faces with no unused rows: the page has no photo for
                    // them. Missing faces beside unused rows: a name the fold missed.
                    line(`${c.title} → ${page}: ${out.matched}/${out.people} faces from ${rows.length} photos${out.unmatched.length ? ` — missing ${out.unmatched.join(", ")}` : ""}${out.unused.length ? ` — unused ${out.unused.join(", ")}` : ""}`);
                    posted = true;
                    break;
                }
                if (posted) break;
            }
            if (!posted) line(`${c.title}: ${lastError ?? "no exact title"}${seen.length ? ` (search saw: ${[...new Set(seen)].slice(0, 4).join(" · ")})` : ""}`);
        } catch (e) {
            line(`${c.title}: failed — ${e.message}`);
        }
        await new Promise((r) => setTimeout(r, PAUSE_MS));
    }
    report("done");
}

document.getElementById("btn-stills").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    const out = document.getElementById("stills-out");
    // Its own field, not the calendar's App URL: the run writes the JSON
    // files, which only the dev server on this machine can do.
    const appUrl = (document.getElementById("stills-app").value.trim() || "http://localhost:3000").replace(/\/$/, "");
    const redo = document.getElementById("stills-redo").checked;
    out.innerHTML = "";
    btn.disabled = true;
    const report = (text) => {
        const div = document.createElement("div");
        div.textContent = text;
        out.appendChild(div);
        out.scrollTop = out.scrollHeight;
        return (t) => { div.textContent = t; };
    };
    try {
        await runStills(appUrl, redo, report);
    } catch (err) {
        report(`failed — ${err.message}`);
    } finally {
        btn.disabled = false;
    }
});
