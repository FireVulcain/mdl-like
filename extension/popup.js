"use strict";

// ── Config ───────────────────────────────────────────────────────────────────
const KURYANA     = "https://mdl-scrapper-jade.vercel.app";
const CACHE_KEY   = "drama_calendar_v2";

const COUNTRY_CODES = { korean: "KR", chinese: "CN", japanese: "JP", thai: "TH" };
const COUNTRY_FLAGS = { KR: "🇰🇷", CN: "🇨🇳", JP: "🇯🇵", TH: "🇹🇭", TW: "🇹🇼", US: "🇺🇸" };

// ── State ────────────────────────────────────────────────────────────────────
let allShows      = [];
let loading       = false;
let isPersonal    = false;
let filterStatus  = "Watching"; // "all" | "Watching" | "Plan to Watch"

let settings = {
  appUrl: "",
  countries: ["korean", "chinese"],
  showsPerCountry: 8,
};

// ── Helpers ──────────────────────────────────────────────────────────────────
function todayStr() {
  const d = new Date();
  return fmt(d.getFullYear(), d.getMonth() + 1, d.getDate());
}
function fmt(y, m, d) {
  return `${y}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
}
function kstDateStr(unixSeconds) {
  const kst = new Date(unixSeconds * 1000 + 9 * 3600 * 1000);
  return fmt(kst.getUTCFullYear(), kst.getUTCMonth() + 1, kst.getUTCDate());
}
function dateSectionLabel(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const today = todayStr();
  const tom = new Date(); tom.setDate(tom.getDate() + 1);
  const tomorrowStr = fmt(tom.getFullYear(), tom.getMonth() + 1, tom.getDate());
  const monthDay = dt.toLocaleDateString("en-US", { month: "long", day: "numeric" });
  if (dateStr === today) return `Today · ${monthDay}`;
  if (dateStr === tomorrowStr) return `Tomorrow · ${monthDay}`;
  return dt.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

// ── Settings ─────────────────────────────────────────────────────────────────
async function loadSettings() {
  const stored = await chrome.storage.local.get("settings");
  if (stored.settings) settings = { ...settings, ...stored.settings };
  console.log("[Drama Calendar] Loaded settings:", settings);

  document.getElementById("app-url").value = settings.appUrl || "";
  document.getElementById("shows-per-country").value = settings.showsPerCountry;
  document.querySelectorAll(".country-toggle input").forEach(cb => {
    const on = settings.countries.includes(cb.dataset.country);
    cb.checked = on;
    cb.closest(".country-toggle").classList.toggle("active", on);
  });
}

async function saveSettings() {
  const appUrl = document.getElementById("app-url").value.trim().replace(/\/$/, "");
  const countries = [...document.querySelectorAll(".country-toggle input:checked")].map(cb => cb.dataset.country);
  const showsPerCountry = parseInt(document.getElementById("shows-per-country").value);
  settings = { appUrl, countries: countries.length ? countries : ["korean"], showsPerCountry };
  await chrome.storage.local.set({ settings });
  await chrome.storage.local.remove(CACHE_KEY);
  document.getElementById("settings-panel").classList.add("hidden");
  await initData(true);
}

// ── Personal API ──────────────────────────────────────────────────────────────
// Calls /api/ext/schedule on the user's app with their session cookie.
// Returns ScheduleEntry[] or null if not authenticated / URL not set.
async function fetchPersonalSchedule() {
  if (!settings.appUrl) {
    console.log("[Drama Calendar] No app URL configured — skipping personal fetch");
    return null;
  }
  const url = `${settings.appUrl}/api/ext/schedule`;
  console.log("[Drama Calendar] Fetching personal schedule from:", url);
  try {
    const res = await fetch(url, {
      credentials: "include",
      headers: { "Accept": "application/json" },
    });
    console.log("[Drama Calendar] Response status:", res.status, res.statusText);
    console.log("[Drama Calendar] Response headers:", Object.fromEntries(res.headers.entries()));
    if (!res.ok) {
      console.warn("[Drama Calendar] Non-OK response — falling back to Kuryana. Status:", res.status);
      return null;
    }
    const entries = await res.json(); // ScheduleEntry[]
    console.log("[Drama Calendar] Personal entries received:", entries.length, entries.slice(0, 3));
    if (!Array.isArray(entries) || entries.length === 0) {
      console.warn("[Drama Calendar] Empty or non-array response — falling back to Kuryana");
      return null;
    }

    // Keep every episode as its own calendar event (same as the app calendar).
    // Each entry has its own airDate so the calendar places dots correctly.
    const result = entries.map(ep => ({
      title:   ep.title,
      poster:  ep.poster,
      slug:    ep.mediaId,
      country: ep.originCountry || "",
      rating:  0,
      airDate: ep.airDate,
      airTs:   new Date(ep.airDate).getTime() / 1000,
      ep:      ep.episodeNumber,
      totalEp: 0,
      epName:  ep.episodeName || "",
      season:  ep.seasonNumber,
      status:  ep.status || "",
    })).sort((a, b) => a.airTs - b.airTs);

    console.log("[Drama Calendar] Personal entries mapped:", result.length,
      "date range:", result[0]?.airDate, "→", result[result.length - 1]?.airDate);
    return result;
  } catch (err) {
    console.error("[Drama Calendar] fetchPersonalSchedule threw:", err);
    return null;
  }
}

// ── Kuryana fallback ──────────────────────────────────────────────────────────
async function fetchKuryanaShows() {
  const tops = await Promise.all(
    settings.countries.map(c =>
      fetch(`${KURYANA}/top/${c}?status=ongoing`)
        .then(r => r.ok ? r.json() : null)
        .catch(() => null)
    )
  );

  const items = [];
  tops.forEach((top, i) => {
    if (!top?.data?.shows) return;
    const code = COUNTRY_CODES[settings.countries[i]];
    top.data.shows.slice(0, settings.showsPerCountry).forEach(show => {
      items.push({ slug: show.url.replace(/^\//, ""), country: code, title: show.title, poster: show.img, rating: show.rating || 0 });
    });
  });

  const shows = [];
  const BATCH = 5;
  for (let i = 0; i < items.length; i += BATCH) {
    const batch = items.slice(i, i + BATCH);
    const details = await Promise.all(
      batch.map(s => fetch(`${KURYANA}/id/${s.slug}`).then(r => r.ok ? r.json() : null).catch(() => null))
    );
    batch.forEach((s, j) => {
      const d   = details[j]?.data;
      const nea = d?.next_episode_airing;
      if (!nea?.released_at) return;
      const airTs = parseInt(nea.released_at);
      if (isNaN(airTs)) return;
      shows.push({
        title:   (d?.title || s.title).replace(/\s*\(\d{4}\)\s*$/, ""),
        poster:  d?.poster || s.poster || null,
        slug:    s.slug,
        country: s.country,
        rating:  typeof d?.rating === "number" ? d.rating : parseFloat(String(d?.rating ?? "0")) || 0,
        airDate: kstDateStr(airTs),
        airTs,
        ep:      parseInt(nea.episode_number) || 1,
        totalEp: parseInt(nea.episodes) || 0,
        epName:  "",
        season:  1,
      });
    });
  }
  return shows.sort((a, b) => a.airTs - b.airTs);
}

async function getShows(forceRefresh = false) {
  if (!forceRefresh) {
    const stored = await chrome.storage.local.get(CACHE_KEY);
    const cache  = stored[CACHE_KEY];
    if (cache?.shows?.length) {
      isPersonal = cache.isPersonal;
      return cache.shows;
    }
  }

  const personal = await fetchPersonalSchedule();
  if (personal) {
    isPersonal = true;
    await chrome.storage.local.set({ [CACHE_KEY]: { shows: personal, isPersonal: true } });
    return personal;
  }

  isPersonal = false;
  const shows = await fetchKuryanaShows();
  await chrome.storage.local.set({ [CACHE_KEY]: { shows, isPersonal: false } });
  return shows;
}

// ── Render: Feed ─────────────────────────────────────────────────────────────
function renderFeed() {
  const feed = document.getElementById("agenda-feed");
  const today = todayStr();

  const upcoming = allShows
    .filter(s => s.airDate >= today)
    .filter(s => !isPersonal || filterStatus === "all" || s.status === filterStatus)
    .sort((a, b) => a.airDate.localeCompare(b.airDate) || a.ep - b.ep);

  if (!upcoming.length) {
    feed.innerHTML = `
      <div class="empty-state">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.3">
          <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        <p>No upcoming episodes found</p>
      </div>`;
    return;
  }

  // Group by date → then by show+season within each date
  const byDate = new Map();
  upcoming.forEach(ep => {
    if (!byDate.has(ep.airDate)) byDate.set(ep.airDate, new Map());
    const key = `${ep.slug}::${ep.season ?? 1}`;
    const day = byDate.get(ep.airDate);
    if (!day.has(key)) day.set(key, { ...ep, eps: [ep.ep] });
    else day.get(key).eps.push(ep.ep);
  });

  feed.innerHTML = "";
  let total = 0;

  byDate.forEach((dayMap, dateStr) => {
    const section = document.createElement("div");
    section.className = "feed-section";
    if (dateStr === today) section.id = "today-section";

    const hdr = document.createElement("div");
    hdr.className = "feed-date-header" + (dateStr === today ? " is-today" : "");
    hdr.textContent = dateSectionLabel(dateStr);
    section.appendChild(hdr);

    dayMap.forEach(s => {
      s.eps.sort((a, b) => a - b);
      total++;

      let epLabel;
      if (!isPersonal) {
        epLabel = s.totalEp ? `EP ${s.eps[0]}/${s.totalEp}` : `EP ${s.eps[0]}`;
      } else if (s.eps.length === 1) {
        epLabel = `S${String(s.season || 1).padStart(2,"0")}E${String(s.eps[0]).padStart(2,"0")}`;
      } else {
        const sn = `S${String(s.season || 1).padStart(2,"0")}`;
        epLabel = `${sn}E${String(s.eps[0]).padStart(2,"0")}–E${String(s.eps[s.eps.length-1]).padStart(2,"0")}`;
      }

      const flag = COUNTRY_FLAGS[s.country] || "";
      const ratingTxt = !isPersonal && s.rating > 0 ? `★ ${s.rating.toFixed(1)}` : "";
      const epName = s.eps.length === 1 && s.epName ? `<span class="ep-name">${s.epName}</span>` : "";

      const card = document.createElement("div");
      card.className = "show-card";
      card.innerHTML = `
        ${s.poster
          ? `<img class="show-poster" src="${s.poster}" alt="" loading="lazy" />`
          : `<div class="show-poster-placeholder">${s.title.slice(0,2).toUpperCase()}</div>`}
        <div class="show-info">
          <div class="show-title" title="${s.title}">${s.title}</div>
          <div class="show-meta">
            <span class="show-ep">${epLabel}</span>
            ${flag ? `<span class="show-country">${flag}</span>` : ""}
            ${epName}
            ${ratingTxt ? `<span class="show-rating">${ratingTxt}</span>` : ""}
          </div>
        </div>
        ${isPersonal ? `<button class="check-btn" title="Mark as watched">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </button>` : ""}`;

      // Open show page on card click
      if (isPersonal && settings.appUrl) {
        card.style.cursor = "pointer";
        card.addEventListener("click", () => {
          chrome.tabs.create({ url: `${settings.appUrl}/media/${s.slug}` });
        });
      }

      // Mark as watched
      const checkBtn = card.querySelector(".check-btn");
      if (checkBtn) {
        checkBtn.addEventListener("click", async (e) => {
          e.stopPropagation();
          const episode = s.eps[s.eps.length - 1];
          checkBtn.disabled = true;
          try {
            const res = await fetch(`${settings.appUrl}/api/ext/progress`, {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ mediaId: s.slug, episode }),
            });
            if (res.ok) {
              checkBtn.classList.add("check-btn--done");
              checkBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
            } else {
              checkBtn.disabled = false;
            }
          } catch {
            checkBtn.disabled = false;
          }
        });
      }

      section.appendChild(card);
    });

    feed.appendChild(section);
  });

  const src = isPersonal ? "Your watchlist" : "Trending";
  setFooter(`${total} upcoming episode${total !== 1 ? "s" : ""} · ${src}`);

}

// ── Footer / mode badge ───────────────────────────────────────────────────────
function setFooter(text) {
  document.getElementById("footer-text").textContent = text;
}

// ── Init ──────────────────────────────────────────────────────────────────────
async function initData(forceRefresh = false) {
  if (loading) return;
  loading = true;
  document.getElementById("btn-refresh").classList.add("spinning");
  setFooter("Fetching schedule…");

  try {
    allShows = await getShows(forceRefresh);
    document.getElementById("filter-bar").classList.toggle("hidden", !isPersonal);
    renderFeed();
  } catch (err) {
    setFooter("Failed to load — check connection");
    document.getElementById("agenda-feed").innerHTML =
      `<div class="error-state">⚠ ${err.message}</div>`;
  } finally {
    loading = false;
    document.getElementById("btn-refresh").classList.remove("spinning");
  }
}

// ── Events ────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  await loadSettings();

  document.getElementById("btn-today").addEventListener("click", () => {
    const el = document.getElementById("today-section");
    if (el) el.scrollIntoView({ block: "start", behavior: "smooth" });
  });

  document.querySelectorAll(".filter-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      filterStatus = btn.dataset.filter;
      document.querySelectorAll(".filter-btn").forEach(b => b.classList.toggle("active", b === btn));
      renderFeed();
    });
  });

  document.getElementById("btn-refresh").addEventListener("click", () => initData(true));

  document.getElementById("btn-settings").addEventListener("click", () => {
    document.getElementById("settings-panel").classList.toggle("hidden");
  });
  document.getElementById("btn-save-settings").addEventListener("click", saveSettings);

  document.querySelectorAll(".country-toggle input").forEach(cb => {
    cb.addEventListener("change", () => cb.closest(".country-toggle").classList.toggle("active", cb.checked));
  });

  await initData();
});
