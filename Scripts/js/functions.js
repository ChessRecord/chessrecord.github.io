// Helper function to validate non-empty strings
const isValidString = (s) => typeof s === "string" && s.length > 0;

// Helper: safely convert a value to a finite number, or return fallback
const toNumberOr = (value, fallback) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

// Initialize once at script load (before any functions)
const TITLE_MAP = Object.freeze({
  grandmaster: "GM",
  internationalmaster: "IM",
  fidemaster: "FM",
  candidatemaster: "CM",
  womangrandmaster: "WGM",
  womaninternationalmaster: "WIM",
  womanfidemaster: "WFM",
  womancandidatemaster: "WCM",
  nationalmaster: "NM",
});

const TIME_CONTROL_ICONS = Object.freeze({
  Bullet: '<i class="fa-solid fa-bolt-lightning"></i><span class="gap"></span>',
  Blitz: '<i class="fa-solid fa-bolt-lightning"></i><span class="gap"></span>',
  Rapid: '<i class="fa-solid fa-clock"></i><span class="gap"></span>',
  Classical:
    '<i class="fa-solid fa-hourglass-half"></i><span class="gap"></span>',
  Unknown: "",
});

// Safely initialize special character maps with helper function
const buildSpecialMap = (startCode, rangeStart = 97, rangeEnd = 122) => {
  const map = {};
  for (let i = rangeStart; i <= rangeEnd; i++) {
    map[String.fromCharCode(i)] = startCode + (i - rangeStart);
  }
  return map;
};

const SPECIAL_P = Object.freeze(buildSpecialMap(0x249c));
const SPECIAL_W = Object.freeze(buildSpecialMap(0xff41));

function toUnicodeVariant(str, variant, flags) {
  if (!isValidString(str)) return "";
  const offsets = {
    m: [0x1d670, 0x1d7f6],
    b: [0x1d400, 0x1d7ce],
    i: [0x1d434, 0x00030],
    bi: [0x1d468, 0x00030],
    c: [0x1d49c, 0x00030],
    bc: [0x1d4d0, 0x00030],
    g: [0x1d504, 0x00030],
    d: [0x1d538, 0x1d7d8],
    bg: [0x1d56c, 0x00030],
    s: [0x1d5a0, 0x1d7e2],
    bs: [0x1d5d4, 0x1d7ec],
    is: [0x1d608, 0x00030],
    bis: [0x1d63c, 0x00030],
    o: [0x24b6, 0x2460],
    p: [0x249c, 0x2474],
    w: [0xff21, 0xff10],
    u: [0x2090, 0xff10],
  };

  const variantOffsets = {
    monospace: "m",
    bold: "b",
    italic: "i",
    "bold italic": "bi",
    script: "c",
    "bold script": "bc",
    gothic: "g",
    "gothic bold": "bg",
    doublestruck: "d",
    sans: "s",
    "bold sans": "bs",
    "italic sans": "is",
    "bold italic sans": "bis",
    parenthesis: "p",
    circled: "o",
    fullwidth: "w",
  };

  // special characters (absolute values)
  var special = {
    m: {
      " ": 0x2000,
      "-": 0x2013,
    },
    i: {
      h: 0x210e,
    },
    g: {
      C: 0x212d,
      H: 0x210c,
      I: 0x2111,
      R: 0x211c,
      Z: 0x2128,
    },
    o: {
      0: 0x24ea,
      1: 0x2460,
      2: 0x2461,
      3: 0x2462,
      4: 0x2463,
      5: 0x2464,
      6: 0x2465,
      7: 0x2466,
      8: 0x2467,
      9: 0x2468,
    },
    p: SPECIAL_P,
    w: SPECIAL_W,
  };

  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  const numbers = "0123456789";

  var getType = function (variant) {
    if (variantOffsets[variant]) return variantOffsets[variant];
    if (offsets[variant]) return variant;
    return "m"; //monospace as default
  };
  var getFlag = function (flag, flags) {
    if (!isValidString(flags)) return false;
    return flags.split(",").some((f) => f.trim() === flag);
  };

  var type = getType(variant);
  var underline = getFlag("underline", flags);
  var strike = getFlag("strike", flags);
  var result = "";

  for (var k of str) {
    let index;
    let c = k;
    if (special[type]?.[c]) {
      c = String.fromCodePoint(special[type][c]);
    }
    if (type && (index = chars.indexOf(c)) > -1) {
      result += String.fromCodePoint(index + offsets[type][0]);
    } else if (type && (index = numbers.indexOf(c)) > -1) {
      result += String.fromCodePoint(index + offsets[type][1]);
    } else {
      result += c;
    }
    if (underline) result += "\u0332"; // add combining underline
    if (strike) result += "\u0336"; // add combining strike
  }
  return result;
}
//###################################################//
//###################################################//

