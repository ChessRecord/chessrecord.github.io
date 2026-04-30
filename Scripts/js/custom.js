// custom.js — Custom page controller

/* ─── Initialization ─────────────────────────────────────────────────────── */

window.games = JSON.parse(localStorage.getItem("chessGames")) || [];

const FIDE_SEARCH_API = "https://lichess.org/api/fide/player";

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

// Returns the ratings cached on a player input element, or null if absent.
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

async function fetchPlayerSuggestions(query) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(
      `${FIDE_SEARCH_API}?q=${encodeURIComponent(query.trim())}`,
      { signal: controller.signal },
    );
    if (!res.ok) throw new Error(`API error ${res.status}`);
    const data = await res.json();
    return data.map(({ name, title, standard = 0, rapid = 0, blitz = 0 }) => ({
      name: formatName(name),
      title: abbreviateTitle(title),
      standard,
      rapid,
      blitz,
    }));
  } catch (err) {
    console.error("Error fetching player suggestions:", err);
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

function highlightMatch(text, query) {
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.replace(
    new RegExp(`(${escaped})`, "gi"),
    '<span style="font-weight:700">$1</span>',
  );
}

function renderSuggestions(input, container, suggestions) {
  const query = input.value.trim();
  container.innerHTML = "";
  suggestions.forEach(({ name, title, standard, rapid, blitz }) => {
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

function setupAutocomplete(inputId, containerId, titleId, ratingInputId) {
  const input = document.getElementById(inputId);
  const container = document.getElementById(containerId);
  const titleInput = document.getElementById(titleId);
  if (!input || !container || !titleInput) return;

  input.addEventListener("input", async ({ target }) => {
    const query = target.value.trim();
    if (query.length > 1) {
      renderSuggestions(input, container, await fetchPlayerSuggestions(query));
    } else {
      container.innerHTML = "";
      if (!query) {
        delete input.dataset.standard;
        delete input.dataset.rapid;
        delete input.dataset.blitz;
      }
    }
  });

  container.addEventListener("click", ({ target }) => {
    const item = target.closest(".autocomplete-suggestion");
    if (!item) return;

    input.value = item.dataset.name;
    titleInput.value = item.dataset.title;
    container.innerHTML = "";

    // Cache per-time-control ratings on the player input for later lookups
    Object.assign(input.dataset, {
      standard: item.dataset.standard,
      rapid: item.dataset.rapid,
      blitz: item.dataset.blitz,
    });

    // Auto-fill rating if the time control field has already been filled and left
    const timeEl = document.getElementById("time");
    if (timeEl?.value.trim()) {
      autoFillRating(ratingInputId, getCachedRatings(inputId), timeEl.value);
    }
  });
}

/* ─── Player & Game Helpers ──────────────────────────────────────────────── */

function resolvePlayers() {
  const field = (id) => document.getElementById(id);
  const makePlayer = (nameId, titleId, ratingId) => ({
    name: formatName(capitalize(field(nameId).value)),
    title: abbreviateTitle(field(titleId).value.toUpperCase()),
    rating: parseInt(field(ratingId).value) || 0,
  });
  return {
    white: makePlayer("playerWhite", "whiteTitle", "whiteRating"),
    black: makePlayer("playerBlack", "blackTitle", "blackRating"),
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

    const { white, black } = resolvePlayers();
    const game = buildGame(white, black, formData);

    if (isDuplicate(game)) {
      return alert("Game already exists or player conflict in this round!");
    }

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
    ["whiteRating", "blackRating"].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      delete el.dataset.userSet;
    });
    ["playerWhite", "playerBlack"].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      delete el.dataset.standard;
      delete el.dataset.rapid;
      delete el.dataset.blitz;
    });
  });

  setupAutocomplete(
    "playerWhite",
    "whiteSuggestions",
    "whiteTitle",
    "whiteRating",
  );
  setupAutocomplete(
    "playerBlack",
    "blackSuggestions",
    "blackTitle",
    "blackRating",
  );
  trackRatingInput("whiteRating");
  trackRatingInput("blackRating");

  // On blur (not input) so the rating only recalculates once the user has
  // finished typing and moved away from the time control field
  const SIDES = [
    { playerId: "playerWhite", ratingId: "whiteRating" },
    { playerId: "playerBlack", ratingId: "blackRating" },
  ];
  document.getElementById("time")?.addEventListener("blur", ({ target }) => {
    SIDES.forEach(({ playerId, ratingId }) => {
      const cached = getCachedRatings(playerId);
      if (cached) autoFillRating(ratingId, cached, target.value);
    });
  });
});

document.addEventListener("keydown", ({ key }) => {
  if (key !== "Escape") return;
  ["whiteSuggestions", "blackSuggestions"].forEach((id) => {
    document.getElementById(id)?.replaceChildren();
  });
});
