// fide.js — FIDE page controller

/* ─── Initialization ─────────────────────────────────────────────────────── */

window.games = JSON.parse(localStorage.getItem("chessGames")) || [];

const FIDE_API = "https://lichess.org/api/fide/player/";

// In-memory cache so blurring the FIDE ID field and blurring the time field
// never fire redundant network requests.
const playerCache = new Map();

/* ─── Shared Rating Helpers ──────────────────────────────────────────────── */

function pickRating({ standard = 0, rapid = 0, blitz = 0 } = {}, time) {
  return (
    { Classical: standard, Rapid: rapid, Blitz: blitz, Bullet: blitz }[
      getTimeControlCategory(time)
    ] ?? standard
  );
}

// Marks a rating input as user-owned on any manual edit.
// Once set, auto-fill will never touch that field again until the form resets.
function trackRatingInput(ratingInputId) {
  const el = document.getElementById(ratingInputId);
  if (!el) return;
  el.addEventListener("input", () => {
    if (el.value.trim()) {
      el.dataset.userSet = "true";
    } else {
      // Field manually cleared — relinquish ownership so auto-fill can help again
      delete el.dataset.userSet;
    }
  });
}

// Fills the rating input only if the user has not touched it themselves.
function autoFillRating(ratingInputId, ratings, time) {
  const el = document.getElementById(ratingInputId);
  if (!el || el.dataset.userSet) return;
  const rating = pickRating(ratings, time);
  el.value = rating || "";
}

/* ─── API ────────────────────────────────────────────────────────────────── */

async function fetchFidePlayer(id) {
  if (!id || isNaN(id)) throw new Error(`Invalid FIDE ID: ${id}`);
  if (playerCache.has(id)) return playerCache.get(id);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`${FIDE_API}${id}`, { signal: controller.signal });
    if (!res.ok) throw new Error(`API error ${res.status}`);
    const {
      name,
      title = "",
      standard = 0,
      rapid = 0,
      blitz = 0,
    } = await res.json();
    if (!name) throw new Error(`No player found for FIDE ID: ${id}`);
    const player = {
      name: formatName(capitalize(name)),
      title: abbreviateTitle(title),
      standard,
      rapid,
      blitz,
    };
    playerCache.set(id, player);
    return player;
  } finally {
    clearTimeout(timeout);
  }
}

// Pre-fetches on FIDE ID blur and fills the rating if the user hasn't set it.
async function handleFideBlur(side) {
  const fideEl = document.getElementById(`${side}FIDE`);
  const ratingEl = document.getElementById(`${side}Rating`);
  if (!fideEl || !ratingEl) return;

  const id = parseInt(fideEl.value.trim());
  if (!id) {
    if (!ratingEl.dataset.userSet) ratingEl.value = "";
    return;
  }

  try {
    const player = await fetchFidePlayer(id);
    const time = document.getElementById("time")?.value || "";
    autoFillRating(`${side}Rating`, player, time);
  } catch {
    // Invalid ID — leave the rating field as-is
  }
}

// Re-evaluates ratings from cache when the time control is confirmed (blur).
function refreshRatings() {
  const time = document.getElementById("time")?.value || "";
  ["white", "black"].forEach((side) => {
    const fideEl = document.getElementById(`${side}FIDE`);
    const id = parseInt(fideEl?.value.trim());
    const cached = playerCache.get(id);
    if (cached) autoFillRating(`${side}Rating`, cached, time);
  });
}

/* ─── Player & Game Helpers ──────────────────────────────────────────────── */

async function resolvePlayers(time) {
  const getId = (id) => parseInt(document.getElementById(id).value.trim());

  const [whiteData, blackData] = await Promise.all([
    fetchFidePlayer(getId("whiteFIDE")),
    fetchFidePlayer(getId("blackFIDE")),
  ]);

  // For name and title we always trust the API.
  // For rating we prefer what the user has typed (historical games, etc.),
  // falling back to the API-derived value for the current time control.
  const readRating = (side, data) => {
    const el = document.getElementById(`${side}Rating`);
    if (el?.dataset.userSet) return parseInt(el.value) || 0;
    return pickRating(data, time);
  };

  return {
    white: { ...whiteData, rating: readRating("white", whiteData) },
    black: { ...blackData, rating: readRating("black", blackData) },
  };
}

function collectFormData() {
  return {
    result: document.getElementById("result").value,
    time: document.getElementById("time").value || "",
    tournament: document.getElementById("tournament").value,
    round: parseInt(document.getElementById("round").value) || 1,
    date: document.getElementById("date").value,
    gameLink: document.getElementById("gameLink").value,
  };
}

function buildGame(
  white,
  black,
  { result, time, tournament, round, date, gameLink },
) {
  return {
    id: generateUniqueID(),
    white: white.name,
    whiteRating: white.rating,
    whiteTitle: white.title,
    black: black.name,
    blackRating: black.rating,
    blackTitle: black.title,
    result,
    tournament,
    round: Number(round),
    time,
    date,
    gameLink,
  };
}

function isDuplicate({ white, black, date, tournament, round }) {
  return window.games.some(
    (g) =>
      (g.white === white || g.black === black) &&
      g.date === date &&
      g.tournament === tournament &&
      g.round === round,
  );
}

function gameAddedAlert({ whiteTitle, white, blackTitle, black }) {
  const fmt = (title, name) =>
    `${toUnicodeVariant(title, "bold sans", "sans")} ${name}`;
  alert(`${fmt(whiteTitle, white)} vs ${fmt(blackTitle, black)} Game Added!`);
}

/* ─── Form Submission ────────────────────────────────────────────────────── */

async function addGame(event) {
  event.preventDefault();
  showLoader("#addGame span");

  try {
    const formData = collectFormData();
    if (formData.result === "0") return alert("Please select a result!");

    const { white, black } = await resolvePlayers(formData.time);
    const game = buildGame(white, black, formData);

    if (isDuplicate(game)) {
      return alert("Game already exists or player conflict in this round!");
    }

    window.games.push(game);
    saveGames();
    event.target.reset();
    gameAddedAlert(game);
  } catch (err) {
    console.error("Error adding game:", err);
    alert(
      err.message.startsWith("Invalid FIDE ID")
        ? err.message
        : "Error fetching FIDE data. Please try again.",
    );
  } finally {
    hideLoader("#addGame span");
  }
}

/* ─── Initialization ─────────────────────────────────────────────────────── */

document.addEventListener("DOMContentLoaded", () => {
  const gameForm = document.getElementById("gameForm");

  gameForm?.addEventListener("submit", addGame);

  // Wipe all tracking state when the form resets after a successful submit
  gameForm?.addEventListener("reset", () => {
    ["whiteRating", "blackRating"].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      delete el.dataset.userSet;
    });
    playerCache.clear();
  });

  // Pre-fetch player data + fill rating once the user leaves a FIDE ID field
  document
    .getElementById("whiteFIDE")
    ?.addEventListener("blur", () => handleFideBlur("white"));
  document
    .getElementById("blackFIDE")
    ?.addEventListener("blur", () => handleFideBlur("black"));

  trackRatingInput("whiteRating");
  trackRatingInput("blackRating");

  // On blur (not input) so the rating only recalculates once the user has
  // finished typing and moved away from the time control field
  document.getElementById("time")?.addEventListener("blur", refreshRatings);
});
