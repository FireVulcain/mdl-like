"use strict";

// ── Config ──────────────────────────────────────────────────────────────────
const KURYANA = "https://mdl-scrapper-jade.vercel.app";
const CACHE_KEY = "drama_calendar_v1";
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

const COUNTRY_LABELS = { korean: "🇰🇷 Korean", chinese: "🇨🇳 Chinese", japanese: "🇯🇵 Japanese", thai: "🇹🇭 Thai" };
const COUNTRY_CODES  = { korean: "KR", chinese: "CN", japanese: "JP", thai: "TH" };
const COUNTRY_FLAGS  = { KR: "🇰🇷", CN: "🇨🇳", JP: "🇯🇵", TH: "🇹🇭", TW: "🇹🇼" };
const MONTH_NAMES    = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAY_MS         = 86400000;

// ── State ────────────────────────────────────────────────────────────────────
let allShows      = [];   // { title, poster, slug, country, rating, airDate, airTs, ep, totalEp }
let selectedDate  = todayStr();
let calYear       = new Date().getFullYear();
let calMonth      = new Date().getMonth();
let settings      = { countries: ["korean", "chinese"], showsPerCountry: 8 };
let loading       = false;

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
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

function kstDateStr(unixSeconds) {
  const ms  = unixSeconds * 1000;
  const kst = new Date(ms + 9 * 3600 * 1000);
  return fmt(kst.getUTCFullYear(), kst.getUTCMonth() + 1, kst.getUTCDate());
}

// ── Settings ─────────────────────────────────────────────────────────────────
async function loadSettings() {
  const stored = await chrome.storage.local.get("settings");
  if (stored.settings) settings = { ...settings, ...stored.settings };
  syncSettingsUI();
}

function syncSettingsUI() {
  document.querySelectorAll(".country-toggle input").forEach(cb => {
    cb.checked = settings.countries.includes(cb.dataset.country);
    cb.closest(".country-toggle").classList.toggle("active", cb.checked);
  });
  document.getElementById("shows-per-country").value = settings.showsPerCountry;
}

async function saveSettings() {
  const countries = [...document.querySelectorAll(".country-toggle input:checked")].map(cb => cb.dataset.country);
  const showsPerCountry = parseInt(document.getElementById("shows-per-country").value);
  settings = { countries: countries.length ? countries : ["korean"], showsPerCountry };
  await chrome.storage.local.set({ settings });
  await chrome.storage.local.remove(CACHE_KEY);
  document.getElementById("settings-panel").classList.add("hidden");
  await initData(true);
}

