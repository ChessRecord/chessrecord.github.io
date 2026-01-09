function toUnicodeVariant(str, variant, flags) {
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
    p: {},
    w: {},
  };
  //support for parenthesized latin letters small cases
  for (var i = 97; i <= 122; i++) {
    special.p[String.fromCharCode(i)] = 0x249c + (i - 97);
  }
  //support for full width latin letters small cases
  for (var i = 97; i <= 122; i++) {
    special.w[String.fromCharCode(i)] = 0xff41 + (i - 97);
  }

  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  const numbers = "0123456789";

  var getType = function (variant) {
    if (variantOffsets[variant]) return variantOffsets[variant];
    if (offsets[variant]) return variant;
    return "m"; //monospace as default
  };
  var getFlag = function (flag, flags) {
    if (!flags) return false;
    return flags.split(",").indexOf(flag) > -1;
  };

  var type = getType(variant);
  var underline = getFlag("underline", flags);
  var strike = getFlag("strike", flags);
  var result = "";

  for (var k of str) {
    let index;
    let c = k;
    if (special[type] && special[type][c])
      c = String.fromCodePoint(special[type][c]);
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
  let capitalizedStr = "";
  let words = str.split(" ");
  for (let i = 0; i < words.length; i++) {
    let word = words[i].toLowerCase();
    capitalizedStr += word.charAt(0).toUpperCase() + word.slice(1) + " ";
  }
  return capitalizedStr.trim();
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
    if (!initial || isNaN(initial) || initial < 0) return "Unknown";
    if (isNaN(increment) || increment < 0) return "Unknown";
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

function showSuggestions(
  titleElement,
  inputElement,
  suggestionsContainer,
  suggestions,
) {
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
document.addEventListener("keydown", function (e) {
  if (e.key === "Escape") {
    document.getElementById("whiteSuggestions").innerHTML = "";
    document.getElementById("blackSuggestions").innerHTML = "";
  }
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
  // Only store the old value if not already stored
  if (typeof el._oldLoaderValue === "undefined") {
    el._oldLoaderValue = el.innerHTML;
  }
  document.getElementById("loader").style.display = "inline";
  el.innerHTML = "Loading";
}

function hideLoader(target) {
  const el = document.querySelector(target);
  document.getElementById("loader").style.display = "none";
  if (typeof el._oldLoaderValue !== "undefined") {
    el.innerHTML = el._oldLoaderValue;
    delete el._oldLoaderValue;
  }
}

function abbreviateTitle(title) {
  if (!title) return ""; // Ensure empty input doesn't cause errors

  const titleMap = {
    grandmaster: "GM",
    internationalmaster: "IM",
    fidemaster: "FM",
    candidatemaster: "CM",
    womangrandmaster: "WGM",
    womaninternationalmaster: "WIM",
    womanfidemaster: "WFM",
    womancandidatemaster: "WCM",
    nationalmaster: "NM",
  };

  return titleMap[title.toLowerCase().replace(/\s+/g, "")] || title;
}

function formatName(name) {
  let parts = name.split(", ").map((part) => part.trim());
  return parts.length === 2 ? `${parts[1]} ${parts[0]}` : name;
}

function isEmpty(array) {
  return !array || array.length === 0;
}

function exportJSON() {
  if (isEmpty(window.games)) {
    alert("No games were found in this database");
    return;
  }

  // Create a new array with the required modifications
  const dataInitial = window.games.map((game) => {
    const { id, ...rest } = game;
    return {
      ...rest,
      result: normalizeResult(game.result),
    };
  });

  // Convert the modified array to a JSON string
  const data = JSON.stringify(dataInitial, null, 2);

  // Create a Blob from the JSON string
  const blob = new Blob([data], { type: "application/json" });

  // Create a link element
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `ChessGamesBackup.json`;

  // Trigger the download
  link.click();

  // Clean up
  URL.revokeObjectURL(link.href);
}

// PGN to JSON converter for your format
function pgnToJson(pgn) {
  const games = pgn.split(/\n\n(?=\[Event )/).filter(Boolean);
  return games.map((game, idx) => {
    const getTag = (tag) => {
      const match = game.match(new RegExp(`\\[${tag} "([^"]*)"\\]`));
      return match ? match[1] : "";
    };
    let resultStr = getTag("Result").trim();
    if (resultStr === "1/2-1/2") resultStr = "½-½";
    return {
      white: (getTag("White") || "").trim(),
      whiteRating: Number(getTag("WhiteElo")) || 0,
      whiteTitle: getTag("WhiteTitle").trim() || "",
      black: (getTag("Black") || "").trim(),
      blackRating: Number(getTag("BlackElo")) || 0,
      blackTitle: getTag("BlackTitle").trim() || "",
      result: resultStr,
      tournament:
        getTag("StudyName").trim() ||
        getTag("Event").trim().split(":").slice(-1)[0],
      round: Number(getTag("Round").trim()) || idx + 1,
      time: getTag("TimeControl").trim(),
      date: getTag("Date") ? getTag("Date").replace(/\./g, "-") : "",
      gameLink: getTag("ChapterURL") || getTag("Site"),
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
    whiteRating: Number(game.whiteRating) || 0,
    whiteTitle: (game.whiteTitle || "").trim(),
    black: (game.black || "").trim(),
    blackRating: Number(game.blackRating) || 0,
    blackTitle: (game.blackTitle || "").trim(),
    result: (game.result || "*").trim(),
    tournament: (game.tournament || "").trim(),
    round: Number(game.round) || idx + 1,
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
  let gameToDelete = window.games.find((game) => game.id === id);
  let delete_confirmation = `Are you sure you want to delete:\n ${toUnicodeVariant(
    gameToDelete.whiteTitle,
    "bold sans",
    "sans",
  )} ${gameToDelete.white} vs ${toUnicodeVariant(
    gameToDelete.blackTitle,
    "bold sans",
    "sans",
  )} ${gameToDelete.black} ?`;
  if (confirm(delete_confirmation) == true) {
    window.games = window.games.filter((game) => game.id !== id);
    saveGames();
    displayGames();
  }
}

function displayGames(searchTerm = "") {
  const gamesList = document.getElementById("gamesList");
  const gameCountElement = document.getElementById("game-count");
  const tournamentCountElement = document.getElementById("tournament-count");
  if (!gamesList) {
    return;
  }

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
      : `${tournamentCount} ${tournamentCount === 1 ? "Tournament" : "Tournaments"}`;

  const normalizedSearchTerm = searchTerm.trim().toLowerCase();

  const filteredGames = window.games
    .filter(
      (game) =>
        game.white.toLowerCase().includes(normalizedSearchTerm) ||
        game.black.toLowerCase().includes(normalizedSearchTerm) ||
        game.tournament.toLowerCase().includes(normalizedSearchTerm),
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

  // Sort each tournament's games by round number
  Object.values(gamesByTournament).forEach((gamesArr) => {
    gamesArr.sort((a, b) => (a.round || 0) - (b.round || 0));
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
      const a = document.createElement("a");
      a.href = game.gameLink;
      a.target = "_blank";
      a.className = "game-entry-link";
      const category = getTimeControlCategory(game.time);
      a.innerHTML = `
        <div class="game-entry" data-game-id="${game.id}">
            <div class="game-details" style="align-items: center;">
                <div class="game-tournament"><span class="game-round">${game.round}</span><strong>Round ${game.round}</strong></div>
                <span class="entry-meta">
                  <span class="game-time">
                  ${(() => {
                    switch (category) {
                      case "Blitz":
                        return '<i class="fa-solid fa-bolt-lightning"></i><span class="gap"></span>';
                      case "Rapid":
                        return '<i class="fa-solid fa-clock"></i><span class="gap"></span>';
                      case "Classical":
                        return '<i class="fa-solid fa-hourglass-half"></i><span class="gap"></span>';
                      default:
                        return "";
                    }
                  })()}
                  ${(() => {
                    if (!game.time) return "</span>";
                    return category === "Unknown"
                      ? `${game.time} </span>`
                      : `${game.time}<span class="timecontrol-category"> • ${category}</span></span>`;
                  })()}
                  ${game.date ? ` | <strong>${game.date}</strong>` : ""}
                </span>
            </div>
            <div class="player-details">
              <div class="player-left">
                    <span>
                        <span class="title">${game.whiteTitle}</span> ${game.white} <span class="player-rating">${game.whiteRating}</span>
                    </span>
              </div>
              <div class="game-result">
                <strong>${formatResult(game.result)}</strong>
              </div>
              <div class="player-right">
                <span>
                  <span class="title">${game.blackTitle}</span> ${game.black} <span class="player-rating">${game.blackRating}</span>
                </span>
              </div>
            </div>
            <button class="delete-game-btn" onclick="event.stopPropagation(); event.preventDefault(); deleteGame('${game.id}')">
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
  if (!result || typeof result !== "string") return "*";

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
  if (!result || typeof result !== "string") return "*";

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
