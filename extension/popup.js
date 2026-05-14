"use strict";

// ── Config ───────────────────────────────────────────────────────────────────
const KURYANA     = "https://mdl-scrapper-jade.vercel.app";
const CACHE_KEY   = "drama_calendar_v2";
const CACHE_TTL   = 60 * 60 * 1000; // 1 hour

const COUNTRY_CODES = { korean: "KR", chinese: "CN", japanese: "JP", thai: "TH" };
const COUNTRY_FLAGS = { KR: "🇰🇷", CN: "🇨🇳", JP: "🇯🇵", TH: "🇹🇭", TW: "🇹🇼", US: "🇺🇸" };
const MONTH_NAMES   = ["January","February","March","April","May","June","July","August","September","October","November","December"];

// ── State ────────────────────────────────────────────────────────────────────
let allShows     = [];
let selectedDate = todayStr();
let calYear      = new Date().getFullYear();
let calMonth     = new Date().getMonth();
let loading      = false;
let isPersonal   = false; // true when data came from the user's app

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
function formatDayLabel(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}
function kstDateStr(unixSeconds) {
  const kst = new Date(unixSeconds * 1000 + 9 * 3600 * 1000);
  return fmt(kst.getUTCFullYear(), kst.getUTCMonth() + 1, kst.getUTCDate());
}
function thisMonthCount() {
  const prefix = `${calYear}-${String(calMonth + 1).padStart(2,"0")}`;
  return allShows.filter(s => s.airDate.startsWith(prefix)).length;
}
function updateFooterCount() {
  const n = thisMonthCount();
  const src = isPersonal ? "Your watchlist" : "Trending";
  setFooter(n > 0 ? `${n} episode${n !== 1 ? "s" : ""} in ${MONTH_NAMES[calMonth]} · ${src}` : `Nothing in ${MONTH_NAMES[calMonth]} · ${src}`);
}

// ── Settings ─────────────────────────────────────────────────────────────────
async function loadSettings() {
  const stored = await chrome.storage.local.get("settings");
  if (stored.settings) settings = { ...settings, ...stored.settings };

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
  if (!settings.appUrl) return null;
  try {
    const res = await fetch(`${settings.appUrl}/api/ext/schedule`, {
      credentials: "include",
      headers: { "Accept": "application/json" },
    });
    if (!res.ok) return null; // 401 = not logged in, etc.
    const entries = await res.json(); // ScheduleEntry[]
    if (!Array.isArray(entries) || entries.length === 0) return null;

    // Convert ScheduleEntry to our internal show format
    // Group by mediaId — one "show" per mediaId with its next upcoming air date
    const byMedia = new Map();
    for (const ep of entries) {
      if (!byMedia.has(ep.mediaId)) {
        byMedia.set(ep.mediaId, {
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
        });
      }
    }
    return [...byMedia.values()].sort((a, b) => a.airTs - b.airTs);
  } catch {
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
    if (cache && Date.now() - cache.ts < CACHE_TTL) {
      isPersonal = cache.isPersonal;
      return cache.shows;
    }
  }

  // Try personal schedule first
  const personal = await fetchPersonalSchedule();
  if (personal) {
    isPersonal = true;
    await chrome.storage.local.set({ [CACHE_KEY]: { shows: personal, ts: Date.now(), isPersonal: true } });
    return personal;
  }

  // Fall back to Kuryana public data
  isPersonal = false;
  const shows = await fetchKuryanaShows();
  await chrome.storage.local.set({ [CACHE_KEY]: { shows, ts: Date.now(), isPersonal: false } });
  return shows;
}

