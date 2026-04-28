// functions.js - Feature-specific logic (Import/Export, Rendering, Autocomplete)

function saveGames() {
  localStorage.setItem("chessGames", JSON.stringify(window.games));
}

function refreshTitle() {
  document.querySelectorAll(".title").forEach(function (titleElement) {
    const content = titleElement.textContent.trim().toLowerCase();
    if (!content || content === "none") {
      titleElement.style.display = "none";
    } else {
      titleElement.style.display = "";
    }
  });
}

/* --- Autocomplete Functions --- */
async function fetchPlayerNames(query) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);
  try {
    const apiUrl = `https://lichess.org/api/fide/player?q=${encodeURIComponent(query.trim())}`;
    const response = await fetch(apiUrl, { signal: controller.signal });
    if (!response.ok)
      throw new Error(`API request failed with status ${response.status}`);
    const data = await response.json();
    clearTimeout(timeoutId);
    return data.map((player) => ({
      name: formatName(player.name),
      title: abbreviateTitle(player.title),
    }));
  } catch (error) {
    clearTimeout(timeoutId);
    console.error("Error fetching player names:", error);
    return [];
  }
}

function highlightMatch(text, query) {
  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escapedQuery})`, "gi");
  return text.replace(regex, '<span style="font-weight: 700;">$1</span>');
}

function showSuggestions(inputElement, suggestionsContainer, suggestions) {
  const query = inputElement.value.trim();
  suggestionsContainer.innerHTML = "";
  suggestions.forEach((player) => {
    const suggestionItem = document.createElement("div");
    suggestionItem.classList.add("autocomplete-suggestion");
    const highlightedName = highlightMatch(player.name, query);
    const displayText = player.title
      ? `<span class="title">${player.title}</span> ${highlightedName}`
      : highlightedName;
    suggestionItem.innerHTML = displayText;
    suggestionItem.dataset.name = player.name;
    suggestionItem.dataset.title = player.title || "";
    suggestionsContainer.appendChild(suggestionItem);
  });
}

/* --- Data Import / Export --- */
function exportJSON() {
  if (isEmpty(window.games)) {
    alert("No games were found in this database");
    return;
  }
  try {
    const exportData = window.games
      .map((game) => {
        if (!game || typeof game !== "object") return null;
        const { id, ...rest } = game;
        return { ...rest, result: normalizeResult(game.result) };
      })
      .filter(Boolean);

    if (exportData.length === 0) {
      alert("No valid games found to export");
      return;
    }
    const jsonData = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonData], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `ChessGamesBackup_${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  } catch (error) {
    console.error("Export failed:", error);
    alert("Failed to export games. Please try again.");
  }
}