function saveGames() {
  localStorage.setItem("chessGames", JSON.stringify(window.games));
}

function generateUniqueID() {
  return crypto.randomUUID();
}

function capitalize(str) {
  if (!isValidString(str)) return "";

  return str
    .split(" ")
    .filter((word) => word.length > 0)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function refreshTitle() {
  document.querySelectorAll(".title").forEach(function (titleElement) {
    const content = titleElement.textContent.trim().toLowerCase();
    if (!content || content === "none") {
      titleElement.style.display = "none";
    } else {
      titleElement.style.display = ""; // Reset to default if content is valid
    }
  });
}

function getTimeControlCategory(timeControl) {
  // Normalize input to handle various formats
  const parseTimeControl = (tc) => {
    const cleanTC = String(tc).toLowerCase().replace(/\s+/g, "");

    let initialTime, increment;

    // Split time and increment
    if (cleanTC.includes("+")) {
      [initialTime, increment] = cleanTC.split("+").map(Number);
    } else if (cleanTC.includes("|")) {
      [initialTime, increment] = cleanTC.split("|").map(Number);
    } else if (cleanTC.includes("min")) {
      initialTime = Number(cleanTC.replace("min", ""));
      increment = 0;
    } else {
      initialTime = Number(cleanTC);
      increment = 0;
    }

    return { initialTime, increment };
  };

  // Classify time control based on initial time and increment
  const classifyTimeControl = (initial, increment) => {
    initial = Number(initial);
    increment = Number(increment);

    if (![initial, increment].every((n) => Number.isFinite(n) && n >= 0)) {
      return "Unknown";
    }

    // Convert everything to seconds for easier calculation
    const initialSeconds = initial * 60;
    const incrementSeconds = increment;

    // Estimated total time in seconds for a 40-move game
    const estimatedSeconds = initialSeconds + incrementSeconds * 40;

    // Convert back to minutes for classification
    const estimatedMinutes = estimatedSeconds / 60;

    // Bullet: Games expected to last less than 3 minutes
    if (initial < 3 && estimatedMinutes < 7) {
      return "Bullet";
    }

    // Blitz: Games expected to last less than 10 minutes
    if (initial < 10 && estimatedMinutes < 25) {
      return "Blitz";
    }

    // Rapid: Games expected to last less than 60 minutes
    if (initial < 30 && estimatedMinutes < 60) {
      return "Rapid";
    }

    // Classical: Games expected to last 60 minutes or more
    return "Classical";
  };

  try {
    const { initialTime, increment } = parseTimeControl(timeControl);
    return classifyTimeControl(initialTime, increment);
  } catch (error) {
    return "Unknown";
  }
}

/* AUTOCOMPLETE FUNCTIONS */
async function fetchPlayerNames(query) {
  // Setup abort controller for timeout handling
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

  try {
    // Construct and encode the API URL
    const apiUrl = `https://lichess.org/api/fide/player?q=${encodeURIComponent(query.trim())}`;
    const response = await fetch(apiUrl, { signal: controller.signal });

    // Handle unsuccessful responses
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }

    // Parse the JSON response
    const data = await response.json();
    clearTimeout(timeoutId); // Prevent timeout from firing after completion

    // Return only name and title data
    return data.map((player) => ({
      name: formatName(player.name),
      title: abbreviateTitle(player.title),
    }));
  } catch (error) {
    // Clear the timeout to prevent memory leaks
    clearTimeout(timeoutId);

    // Log the error
    console.error("Error fetching player names:", error);

    // Return an empty array on failure
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

document.addEventListener("DOMContentLoaded", () => {
  const playerWhite = document.getElementById("playerWhite");
  const playerBlack = document.getElementById("playerBlack");

  if (playerWhite) {
    playerWhite.addEventListener("input", async function (e) {
      const query = e.target.value;
      const whiteTitleElement = document.getElementById("whiteTitle");
      const suggestionsContainer = document.getElementById("whiteSuggestions");
      if (query.length > 1) {
        const suggestions = await fetchPlayerNames(query);
        showSuggestions(
          whiteTitleElement,
          e.target,
          suggestionsContainer,
          suggestions,
        );
      } else {
        suggestionsContainer.innerHTML = "";
        e.target.dataset.title = "";
      }
    });
  }

  if (playerBlack) {
    playerBlack.addEventListener("input", async function (e) {
      const query = e.target.value;
      const blackTitleElement = document.getElementById("blackTitle");
      const suggestionsContainer = document.getElementById("blackSuggestions");
      if (query.length > 1) {
        const suggestions = await fetchPlayerNames(query);
        showSuggestions(
          blackTitleElement,
          e.target,
          suggestionsContainer,
          suggestions,
        );
      } else {
        suggestionsContainer.innerHTML = "";
        e.target.dataset.title = "";
      }
    });
  }

  // Event delegation for whiteSuggestions
  const whiteSuggestions = document.getElementById("whiteSuggestions");
  if (whiteSuggestions) {
    whiteSuggestions.addEventListener("click", function (e) {
      const suggestionItem = e.target.closest(".autocomplete-suggestion");
      if (suggestionItem) {
        const playerInput = document.getElementById("playerWhite");
        const titleElement = document.getElementById("whiteTitle");
        playerInput.value = suggestionItem.dataset.name;
        titleElement.value = suggestionItem.dataset.title;
        playerInput.dataset.title = suggestionItem.dataset.title;
        this.innerHTML = "";
      }
    });
  }

  // Event delegation for blackSuggestions
  const blackSuggestions = document.getElementById("blackSuggestions");
  if (blackSuggestions) {
    blackSuggestions.addEventListener("click", function (e) {
      const suggestionItem = e.target.closest(".autocomplete-suggestion");
      if (suggestionItem) {
        const playerInput = document.getElementById("playerBlack");
        const titleElement = document.getElementById("blackTitle");
        playerInput.value = suggestionItem.dataset.name;
        titleElement.value = suggestionItem.dataset.title;
        playerInput.dataset.title = suggestionItem.dataset.title;
        this.innerHTML = "";
      }
    });
  }
});

// Add Escape key functionality to close suggestions
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  const w = document.getElementById("whiteSuggestions");
  const b = document.getElementById("blackSuggestions");
  if (w) w.innerHTML = "";
  if (b) b.innerHTML = "";
});

