// new.js — New Game page controller
import {
  formatName,
  capitalize,
  abbreviateTitle,
  getTimeControlCategory,
  toNumberOr,
  generateUniqueID,
  toUnicodeVariant,
  showLoader,
  hideLoader,
} from "./utils.js";
import { saveGames, registerGame } from "./games.js";

/* ─── Constants ──────────────────────────────────────────────────────────── */

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

const SIDE_ELS = new Map(); // key → { player, title, rating, suggestions }
let formEls = {}; // { result, time, tournament, round, date, gameLink }

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
  const elSet = SIDE_ELS.get(key);
  if (!elSet) return;
  const {
    player: input,
    title: titleInput,
    rating: ratingEl,
    suggestions: container,
  } = elSet;
  if (!input || !container || !titleInput) return;

  function applyPlayer({ name, title, standard, rapid, blitz }) {
    input.value = name;
    titleInput.value = title;
    Object.assign(input.dataset, { standard, rapid, blitz });
    container.innerHTML = "";
    const time = formEls.time?.value.trim();
    if (time && !ratingEl.dataset.userSet) {
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

function getFormState() {
  const players = Object.fromEntries(
    SIDES.map(({ key }) => {
      const elSet = SIDE_ELS.get(key);
      if (!elSet) return [key, {}];
      const { player, title, rating } = elSet;
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
    result: formEls.result?.value || "0",
    time: formEls.time?.value || "",
    tournament: formEls.tournament?.value || "",
    round: Math.max(1, toNumberOr(formEls.round?.value, 1)),
    date: formEls.date?.value || "",
    gameLink: formEls.gameLink?.value || "",
    players,
  };
}

function validateState(state) {
  if (state.result === "0") return "Please select a result!";
  if (!state.players.white.rawName) return "White player name cannot be empty!";
  if (!state.players.black.rawName) return "Black player name cannot be empty!";
  if (state.round < 1) return "Round must be a positive integer!";
  return null;
}

function formatPlayers({ white, black }) {
  const fmt = ({ rawName, rawTitle, rawRating }) => ({
    name: formatName(capitalize(rawName)),
    title: abbreviateTitle((rawTitle || "").toUpperCase()),
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
    const state = getFormState();
    const error = validateState(state);
    if (error) return alert(error);
    const players = formatPlayers(state.players);
    const game = buildGame(players, state);

    // Register the game via the App Controller
    const success = registerGame(game);
    if (!success) return alert("This game already exists in the database!");

    event.target.reset();
    gameAddedAlert(game);
  } finally {
    hideLoader("#addGame span");
  }
}

/* ─── Initialization ─────────────────────────────────────────────────────── */

const initNewGame = () => {
  const gameForm = document.getElementById("gameForm");
  if (!gameForm) return;

  SIDES.forEach(({ key, player, title, rating, suggestions }) => {
    const pEl = document.getElementById(player);
    if (pEl) {
      SIDE_ELS.set(key, {
        player: pEl,
        title: document.getElementById(title),
        rating: document.getElementById(rating),
        suggestions: document.getElementById(suggestions),
      });
    }
  });

  formEls = {
    result: document.getElementById("result"),
    time: document.getElementById("time"),
    tournament: document.getElementById("tournament"),
    round: document.getElementById("round"),
    date: document.getElementById("date"),
    gameLink: document.getElementById("gameLink"),
  };

  gameForm.addEventListener("submit", addGame);

  gameForm.addEventListener("reset", () => {
    SIDES.forEach(({ key }) => {
      const elSet = SIDE_ELS.get(key);
      if (!elSet) return;
      const { player: playerEl, rating: ratingEl } = elSet;
      if (ratingEl) delete ratingEl.dataset.userSet;
      if (playerEl) {
        delete playerEl.dataset.standard;
        delete playerEl.dataset.rapid;
        delete playerEl.dataset.blitz;
      }
    });
  });

  SIDES.forEach((side) => {
    setupAutocomplete(side);
    const elSet = SIDE_ELS.get(side.key);
    if (!elSet) return;
    const { rating: ratingEl } = elSet;
    if (ratingEl) {
      ratingEl.addEventListener("input", () => {
        if (ratingEl.value.trim()) ratingEl.dataset.userSet = "true";
        else delete ratingEl.dataset.userSet;
      });
    }
  });

  formEls.time?.addEventListener("blur", ({ target }) => {
    SIDES.forEach(({ key }) => {
      const elSet = SIDE_ELS.get(key);
      if (!elSet) return;
      const { player: playerEl, rating: ratingEl } = elSet;
      if (!playerEl?.dataset.standard || ratingEl?.dataset.userSet) return;
      const cached = {
        standard: Number(playerEl.dataset.standard),
        rapid: Number(playerEl.dataset.rapid),
        blitz: Number(playerEl.dataset.blitz),
      };
      ratingEl.value = pickRating(cached, target.value) || "";
    });
  });
};

// Initialize
initNewGame();

document.addEventListener("keydown", ({ key }) => {
  if (key !== "Escape") return;
  SIDES.forEach(({ key: k }) => {
    const elSet = SIDE_ELS.get(k);
    if (elSet && elSet.suggestions) elSet.suggestions.replaceChildren();
  });
});
