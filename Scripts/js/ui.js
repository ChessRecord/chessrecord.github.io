// ui.js - Global UI behaviors (Dropdowns, etc.)
import {
  getTimeControlCategory,
  TIME_CONTROL_ICONS,
  formatResult,
} from "./utils.js";

/* --- Dropdown Logic --- */
export const hideDropdown = () => {
  const dropdown = document.querySelector(".dropdown");
  if (dropdown) dropdown.classList.remove("show");
};

export const showDropdown = () => {
  const dropdown = document.querySelector(".dropdown");
  if (dropdown) dropdown.classList.toggle("show");
};

/* --- Global UI Initializer --- */
export const initGlobalUI = () => {
  const optionsButton = document.querySelector(".options");
  const dropdown = document.querySelector(".dropdown");

  if (optionsButton) {
    optionsButton.removeEventListener("click", onOptionsClick);
    optionsButton.addEventListener("click", onOptionsClick);
  }

  if (dropdown) {
    document.removeEventListener("click", onDocumentClick);
    document.addEventListener("click", onDocumentClick);
  }
};

const onOptionsClick = (e) => {
  e.stopPropagation();
  showDropdown();
};

const onDocumentClick = (e) => {
  const dropdown = document.querySelector(".dropdown");
  if (dropdown && !dropdown.contains(e.target)) {
    hideDropdown();
  }
};

/* --- Rendering Logic --- */

export function refreshTitle() {
  document.querySelectorAll(".title").forEach(function (titleElement) {
    const content = titleElement.textContent.trim().toLowerCase();
    if (!content || content === "none") {
      titleElement.style.display = "none";
    } else {
      titleElement.style.display = "";
    }
  });
}

export function displayGames(searchTerm = window.searchTerm || "") {
  const gamesList = document.getElementById("gamesList");
  if (!gamesList) return;

  const gameCountElement = document.getElementById("game-count");
  const tournamentCountElement = document.getElementById("tournament-count");
  if (gameCountElement && tournamentCountElement) {
    const gameCount = window.games.length;
    const tournamentCount = new Set(window.games.map((game) => game.tournament))
      .size;
    gameCountElement.innerHTML =
      gameCount === 0
        ? "No Games"
        : `${gameCount} ${gameCount === 1 ? "Game" : "Games"}`;
    tournamentCountElement.innerHTML =
      tournamentCount === 0
        ? ""
        : `${tournamentCount} ${tournamentCount === 1 ? "Event" : "Events"}`;
  }

  const normalizedSearchTerm = searchTerm.trim().toLowerCase();
  const filteredGames = window.games
    .filter(
      (game) =>
        (game.white || "").toLowerCase().includes(normalizedSearchTerm) ||
        (game.black || "").toLowerCase().includes(normalizedSearchTerm) ||
        (game.tournament || "").toLowerCase().includes(normalizedSearchTerm),
    )
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const gamesByTournament = filteredGames.reduce((acc, game) => {
    if (!acc[game.tournament]) acc[game.tournament] = [];
    acc[game.tournament].push(game);
    return acc;
  }, {});

  Object.values(gamesByTournament).forEach((gamesArr) => {
    gamesArr.sort((a, b) => {
      const roundDiff = (a.round ?? 0) - (b.round ?? 0);
      if (roundDiff !== 0) return roundDiff;
      if (a.board == null && b.board == null) return 0;
      if (a.board == null) return -1;
      if (b.board == null) return 1;
      return a.board - b.board;
    });
  });

  const fragment = document.createDocumentFragment();
  Object.entries(gamesByTournament).forEach(([tournament, tournamentGames]) => {
    const section = document.createElement("div");
    section.className = "tournament-section";
    section.innerHTML = `
      <div class="tournament-header">
        <h3>${tournament}</h3>
        <h3 class="dot">●</h3>
      </div>
    `;
    tournamentGames.forEach((game) => {
      const a = document.createElement("a");
      a.href = game.gameLink || "#";
      if (game.gameLink) a.target = "_blank";
      a.className = "game-entry-link";

      const category = getTimeControlCategory(game.time);
      const timeIcon =
        TIME_CONTROL_ICONS[category] || TIME_CONTROL_ICONS["Unknown"];
      let timeDisplay = game.time
        ? category === "Unknown"
          ? `${game.time}`
          : `${game.time}<span class="timecontrol-category"> • ${category}</span>`
        : "";
      const dateString = game.date ? ` | <strong>${game.date}</strong>` : "";
      const roundLabel =
        game.board != null ? `Board ${game.board}` : `Round ${game.round}`;

      a.innerHTML = `
        <div class="game-entry" data-game-id="${game.id || "unknown"}">
          <div class="game-details" style="align-items: center;">
          <div class="game-tournament"><span class="game-round">${game.round}</span><strong>${roundLabel}</strong></div>
            <span class="entry-meta">
              <span class="game-time">
                ${timeIcon}
                ${timeDisplay}
              </span>${dateString}
            </span>
          </div>
          <div class="player-details">
            <div class="player-left">
              <span>
                <span class="title">${game.whiteTitle || ""}</span> ${game.white || "Unknown"} <span class="player-rating">${game.whiteRating || 0}</span>
              </span>
            </div>
            <div class="game-result">
              <strong>${formatResult(game.result)}</strong>
            </div>
            <div class="player-right">
              <span>
                <span class="title">${game.blackTitle || ""}</span> ${game.black || "Unknown"} <span class="player-rating">${game.blackRating || 0}</span>
              </span>
            </div>
          </div>
          <button class="delete-game-btn" data-delete-id="${game.id || "unknown"}">
            <span class="fontawesome"></span>
          </button>
        </div>
      `;
      section.appendChild(a);
    });
    fragment.appendChild(section);
  });
  gamesList.innerHTML = "";
  gamesList.appendChild(fragment);

  // Attach event listeners for delete buttons (delegated to window.deleteGame)
  document.querySelectorAll(".delete-game-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      window.deleteGame(btn.dataset.deleteId);
    });
  });

  refreshTitle();
}

// Attach to window for compatibility
window.displayGames = displayGames;

// Call initializer
initGlobalUI();