// Close suggestions when clicking outside
document.addEventListener("click", function (e) {
  const whiteSuggestions = document.getElementById("whiteSuggestions");
  const blackSuggestions = document.getElementById("blackSuggestions");
  const playerWhite = document.getElementById("playerWhite");
  const playerBlack = document.getElementById("playerBlack");

  if (
    whiteSuggestions &&
    playerWhite &&
    !playerWhite.contains(e.target) &&
    !whiteSuggestions.contains(e.target)
  ) {
    whiteSuggestions.innerHTML = "";
  }

  if (
    blackSuggestions &&
    playerBlack &&
    !playerBlack.contains(e.target) &&
    !blackSuggestions.contains(e.target)
  ) {
    blackSuggestions.innerHTML = "";
  }
});

/*LOADER FUNCTIONS*/
function showLoader(target) {
  const el = document.querySelector(target);
  if (!el) return;
  // Only store the old value if not already stored
  if (typeof el._oldLoaderValue === "undefined") {
    el._oldLoaderValue = el.innerHTML;
  }
  document.getElementById("loader").style.display = "inline";
  el.innerHTML = "Loading";
}

function hideLoader(target) {
  const el = document.querySelector(target);
  if (!el) return;
  document.getElementById("loader").style.display = "none";
  if (typeof el._oldLoaderValue !== "undefined") {
    el.innerHTML = el._oldLoaderValue;
    delete el._oldLoaderValue;
  }
}

