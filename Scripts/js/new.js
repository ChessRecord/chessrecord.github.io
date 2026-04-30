// custom.js — Custom page controller

/* ─── Constants ──────────────────────────────────────────────────────────── */

window.games = JSON.parse(localStorage.getItem("chessGames")) || [];

const FIDE_BASE = "https://lichess.org/api/fide/player";

const SIDES = [
  {
    key: "white",
    player: "playerWhite",
    title: "whiteTitle",
    rating: "whiteRating",
    suggestions: "whiteSuggestions",
  },
  {
    key: "black",
    player: "playerBlack",
    title: "blackTitle",
    rating: "blackRating",
    suggestions: "blackSuggestions",
  },
];

/* ─── API ────────────────────────────────────────────────────────────────── */

function normalizePlayer({
  name,
  title = "",
  standard = 0,
  rapid = 0,
  blitz = 0,
}) {
  return {
    name: formatName(capitalize(name)),
    title: abbreviateTitle(title),
    standard,
    rapid,
    blitz,
  };
}

async function fetchFidePlayer(id) {
  if (!id || isNaN(id)) throw new Error(`Invalid FIDE ID: ${id}`);
  const res = await fetch(`${FIDE_BASE}/${id}`);
  if (!res.ok) throw new Error(`API error ${res.status}`);
  const data = await res.json();
  if (!data.name) throw new Error(`No player found for FIDE ID: ${id}`);
  return normalizePlayer(data);
}

async function fetchPlayerSuggestions(query) {
  try {
    const res = await fetch(
      `${FIDE_BASE}?q=${encodeURIComponent(query.trim())}`,
    );
    if (!res.ok) throw new Error(`API error ${res.status}`);
    return (await res.json()).map(normalizePlayer);
  } catch (err) {
    console.error("Error fetching player suggestions:", err);
    return [];
  }
}

/* ─── Rating Helpers ─────────────────────────────────────────────────────── */

function pickRating({ standard = 0, rapid = 0, blitz = 0 } = {}, time) {
  return (
    { Classical: standard, Rapid: rapid, Blitz: blitz, Bullet: blitz }[
      getTimeControlCategory(time)
    ] ?? standard
  );
}

// Marks a rating input as user-owned on any manual edit.
// Once set, auto-fill will never touch that field again until the form resets.
function trackRatingInput(ratingId) {
  const el = document.getElementById(ratingId);
  if (!el) return;
  el.addEventListener("input", () => {
    if (el.value.trim()) el.dataset.userSet = "true";
    else delete el.dataset.userSet; // manually cleared — relinquish ownership
  });
}

// Fills the rating input only if the user has not touched it themselves.
function autoFillRating(ratingId, ratings, time) {
  const el = document.getElementById(ratingId);
  if (!el || el.dataset.userSet) return;
  el.value = pickRating(ratings, time) || "";
}

// Returns the ratings cached on a player input element, or null if absent.
// NOTE: This is intentional caching — ratings are stored in input.dataset on
// player selection to power the time-control blur auto-fill without a re-fetch.
function getCachedRatings(playerId) {
  const el = document.getElementById(playerId);
  if (!el?.dataset.standard) return null;
  return {
    standard: Number(el.dataset.standard),
    rapid: Number(el.dataset.rapid),
    blitz: Number(el.dataset.blitz),
  };
}

/* ─── Autocomplete ───────────────────────────────────────────────────────── */

function isFideId(query) {
  return /^\d{5,10}$/.test(query.trim());
}

function highlightMatch(text, query) {
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.replace(
    new RegExp(`(${escaped})`, "gi"),
    '<span style="font-weight:700">$1</span>',
  );
}

function renderSuggestions(container, query, players) {
  container.innerHTML = "";
  players.forEach(({ name, title, standard, rapid, blitz }) => {
    const item = document.createElement("div");
    item.className = "autocomplete-suggestion";
    item.innerHTML = `${title ? `<span class="title">${title}</span> ` : ""}${highlightMatch(name, query)}`;
    Object.assign(item.dataset, {
      name,
      title: title || "",
      standard,
      rapid,
      blitz,
    });
    container.appendChild(item);
  });
}