// ── Data fetching ─────────────────────────────────────────────────────────────
async function fetchShows() {
  // 1. Fetch top ongoing shows for each country in parallel
  const tops = await Promise.all(
    settings.countries.map(c =>
      fetch(`${KURYANA}/top/${c}?status=ongoing`)
        .then(r => r.ok ? r.json() : null)
        .catch(() => null)
    )
  );

  // 2. Collect slugs (limit to showsPerCountry per country)
  const items = [];
  tops.forEach((top, i) => {
    if (!top?.data?.shows) return;
    const code = COUNTRY_CODES[settings.countries[i]];
    top.data.shows.slice(0, settings.showsPerCountry).forEach(show => {
      items.push({
        slug:    show.url.replace(/^\//, ""),
        country: code,
        title:   show.title,
        poster:  show.img,
        rating:  show.rating || 0,
      });
    });
  });

  if (!items.length) return [];

  // 3. Fetch details in batches of 5 to get next_episode_airing
  const shows = [];
  const BATCH = 5;
  for (let i = 0; i < items.length; i += BATCH) {
    const batch = items.slice(i, i + BATCH);
    const details = await Promise.all(
      batch.map(s =>
        fetch(`${KURYANA}/id/${s.slug}`)
          .then(r => r.ok ? r.json() : null)
          .catch(() => null)
      )
    );
    batch.forEach((s, j) => {
      const d   = details[j]?.data;
      const nea = d?.next_episode_airing;
      if (!nea?.released_at) return;
      const airTs = parseInt(nea.released_at);
      if (isNaN(airTs)) return;
      shows.push({
        title:    (d?.title || s.title).replace(/\s*\(\d{4}\)\s*$/, ""), // strip "(2026)" suffix
        poster:   d?.poster || s.poster || null,
        slug:     s.slug,
        country:  s.country,
        rating:   typeof d?.rating === "number" ? d.rating : parseFloat(String(d?.rating ?? "0")) || 0,
        airDate:  kstDateStr(airTs),
        airTs,
        ep:       parseInt(nea.episode_number) || 1,
        totalEp:  parseInt(nea.episodes) || 0,
      });
    });
  }

  return shows.sort((a, b) => a.airTs - b.airTs);
}

async function getShows(forceRefresh = false) {
  if (!forceRefresh) {
    const stored = await chrome.storage.local.get(CACHE_KEY);
    const cache  = stored[CACHE_KEY];
    if (cache && Date.now() - cache.ts < CACHE_TTL) return cache.shows;
  }
  const shows = await fetchShows();
  await chrome.storage.local.set({ [CACHE_KEY]: { shows, ts: Date.now() } });
  return shows;
}

// ── Render: Calendar ──────────────────────────────────────────────────────────
function renderCalendar() {
  document.getElementById("month-label").textContent = `${MONTH_NAMES[calMonth]} ${calYear}`;

  const today  = todayStr();
  const first  = new Date(calYear, calMonth, 1);
  const daysIn = new Date(calYear, calMonth + 1, 0).getDate();
  const offset = (first.getDay() + 6) % 7; // 0 = Monday
  const prevDays = new Date(calYear, calMonth, 0).getDate();

  // Build dot map: date → [country codes]
  const dotMap = {};
  allShows.forEach(s => {
    if (!dotMap[s.airDate]) dotMap[s.airDate] = [];
    dotMap[s.airDate].push(s.country);
  });

  // Build cells array
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
    const dateStr = fmt(cell.y, cell.m + 1, cell.d);
    const isToday    = dateStr === today;
    const isSelected = dateStr === selectedDate;
    const isPast     = dateStr < today;
    const colIdx     = i % 7;
    const isWeekend  = colIdx === 5 || colIdx === 6;

    const div = document.createElement("div");
    div.className = [
      "cal-cell",
      !cell.cur  ? "other-month" : "",
      isPast && !isToday ? "past" : "",
      isToday    ? "today" : "",
      isSelected ? "selected" : "",
      isWeekend  ? "weekend" : "",
    ].filter(Boolean).join(" ");

    // Day number
    const num = document.createElement("div");
    num.className = "cal-day-num";
    num.textContent = cell.d;
    div.appendChild(num);

    // Dots for airing shows
    const dots = dotMap[dateStr];
    if (dots?.length && cell.cur) {
      const dotRow = document.createElement("div");
      dotRow.className = "cal-dots";
      const visible = dots.slice(0, 6);
      visible.forEach(code => {
        const dot = document.createElement("div");
        dot.className = `cal-dot dot-${code}`;
        dotRow.appendChild(dot);
      });
      if (dots.length > 6) {
        const more = document.createElement("div");
        more.className = "cal-dot dot-default";
        more.title = `+${dots.length - 6} more`;
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
  const header   = document.getElementById("agenda-header");
  const list     = document.getElementById("agenda-list");

  header.textContent = selectedDate ? formatDayLabel(selectedDate) : "Select a day";

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
    const epText   = s.totalEp ? `EP ${s.ep}/${s.totalEp}` : `EP ${s.ep}`;
    const flag     = COUNTRY_FLAGS[s.country] || "";
    const ratingTxt = s.rating > 0 ? `★ ${s.rating.toFixed(1)}` : "";
    const initials  = s.title.slice(0, 2).toUpperCase();

    const card = document.createElement("div");
    card.className = "show-card";

    const posterHtml = s.poster
      ? `<img class="show-poster" src="${s.poster}" alt="" loading="lazy" />`
      : `<div class="show-poster-placeholder">${initials}</div>`;

    card.innerHTML = `
      ${posterHtml}
      <div class="show-info">
        <div class="show-title" title="${s.title}">${s.title}</div>
        <div class="show-meta">
          <span class="show-ep">${epText}</span>
          <span class="show-country">${flag}</span>
          ${ratingTxt ? `<span class="show-rating">${ratingTxt}</span>` : ""}
        </div>
      </div>`;

    list.appendChild(card);
  });
}

// ── Footer ────────────────────────────────────────────────────────────────────
function setFooter(text) {
  document.getElementById("footer-text").textContent = text;
}

// ── Init ──────────────────────────────────────────────────────────────────────
async function initData(forceRefresh = false) {
  if (loading) return;
  loading = true;
  const btn = document.getElementById("btn-refresh");
  btn.classList.add("spinning");
  setFooter("Fetching schedule…");

  try {
    allShows = await getShows(forceRefresh);
    renderCalendar();
    renderAgenda();

    const thisMonth = `${calYear}-${String(calMonth + 1).padStart(2, "0")}`;
    const count = allShows.filter(s => s.airDate.startsWith(thisMonth)).length;
    setFooter(count > 0 ? `${count} episode${count !== 1 ? "s" : ""} airing in ${MONTH_NAMES[calMonth]}` : `Nothing found for ${MONTH_NAMES[calMonth]}`);
  } catch (err) {
    setFooter("Failed to load — check connection");
    document.getElementById("agenda-list").innerHTML = `<div class="error-state">⚠ ${err.message}</div>`;
  } finally {
    loading = false;
    btn.classList.remove("spinning");
  }
}

// ── Event wiring ──────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  await loadSettings();
  renderCalendar(); // renders empty skeleton while data loads

  // Navigation
  document.getElementById("btn-prev").addEventListener("click", () => {
    if (calMonth === 0) { calYear--; calMonth = 11; } else calMonth--;
    renderCalendar();
    renderAgenda();
    const thisMonth = `${calYear}-${String(calMonth + 1).padStart(2, "0")}`;
    const count = allShows.filter(s => s.airDate.startsWith(thisMonth)).length;
    setFooter(count > 0 ? `${count} episode${count !== 1 ? "s" : ""} airing in ${MONTH_NAMES[calMonth]}` : `Nothing found for ${MONTH_NAMES[calMonth]}`);
  });
  document.getElementById("btn-next").addEventListener("click", () => {
    if (calMonth === 11) { calYear++; calMonth = 0; } else calMonth++;
    renderCalendar();
    renderAgenda();
    const thisMonth = `${calYear}-${String(calMonth + 1).padStart(2, "0")}`;
    const count = allShows.filter(s => s.airDate.startsWith(thisMonth)).length;
    setFooter(count > 0 ? `${count} episode${count !== 1 ? "s" : ""} airing in ${MONTH_NAMES[calMonth]}` : `Nothing found for ${MONTH_NAMES[calMonth]}`);
  });
  document.getElementById("btn-today").addEventListener("click", () => {
    const now = new Date();
    calYear     = now.getFullYear();
    calMonth    = now.getMonth();
    selectedDate = todayStr();
    renderCalendar();
    renderAgenda();
  });

  // Refresh
  document.getElementById("btn-refresh").addEventListener("click", () => initData(true));

  // Settings toggle
  document.getElementById("btn-settings").addEventListener("click", () => {
    document.getElementById("settings-panel").classList.toggle("hidden");
  });
  document.getElementById("btn-save-settings").addEventListener("click", saveSettings);

  // Country toggle styling
  document.querySelectorAll(".country-toggle input").forEach(cb => {
    cb.addEventListener("change", () => {
      cb.closest(".country-toggle").classList.toggle("active", cb.checked);
    });
  });

  // Trigger initial data load
  await initData();
});
