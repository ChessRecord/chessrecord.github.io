// new.js — New Game page controller

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

/* ─── DOM Cache ──────────────────────────────────────────────────────────── */

// Opt 1: All element lookups happen exactly once at DOMContentLoaded and are
// stored here. Every listener and helper reads from these maps rather than
// touching the DOM on each keystroke or event.

const SIDE_ELS = new Map(); // key → { player, title, rating, suggestions }
let formEls = {}; // { result, time, tournament, round, date, gameLink }

/* ─── API ────────────────────────────────────────────────────────────────── */

// Normalization lives only at the API boundary — all objects leaving this
// function are already clean, so nothing downstream needs to reformat them.
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
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`${FIDE_BASE}/${id}`, {
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`API error ${res.status}`);
    const data = await res.json();
    if (!data.name) throw new Error(`No player found for FIDE ID: ${id}`);
    return normalizePlayer(data);
  } finally {
    clearTimeout(timeout);
  }
}

// Accepts a signal so the caller can cancel in-flight requests when the query
// changes. Returns null on abort — callers must check for null before rendering.
async function fetchPlayerSuggestions(query, signal) {
  try {
    const res = await fetch(
      `${FIDE_BASE}?q=${encodeURIComponent(query.trim())}`,
      { signal },
    );
    if (!res.ok) throw new Error(`API error ${res.status}`);
    return (await res.json()).map(normalizePlayer);
  } catch (err) {
    if (err.name === "AbortError") return null; // intentionally cancelled
    console.error("Error fetching player suggestions:", err);
    return [];
  }
}

/* ─── Rating Helpers ─────────────────────────────────────────────────────── */

function pickRating({ standard = 0, rapid = 0, blitz = 0 } = {}, time) {
  if (!time?.trim()) return standard;
  return (
    { Classical: standard, Rapid: rapid, Blitz: blitz, Bullet: blitz }[
      getTimeControlCategory(time)
    ] ?? standard
  );
}

/* ─── Inline Form Error ──────────────────────────────────────────────────── */

// Created once on first use and reused for every subsequent error. Inserted
// immediately before the submit button so it appears in natural reading order
// without modifying the HTML.
let _formErrorEl = null;

function getFormErrorEl() {
  if (_formErrorEl) return _formErrorEl;
  _formErrorEl = document.createElement("p");
  _formErrorEl.setAttribute("role", "alert");
  _formErrorEl.style.cssText =
    "color:#c0392b;font-size:.875rem;margin:.25rem 0 0;display:none";
  document
    .getElementById("addGame")
    ?.insertAdjacentElement("beforebegin", _formErrorEl);
  return _formErrorEl;
}

function showFormError(msg) {
  const el = getFormErrorEl();
  el.textContent = msg;
  el.style.display = "block";
}