function setupAutocomplete({
  player: playerId,
  title: titleId,
  rating: ratingId,
  suggestions: containerId,
}) {
  const input = document.getElementById(playerId);
  const container = document.getElementById(containerId);
  const titleInput = document.getElementById(titleId);
  if (!input || !container || !titleInput) return;

  function applyPlayer({ name, title, standard, rapid, blitz }) {
    input.value = name;
    titleInput.value = title;
    Object.assign(input.dataset, { standard, rapid, blitz });
    container.innerHTML = "";
    const time = document.getElementById("time")?.value.trim();
    if (time) autoFillRating(ratingId, { standard, rapid, blitz }, time);
  }

  // Extracted from the input listener so try/catch has no finally — avoids the
  // bug where finally immediately clears the error message set in catch.
  async function onFideQuery(query) {
    try {
      const player = await fetchFidePlayer(parseInt(query));
      if (input.value.trim() !== query) return; // stale
      applyPlayer(player);
    } catch {
      if (input.value.trim() !== query) return; // stale
      container.innerHTML =
        '<div class="autocomplete-suggestion" style="pointer-events:none"><i>FIDE ID not found</i></div>';
    }
  }

  async function onNameQuery(query) {
    const players = await fetchPlayerSuggestions(query);
    if (input.value.trim() !== query) return; // stale
    renderSuggestions(container, query, players);
  }

  input.addEventListener("input", ({ target }) => {
    const query = target.value.trim();
    container.innerHTML = "";
    if (!query) {
      delete input.dataset.standard;
      delete input.dataset.rapid;
      delete input.dataset.blitz;
      return;
    }
    if (isFideId(query)) {
      onFideQuery(query);
      return;
    }
    if (query.length > 1) onNameQuery(query);
  });

  container.addEventListener("click", ({ target }) => {
    const item = target.closest(".autocomplete-suggestion");
    if (!item) return;
    applyPlayer({
      name: item.dataset.name,
      title: item.dataset.title,
      standard: Number(item.dataset.standard),
      rapid: Number(item.dataset.rapid),
      blitz: Number(item.dataset.blitz),
    });
  });
}

/* ─── Game Helpers ───────────────────────────────────────────────────────── */

function resolvePlayers() {
  const get = (id) => document.getElementById(id);
  return Object.fromEntries(
    SIDES.map(({ key, player, title, rating }) => [
      key,
      {
        name: formatName(capitalize(get(player).value)),
        title: abbreviateTitle(get(title).value.toUpperCase()),
        rating: parseInt(get(rating).value) || 0,
      },
    ]),
  );
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
  players,
  { result, time, tournament, round, date, gameLink },
) {
  return {
    id: generateUniqueID(),
    white: players.white.name,
    whiteRating: players.white.rating,
    whiteTitle: players.white.title,
    black: players.black.name,
    blackRating: players.black.rating,
    blackTitle: players.black.title,
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

    const players = resolvePlayers();
    const game = buildGame(players, formData);

    if (isDuplicate(game))
      return alert("Game already exists or player conflict in this round!");

    window.games.push(game);
    saveGames();
    event.target.reset();
    gameAddedAlert(game);
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
    SIDES.forEach(({ player, rating }) => {
      delete document.getElementById(rating)?.dataset.userSet;
      const playerEl = document.getElementById(player);
      if (playerEl) {
        delete playerEl.dataset.standard;
        delete playerEl.dataset.rapid;
        delete playerEl.dataset.blitz;
      }
    });
  });

  SIDES.forEach(setupAutocomplete);
  SIDES.forEach(({ rating }) => trackRatingInput(rating));

  // On blur (not input) so the rating only recalculates once the user has
  // finished typing and moved away from the time control field
  document.getElementById("time")?.addEventListener("blur", ({ target }) => {
    SIDES.forEach(({ player, rating }) => {
      const cached = getCachedRatings(player);
      if (cached) autoFillRating(rating, cached, target.value);
    });
  });
});

document.addEventListener("keydown", ({ key }) => {
  if (key !== "Escape") return;
  SIDES.forEach(({ suggestions }) =>
    document.getElementById(suggestions)?.replaceChildren(),
  );
});