function abbreviateTitle(title) {
  if (!isValidString(title)) return "";

  const normalized = title.toLowerCase().replace(/\s+/g, "");
  return TITLE_MAP[normalized] || title;
}

function formatName(name) {
  if (!isValidString(name)) return "";

  const parts = name.split(", ");
  if (parts.length !== 2) return name.trim();

  const [last, first] = parts;
  return `${first.trim()} ${last.trim()}`.trim();
}

function isEmpty(array) {
  return !array || array.length === 0;
}

function exportJSON() {
  if (
    !window.games ||
    !Array.isArray(window.games) ||
    window.games.length === 0
  ) {
    alert("No games were found in this database");
    return;
  }

  try {
    // Single pass: map and normalize in one operation
    const exportData = window.games
      .map((game) => {
        if (!game || typeof game !== "object") return null;

        const { id, ...rest } = game;
        return {
          ...rest,
          result: normalizeResult(game.result),
        };
      })
      .filter(Boolean); // Remove any null entries

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

// PGN to JSON converter for your format
function pgnToJson(pgn) {
  if (!isValidString(pgn)) return [];

  const games = pgn.split(/\n\n(?=\[Event)/).filter(Boolean);

  return games.map((game, idx) => {
    const getTag = (tag) => {
      if (!isValidString(tag)) return "";
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
  const file = input.files[0];
  if (!file) return;

  // 1. Normalizer stays the same
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

  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      let importedData;

      // 2. Parse PGN or JSON
      if (file.name.toLowerCase().endsWith(".pgn")) {
        importedData = pgnToJson(e.target.result);
      } else if (file.name.toLowerCase().endsWith(".json")) {
        const rawData = JSON.parse(e.target.result);
        if (!Array.isArray(rawData)) {
          alert("Invalid file format! Upload a valid JSON or PGN.");
          return;
        }
        importedData = rawData.map(normalizeGame);
      } else {
        alert("Invalid file format! Upload a valid JSON or PGN.");
        return;
      }

      // 3. Empty‑array guard
      if (isEmpty(importedData)) {
        alert("No games were found in this database");
        return;
      }

      // 4. 🚀 Optimized missing‑link check
      if (importedData.some((game) => !game.gameLink)) {
        alert(
          "Import failed: Some games are missing a game link (URL). Please ensure every game includes a valid link before importing.",
        );
        input.value = "";
        return;
      }

      // 5. If no existing games, replace outright
      if (isEmpty(window.games)) {
        importedData.forEach((game) => (game.id = generateUniqueID()));
        window.games = importedData;
        saveGames();
        displayGames();
        alert("Games imported successfully!");
        input.value = "";
        return;
      }

      // 6. Otherwise, show replace/append modal
      const blur = document.getElementById("blur");
      if (blur) {
        const hideModal = () => {
          blur.classList.replace("visible", "hidden");
          blur.innerHTML = "";
        };

        blur.classList.replace("hidden", "visible");
        blur.innerHTML = `
          <div class="confirmation">
            <div class="cancel" id="cancelBtn" title="Cancel">&times;</div>
            <i class="fa-solid fa-triangle-exclamation warning-big"></i>
            <h3>Do you want to replace or append your games?</h3>
            <div class="options">
              <button class="btn outline" id="replaceBtn">Replace</button>
              <button class="btn" id="appendBtn">Append</button>
            </div>
          </div>
        `;

        const handler = function (e) {
          if (e.target.id === "replaceBtn") {
            importedData.forEach((game) => (game.id = generateUniqueID()));
            window.games = importedData;
            saveGames();
            displayGames();
            alert("Games replaced successfully!");
          } else if (e.target.id === "appendBtn") {
            importedData.forEach((game) => (game.id = generateUniqueID()));
            window.games.push(...importedData);
            saveGames();
            displayGames();
            alert("Games appended successfully!");
          }
          // Always close — handles Replace, Append, Cancel, and backdrop clicks
          hideModal();
          input.value = "";
        };

        blur.addEventListener("click", handler, { once: true });
      }
    } catch (error) {
      alert("Error parsing JSON or PGN file!");
      console.error(error);
    } finally {
      // 7. Always clear the input
      input.value = "";
    }
  };

  reader.readAsText(file);
}

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

function displayGames(searchTerm = window.currentSearchTerm || "") {
  const gamesList = document.getElementById("gamesList");
  if (!gamesList) return;

  const gameCountElement = document.getElementById("game-count");
  const tournamentCountElement = document.getElementById("tournament-count");
  if (!gameCountElement || !tournamentCountElement) return;

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

  const normalizedSearchTerm = searchTerm.trim().toLowerCase();

  const filteredGames = window.games
    .filter(
      (game) =>
        (game.white || "").toLowerCase().includes(normalizedSearchTerm) ||
        (game.black || "").toLowerCase().includes(normalizedSearchTerm) ||
        (game.tournament || "").toLowerCase().includes(normalizedSearchTerm),
    )
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  // Group games by tournament
  const gamesByTournament = filteredGames.reduce((acc, game) => {
    if (!acc[game.tournament]) {
      acc[game.tournament] = [];
    }
    acc[game.tournament].push(game);
    return acc;
  }, {});

  // Sort each tournament's games by round number, then board number
  Object.values(gamesByTournament).forEach((gamesArr) => {
    gamesArr.sort((a, b) => {
      const roundDiff = (a.round || 0) - (b.round || 0);
      if (roundDiff !== 0) return roundDiff;
      if (a.board == null && b.board == null) return 0;
      if (a.board == null) return -1;
      if (b.board == null) return 1;
      return a.board - b.board;
    });
  });

  // Batch DOM updates using DocumentFragment
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
      // Validate game object
      if (!game || typeof game !== "object") return;

      const a = document.createElement("a");
      a.href = game.gameLink || "#";
      if (game.gameLink) a.target = "_blank";
      a.className = "game-entry-link";

      const category = getTimeControlCategory(game.time);
      const timeIcon =
        TIME_CONTROL_ICONS[category] || TIME_CONTROL_ICONS["Unknown"];

      let timeDisplay = "";
      if (game.time) {
        if (category === "Unknown") {
          timeDisplay = `${game.time}`;
        } else {
          timeDisplay = `${game.time}<span class="timecontrol-category"> • ${category}</span>`;
        }
      }

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

function formatResult(result) {
  if (!isValidString(result)) return "*";

  const cleaned = result.trim().replace(/½/g, "1/2").replace(/\s+/g, "");

  switch (cleaned) {
    case "1-0":
      return "1 - 0";
    case "0-1":
      return "0 - 1";
    case "1/2-1/2":
      return "½ - ½";
    default:
      return result.trim(); // fallback to original (trimmed)
  }
}

function normalizeResult(result) {
  if (!isValidString(result)) return "*";

  const cleaned = result
    .trim()
    .replace(/½/g, "1/2") // Convert fancy fractions to plain
    .replace(/\s+/g, ""); // Remove all whitespace

  switch (cleaned) {
    case "1-0":
    case "0-1":
    case "1/2-1/2":
      return cleaned;
    default:
      return "*";
  }
}