function clearFormError() {
  if (!_formErrorEl) return;
  _formErrorEl.textContent = "";
  _formErrorEl.style.display = "none";
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

// Opt 4: Builds the entire list into a DocumentFragment in one pass, then
// replaces the container's children atomically — no intermediate empty paint.
function renderSuggestions(container, query, players) {
  const fragment = document.createDocumentFragment();
  players.forEach((p) => {
    const div = document.createElement("div");
    div.className = "autocomplete-suggestion";
    Object.assign(div.dataset, {
      name: p.name,
      title: p.title || "",
      standard: p.standard,
      rapid: p.rapid,
      blitz: p.blitz,
    });
    div.innerHTML = `${p.title ? `<span class="title">${p.title}</span> ` : ""}${highlightMatch(p.name, query)}`;
    fragment.appendChild(div);
  });
  container.replaceChildren(fragment);
}

function setupAutocomplete({ key }) {
  // Opt 1: All elements come from the pre-built cache — no getElementById call
  // inside this function or any of its inner helpers.
  const {
    player: input,
    title: titleInput,
    rating: ratingEl,
    suggestions: container,
  } = SIDE_ELS.get(key);
  if (!input || !container || !titleInput) return;

  // Holds the AbortController for the most recent in-flight name suggestions
  // request. Replaced on every new name query; aborted when the query changes.
  let nameController = null;

  function applyPlayer({ name, title, standard, rapid, blitz }) {
    input.value = name;
    titleInput.value = title;
    // Mark title as auto-filled so clearSide knows it is safe to wipe.
    titleInput.dataset.autoFilled = "true";
    Object.assign(input.dataset, { standard, rapid, blitz });
    container.replaceChildren();
    // formEls.time is the cached module-level reference — no getElementById here.
    const time = formEls.time?.value.trim();
    if (!ratingEl.dataset.userSet) {
      ratingEl.value = pickRating({ standard, rapid, blitz }, time) || "";
    }
  }

  function clearSide() {
    delete input.dataset.standard;
    delete input.dataset.rapid;
    delete input.dataset.blitz;
    // Only wipe the title if it was auto-filled by autocomplete or FIDE
    // resolution. If the user typed it manually, leave it untouched.
    if (titleInput.dataset.autoFilled) {
      titleInput.value = "";
      delete titleInput.dataset.autoFilled;
    }
    if (!ratingEl.dataset.userSet) ratingEl.value = "";
  }

  async function onFideQuery(query) {
    try {
      const player = await fetchFidePlayer(parseInt(query));
      if (input.value.trim() !== query) return; // stale
      applyPlayer(player);
    } catch {
      if (input.value.trim() !== query) return; // stale
      const errDiv = document.createElement("div");
      errDiv.className = "autocomplete-suggestion";
      errDiv.style.pointerEvents = "none";
      errDiv.innerHTML = "<i>FIDE ID not found</i>";
      container.replaceChildren(errDiv);
      // Auto-clear after 2500 ms, but only if this exact bad ID is still typed.
      setTimeout(() => {
        if (input.value.trim() === query) container.replaceChildren();
      }, 2500);
    }
  }

  async function onNameQuery(query) {
    // Cancel any previous in-flight request for this side before firing a new
    // one — parallel calls across sides are fine, but serial calls for the same
    // side are wasteful since only the latest result is ever rendered.
    nameController?.abort();
    nameController = new AbortController();
    const players = await fetchPlayerSuggestions(query, nameController.signal);
    if (players === null) return; // aborted — a newer query is already in flight
    if (input.value.trim() !== query) return; // stale
    renderSuggestions(container, query, players);
  }

  input.addEventListener("input", ({ target }) => {
    const query = target.value.trim();
    container.replaceChildren();
    if (!query) {
      nameController?.abort();
      nameController = null;
      clearSide();
      return;
    }
    if (isFideId(query)) {
      nameController?.abort();
      nameController = null;
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

/* ─── Form State ─────────────────────────────────────────────────────────── */

// Opt 2: A single DOM pass over SIDE_ELS and formEls collects all player and
// game fields at once. Raw (un-formatted) strings are returned so that
// validateState can do its cheap checks before any formatting runs.
function getFormState() {
  const players = Object.fromEntries(
    SIDES.map(({ key }) => {
      const { player, title, rating } = SIDE_ELS.get(key);
      return [
        key,
        {
          rawName: player.value.trim(),
          rawTitle: title.value,
          rawRating: rating.value,
        },
      ];
    }),
  );
  return {
    result: formEls.result.value,
    time: formEls.time.value || "",
    tournament: formEls.tournament.value,
    round: Math.max(1, toNumberOr(formEls.round.value, 1)),
    date: formEls.date.value,
    gameLink: formEls.gameLink.value,
    players,
  };
}

// Opt 3: Validates cheap conditions (string checks, numeric range) on raw
// state before any expensive formatting (formatName, capitalize, abbreviateTitle)
// is ever called. Returns an error string, or null if valid.
function validateState(state) {
  if (state.result === "0") return "Please select a result!";
  if (!state.players.white.rawName) return "White player name cannot be empty!";
  if (!state.players.black.rawName) return "Black player name cannot be empty!";
  if (state.round < 1) return "Round must be a positive integer!";
  return null;
}

// Runs only after validateState passes — formatting effort is never wasted on
// invalid submissions.
function formatPlayers({ white, black }) {
  const fmt = ({ rawName, rawTitle, rawRating }) => ({
    name: formatName(capitalize(rawName)),
    title: abbreviateTitle(rawTitle.toUpperCase()),
    rating: toNumberOr(rawRating, 0),
  });
  return { white: fmt(white), black: fmt(black) };
}

/* ─── Game Helpers ───────────────────────────────────────────────────────── */

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

// Blocks submission if either player already appears in the same round,
// tournament, and date — not just when both players match together.
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

// Pipeline: collect → validate (cheap) → format (expensive) → build → dedupe
//           → persist → reset UI.
async function addGame(event) {
  event.preventDefault();
  clearFormError();
  showLoader("#addGame span");
  try {
    // 1. Collect — one DOM pass, raw values (Opt 2)
    const state = getFormState();

    // 2. Validate — cheap string/range checks before any formatting (Opt 3)
    const error = validateState(state);
    if (error) return showFormError(error);

    // 3. Format — expensive normalization runs only for valid submissions
    const players = formatPlayers(state.players);

    // 4. Build  5. Dedupe  6. Persist  7. Reset UI
    const game = buildGame(players, state);
    if (isDuplicate(game))
      return showFormError(
        "Game already exists or player conflict in this round!",
      );
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

  // Opt 1: Resolve every element once and store in module-level caches.
  // From this point forward, no function needs to call getElementById.
  SIDES.forEach(({ key, player, title, rating, suggestions }) => {
    SIDE_ELS.set(key, {
      player: document.getElementById(player),
      title: document.getElementById(title),
      rating: document.getElementById(rating),
      suggestions: document.getElementById(suggestions),
    });
  });

  formEls = {
    result: document.getElementById("result"),
    time: document.getElementById("time"),
    tournament: document.getElementById("tournament"),
    round: document.getElementById("round"),
    date: document.getElementById("date"),
    gameLink: document.getElementById("gameLink"),
  };

  gameForm?.addEventListener("submit", addGame);

  gameForm?.addEventListener("reset", () => {
    SIDES.forEach(({ key }) => {
      const {
        player: playerEl,
        rating: ratingEl,
        title: titleEl,
      } = SIDE_ELS.get(key);
      if (ratingEl) delete ratingEl.dataset.userSet;
      if (playerEl) {
        delete playerEl.dataset.standard;
        delete playerEl.dataset.rapid;
        delete playerEl.dataset.blitz;
      }
      if (titleEl) delete titleEl.dataset.autoFilled;
    });
    clearFormError();
  });

  // Opt 5: Single initialization pass combines autocomplete setup, rating
  // ownership tracking, and title ownership tracking.
  SIDES.forEach((side) => {
    setupAutocomplete(side);

    const { rating: ratingEl, title: titleEl } = SIDE_ELS.get(side.key);

    // Marks the rating field as user-owned on any manual edit so auto-fill
    // never clobbers intentional input.
    if (ratingEl) {
      ratingEl.addEventListener("input", () => {
        if (ratingEl.value.trim()) ratingEl.dataset.userSet = "true";
        else delete ratingEl.dataset.userSet;
      });
    }

    // Any manual edit to the title field removes the autoFilled marker so
    // clearSide knows not to wipe it.
    if (titleEl) {
      titleEl.addEventListener("input", () => {
        delete titleEl.dataset.autoFilled;
      });
    }
  });

  // On blur (not input) so ratings recalculate only once the user leaves the
  // time-control field, not on every character typed.
  formEls.time?.addEventListener("blur", ({ target }) => {
    SIDES.forEach(({ key }) => {
      const { player: playerEl, rating: ratingEl } = SIDE_ELS.get(key);
      if (!playerEl?.dataset.standard || ratingEl?.dataset.userSet) return;
      const cached = {
        standard: Number(playerEl.dataset.standard),
        rapid: Number(playerEl.dataset.rapid),
        blitz: Number(playerEl.dataset.blitz),
      };
      ratingEl.value = pickRating(cached, target.value) || "";
    });
  });

  // Single passive listener handles outside-click/tap dismissal for all
  // suggestion containers — covers both mouse and touch (mobile).
  document.addEventListener(
    "pointerdown",
    (e) => {
      SIDES.forEach(({ key }) => {
        const { player, suggestions } = SIDE_ELS.get(key);
        if (!player?.contains(e.target) && !suggestions?.contains(e.target)) {
          suggestions?.replaceChildren();
        }
      });
    },
    { passive: true },
  );
});

document.addEventListener("keydown", ({ key }) => {
  if (key !== "Escape") return;
  SIDES.forEach(({ key: k }) =>
    SIDE_ELS.get(k)?.suggestions?.replaceChildren(),
  );
});
