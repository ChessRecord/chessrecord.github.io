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

// Opt 4: One innerHTML assignment for the entire list instead of creating,
// configuring, and appending a DOM node per player in a loop.
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
  container.innerHTML = "";
  container.appendChild(fragment);
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

  function applyPlayer({ name, title, standard, rapid, blitz }) {
    input.value = name;
    titleInput.value = title;
    Object.assign(input.dataset, { standard, rapid, blitz });
    container.innerHTML = "";
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
    titleInput.value = "";
    if (!ratingEl.dataset.userSet) ratingEl.value = "";
  }

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
      clearSide();
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
  showLoader("#addGame span");
  try {
    // 1. Collect — one DOM pass, raw values (Opt 2)
    const state = getFormState();

    // 2. Validate — cheap string/range checks before any formatting (Opt 3)
    const error = validateState(state);
    if (error) return alert(error);

    // 3. Format — expensive normalization runs only for valid submissions
    const players = formatPlayers(state.players);

    // 4. Build  5. Dedupe  6. Persist  7. Reset UI
    const game = buildGame(players, state);
    if (isDuplicate(game))
      return alert("This game already exists in the database!");
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
      const { player: playerEl, rating: ratingEl } = SIDE_ELS.get(key);
      if (ratingEl) delete ratingEl.dataset.userSet;
      if (playerEl) {
        delete playerEl.dataset.standard;
        delete playerEl.dataset.rapid;
        delete playerEl.dataset.blitz;
      }
    });
  });

  // Opt 5: Single initialization pass combines autocomplete setup and rating
  // ownership tracking — the two old SIDES.forEach loops become one.
  SIDES.forEach((side) => {
    setupAutocomplete(side);

    // Inline of the old trackRatingInput: marks the field as user-owned on
    // any manual edit so auto-fill never clobbers intentional input.
    const { rating: ratingEl } = SIDE_ELS.get(side.key);
    if (ratingEl) {
      ratingEl.addEventListener("input", () => {
        if (ratingEl.value.trim()) ratingEl.dataset.userSet = "true";
        else delete ratingEl.dataset.userSet;
      });
    }
  });

  // On blur (not input) so ratings recalculate only once the user leaves the time-control field, not on every character typed.
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
});

document.addEventListener("keydown", ({ key }) => {
  if (key !== "Escape") return;
  SIDES.forEach(({ key: k }) =>
    SIDE_ELS.get(k)?.suggestions?.replaceChildren(),
  );
});
