// games.js - Global App Controller
// Responsible for state management, data persistence, and orchestration.

import { displayGames } from "./ui.js";
import { toUnicodeVariant } from "./utils.js";

/* ─── Global State ───────────────────────────────────────────────────────── */

window.games = JSON.parse(localStorage.getItem("chessGames")) || [];
window.searchTerm = "";

/* ─── Data Mutations ─────────────────────────────────────────────────────── */

/**
 * Persists the current games list to LocalStorage.
 */
export function saveGames() {
  try {
    localStorage.setItem("chessGames", JSON.stringify(window.games));
  } catch (error) {
    console.error("Failed to save games to LocalStorage:", error);
  }
}

/**
 * Validates and adds a new game to the database.
 * @param {Object} game - The game object to add.
 * @returns {boolean} - True if added successfully, false if duplicate.
 */
export function registerGame(game) {
  const isDuplicate = window.games.some(
    (g) =>
      g.white === game.white &&
      g.black === game.black &&
      g.date === game.date &&
      g.tournament === game.tournament &&
      g.round === game.round,
  );

  if (isDuplicate) return false;

  window.games.push(game);
  saveGames();
  return true;
}

/**
 * Deletes a game by ID after user confirmation.
 * @param {string} id - The unique ID of the game to delete.
 */
export function deleteGame(id) {
  const gameToDelete = window.games.find((game) => game.id === id);
  if (!gameToDelete) return;

  const msg = `Are you sure you want to delete:\n ${toUnicodeVariant(
    gameToDelete.whiteTitle,
    "bold sans",
    "sans",
  )} ${gameToDelete.white} vs ${toUnicodeVariant(
    gameToDelete.blackTitle,
    "bold sans",
    "sans",
  )} ${gameToDelete.black} ?`;

  if (confirm(msg)) {
    window.games = window.games.filter((game) => game.id !== id);
    saveGames();

    // Refresh the UI if on the main list page
    const gamesList = document.getElementById("gamesList");
    if (gamesList) {
      displayGames(window.searchTerm);
    }
  }
}

/* ─── Orchestration ──────────────────────────────────────────────────────── */

/**
 * Initializes the global application features (Search, State, etc.)
 */
const initApp = () => {
  // Global Search Logic
  const searchInput = document.getElementById("searchInput");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      window.searchTerm = e.target.value.trim();
      displayGames(window.searchTerm);
    });
  }

  // Initial UI Render for pages with a games list
  const gamesList = document.getElementById("gamesList");
  if (gamesList) {
    displayGames();
  }
};

// Expose mutation functions to the global scope for HTML event compatibility
window.deleteGame = deleteGame;
window.saveGames = saveGames;

// Boot the application
initApp();
