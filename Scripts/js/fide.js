// fide.js — FIDE page controller

/* ─── Initialization ─────────────────────────────────────────────────────── */

window.games = JSON.parse(localStorage.getItem("chessGames")) || [];

const FIDE_API = "https://lichess.org/api/fide/player/";

/* ─── API ────────────────────────────────────────────────────────────────── */

async function fetchFidePlayer(id) {
  if (!id || isNaN(id)) throw new Error(`Invalid FIDE ID: ${id}`);
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
    return {
      name: formatName(capitalize(name)),
      title: abbreviateTitle(title),
      standard,
      rapid,
      blitz,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function pickRating({ standard, rapid, blitz }, time) {
  return (
    { Classical: standard, Rapid: rapid, Blitz: blitz }[
      getTimeControlCategory(time)
    ] ?? standard
  );
}

/* ─── Player & Game Helpers ──────────────────────────────────────────────── */

async function resolvePlayers(time) {
  const getId = (id) => parseInt(document.getElementById(id).value.trim());

  const [whiteData, blackData] = await Promise.all([
    fetchFidePlayer(getId("whiteFIDE")),
    fetchFidePlayer(getId("blackFIDE")),
  ]);

  return {
    white: { ...whiteData, rating: pickRating(whiteData, time) },
    black: { ...blackData, rating: pickRating(blackData, time) },
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
  document.getElementById("gameForm")?.addEventListener("submit", addGame);
});
