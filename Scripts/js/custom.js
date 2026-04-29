// custom.js — Custom page controller

/* ─── Initialization ─────────────────────────────────────────────────────── */

window.games = JSON.parse(localStorage.getItem("chessGames")) || [];

const FIDE_SEARCH_API = "https://lichess.org/api/fide/player";

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
    return data.map((p) => ({
      name: formatName(p.name),
      title: abbreviateTitle(p.title),
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
  suggestions.forEach(({ name, title }) => {
    const item = document.createElement("div");
    item.className = "autocomplete-suggestion";
    item.innerHTML = `${title ? `<span class="title">${title}</span> ` : ""}${highlightMatch(name, query)}`;
    item.dataset.name = name;
    item.dataset.title = title || "";
    container.appendChild(item);
  });
}

function setupAutocomplete(inputId, containerId, titleId) {
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
    }
  });

  container.addEventListener("click", ({ target }) => {
    const item = target.closest(".autocomplete-suggestion");
    if (!item) return;
    input.value = item.dataset.name;
    titleInput.value = item.dataset.title;
    container.innerHTML = "";
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
  document.getElementById("gameForm")?.addEventListener("submit", addGame);
  setupAutocomplete("playerWhite", "whiteSuggestions", "whiteTitle");
  setupAutocomplete("playerBlack", "blackSuggestions", "blackTitle");
});

document.addEventListener("keydown", ({ key }) => {
  if (key !== "Escape") return;
  ["whiteSuggestions", "blackSuggestions"].forEach((id) => {
    document.getElementById(id)?.replaceChildren();
  });
});