// ── Render: Calendar ──────────────────────────────────────────────────────────
function renderCalendar() {
  document.getElementById("month-label").textContent = `${MONTH_NAMES[calMonth]} ${calYear}`;

  const today  = todayStr();
  const first  = new Date(calYear, calMonth, 1);
  const daysIn = new Date(calYear, calMonth + 1, 0).getDate();
  const offset = (first.getDay() + 6) % 7;
  const prevDays = new Date(calYear, calMonth, 0).getDate();

  const dotMap = {};
  allShows.forEach(s => {
    if (!dotMap[s.airDate]) dotMap[s.airDate] = [];
    dotMap[s.airDate].push(s.country);
  });

  const cells = [];
  for (let i = offset - 1; i >= 0; i--) {
    const mo = calMonth === 0 ? 11 : calMonth - 1;
    const yr = calMonth === 0 ? calYear - 1 : calYear;
    cells.push({ d: prevDays - i, m: mo, y: yr, cur: false });
  }
  for (let d = 1; d <= daysIn; d++) cells.push({ d, m: calMonth, y: calYear, cur: true });
  const trail = (7 - (cells.length % 7)) % 7;
  for (let d = 1; d <= trail; d++) {
    const mo = calMonth === 11 ? 0 : calMonth + 1;
    const yr = calMonth === 11 ? calYear + 1 : calYear;
    cells.push({ d, m: mo, y: yr, cur: false });
  }

  const container = document.getElementById("calendar-cells");
  container.innerHTML = "";

  cells.forEach((cell, i) => {
    const dateStr  = fmt(cell.y, cell.m + 1, cell.d);
    const isToday    = dateStr === today;
    const isSelected = dateStr === selectedDate;
    const isPast     = dateStr < today;
    const colIdx     = i % 7;
    const isWeekend  = colIdx === 5 || colIdx === 6;

    const div = document.createElement("div");
    div.className = ["cal-cell",
      !cell.cur ? "other-month" : "",
      isPast && !isToday ? "past" : "",
      isToday    ? "today" : "",
      isSelected ? "selected" : "",
      isWeekend  ? "weekend" : "",
    ].filter(Boolean).join(" ");

    const num = document.createElement("div");
    num.className = "cal-day-num";
    num.textContent = cell.d;
    div.appendChild(num);

    const dots = dotMap[dateStr];
    if (dots?.length && cell.cur) {
      const dotRow = document.createElement("div");
      dotRow.className = "cal-dots";
      dots.slice(0, 6).forEach(code => {
        const dot = document.createElement("div");
        dot.className = `cal-dot dot-${code || "default"}`;
        dotRow.appendChild(dot);
      });
      if (dots.length > 6) {
        const more = document.createElement("div");
        more.className = "cal-dot dot-default";
        dotRow.appendChild(more);
      }
      div.appendChild(dotRow);
    }

    if (cell.cur) {
      div.addEventListener("click", () => {
        selectedDate = dateStr;
        renderCalendar();
        renderAgenda();
      });
    }
    container.appendChild(div);
  });
}

// ── Render: Agenda ────────────────────────────────────────────────────────────
function renderAgenda() {
  const dayShows = allShows.filter(s => s.airDate === selectedDate);
  document.getElementById("agenda-header").textContent =
    selectedDate ? formatDayLabel(selectedDate) : "Select a day";

  const list = document.getElementById("agenda-list");

  if (!dayShows.length) {
    list.innerHTML = `
      <div class="empty-state">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.25">
          <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        <p>No shows airing this day</p>
      </div>`;
    return;
  }

  list.innerHTML = "";
  dayShows.forEach(s => {
    const epLabel  = isPersonal
      ? `S${String(s.season || 1).padStart(2,"0")}E${String(s.ep).padStart(2,"0")}`
      : (s.totalEp ? `EP ${s.ep}/${s.totalEp}` : `EP ${s.ep}`);
    const flag     = COUNTRY_FLAGS[s.country] || "";
    const ratingTxt = !isPersonal && s.rating > 0 ? `★ ${s.rating.toFixed(1)}` : "";
    const epName   = s.epName ? `<span class="ep-name">${s.epName}</span>` : "";

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
      </div>`;
    list.appendChild(card);
  });
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
    renderCalendar();
    renderAgenda();
    updateFooterCount();
  } catch (err) {
    setFooter("Failed to load — check connection");
    document.getElementById("agenda-list").innerHTML =
      `<div class="error-state">⚠ ${err.message}</div>`;
  } finally {
    loading = false;
    document.getElementById("btn-refresh").classList.remove("spinning");
  }
}

// ── Events ────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  await loadSettings();
  renderCalendar();

  document.getElementById("btn-prev").addEventListener("click", () => {
    if (calMonth === 0) { calYear--; calMonth = 11; } else calMonth--;
    renderCalendar(); renderAgenda(); updateFooterCount();
  });
  document.getElementById("btn-next").addEventListener("click", () => {
    if (calMonth === 11) { calYear++; calMonth = 0; } else calMonth++;
    renderCalendar(); renderAgenda(); updateFooterCount();
  });
  document.getElementById("btn-today").addEventListener("click", () => {
    const now = new Date();
    calYear = now.getFullYear(); calMonth = now.getMonth(); selectedDate = todayStr();
    renderCalendar(); renderAgenda(); updateFooterCount();
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