function pgnToJson(pgn) {
  if (!isValidString(pgn)) return [];
  const games = pgn.split(/\n\n(?=\[Event)/).filter(Boolean);
  return games.map((game, idx) => {
    const getTag = (tag) => {
      const match = game.match(new RegExp(`\\[${tag}\\s"([^"]*)"\\]`));
      return match?.[1] ?? "";
    };
    const resultStr = getTag("Result").trim();
    const normalizedResult = resultStr === "1/2-1/2" ? "½-½" : resultStr;
    const roundParts = getTag("Round").split(".");
    return {
      white: getTag("White").trim() || "Unknown",
      whiteRating: Math.max(0, toNumberOr(getTag("WhiteElo"), 0)),
      whiteTitle: getTag("WhiteTitle").trim() || "",
      black: getTag("Black").trim() || "Unknown",
      blackRating: Math.max(0, toNumberOr(getTag("BlackElo"), 0)),
      blackTitle: getTag("BlackTitle").trim() || "",
      result: normalizedResult,
      tournament:
        (getTag("StudyName") || getTag("Event")).trim().split(":").pop() ||
        "Unknown",
      round: Math.max(1, toNumberOr(roundParts[0] || NaN, idx + 1)),
      board:
        toNumberOr(getTag("Board"), 0) || toNumberOr(roundParts[1], 0) || null,
      time: getTag("TimeControl").trim() || "*",
      date: getTag("Date")?.replace(/\./g, "-") || "",
      gameLink: getTag("ChapterURL") || getTag("Site") || "",
    };
  });
}

function importJSON(event) {
  const input = event.target;
  if (!input.files || input.files.length === 0) return;

  const normalizeGame = (game, idx = 0) => ({
    white: (game.white || "").trim(),
    whiteRating: Math.max(0, toNumberOr(game.whiteRating, 0)),
    whiteTitle: (game.whiteTitle || "").trim(),
    black: (game.black || "").trim(),
    blackRating: Math.max(0, toNumberOr(game.blackRating, 0)),
    blackTitle: (game.blackTitle || "").trim(),
    result: (game.result || "*").trim(),
    tournament: (game.tournament || "").trim(),
    round: Math.max(1, toNumberOr(game.round, idx + 1)),
    board: toNumberOr(game.board, 0) || null,
    time: (game.time || "").trim(),
    date: (game.date || "").replace(/\./g, "-"),
    gameLink: (game.gameLink || "").trim(),
  });

  const finalize = async (importedData) => {
    try {
      if (isEmpty(importedData)) {
        alert("No games were found in this database");
        return;
      }
      if (importedData.some((game) => !game.gameLink)) {
        alert(
          "Import failed: Some games are missing a game link (URL). Please ensure every game includes a valid link before importing.",
        );
        return;
      }
      if (isEmpty(window.games)) {
        importedData.forEach((game) => (game.id = generateUniqueID()));
        window.games = importedData;
        saveGames();
        displayGames();
        alert("Games imported successfully!");
      } else {
        const choice = await Modal.confirm({
          icon: "fa-solid fa-triangle-exclamation warning-big",
          title: "Do you want to replace or append your games?",
          buttons: [
            { action: "replace", label: "Replace", classes: "btn outline" },
            { action: "append", label: "Append", classes: "btn" },
          ],
        });
        if (choice === "replace") {
          importedData.forEach((game) => (game.id = generateUniqueID()));
          window.games = importedData;
          saveGames();
          displayGames();
          alert("Games replaced successfully!");
        } else if (choice === "append") {
          importedData.forEach((game) => (game.id = generateUniqueID()));
          window.games.push(...importedData);
          saveGames();
          displayGames();
          alert("Games appended successfully!");
        }
      }
    } catch (error) {
      alert("Error parsing JSON or PGN file!");
    } finally {
      input.value = "";
    }
  };

  const readNext = (index, accumulated) => {
    if (index === input.files.length) {
      finalize(accumulated);
      return;
    }
    const file = input.files[index];
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        let parsed;
        if (file.name.toLowerCase().endsWith(".pgn")) {
          parsed = pgnToJson(e.target.result);
        } else if (file.name.toLowerCase().endsWith(".json")) {
          const rawData = JSON.parse(e.target.result);
          if (!Array.isArray(rawData)) {
            alert("Invalid file format! Upload a valid JSON or PGN.");
            input.value = "";
            return;
          }
          parsed = rawData.map(normalizeGame);
        } else {
          alert("Invalid file format! Upload a valid JSON or PGN.");
          input.value = "";
          return;
        }
        readNext(index + 1, accumulated.concat(parsed));
      } catch (error) {
        alert("Error parsing JSON or PGN file!");
        input.value = "";
      }
    };
    reader.onerror = () => {
      alert("Error parsing JSON or PGN file!");
      input.value = "";
    };
    reader.readAsText(file);
  };

  readNext(0, []);
}

/* --- Rendering Logic --- */
function deleteGame(id) {
  const gameToDelete = window.games.find((game) => game.id === id);
  if (!gameToDelete) return;
  const delete_confirmation = `Are you sure you want to delete:\n ${toUnicodeVariant(
    gameToDelete.whiteTitle,
    "bold sans",
    "sans",
  )} ${gameToDelete.white} vs ${toUnicodeVariant(
    gameToDelete.blackTitle,
    "bold sans",
    "sans",
  )} ${gameToDelete.black} ?`;
  if (confirm(delete_confirmation)) {
    window.games = window.games.filter((game) => game.id !== id);
    saveGames();
    displayGames();
  }
}

function displayGames(searchTerm = window.searchTerm || "") {
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
          <button class="delete-game-btn" onclick="event.stopPropagation(); event.preventDefault(); deleteGame('${game.id || "unknown"}')">
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
  refreshTitle();
}
