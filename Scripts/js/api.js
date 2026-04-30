// api.js - Data persistence and import/export logic
import { Modal } from "./modal.js";
import { displayGames } from "./ui.js";
import {
  isEmpty,
  generateUniqueID,
  toNumberOr,
  isValidString,
  normalizeResult,
} from "./utils.js";
import { saveGames } from "./games.js";

export function pgnToJson(pgn) {
  if (!isValidString(pgn)) return [];
  const games = pgn.split(/\n\n(?=\[Event)/).filter(Boolean);
  return games.map((game, idx) => {
    const getTag = (tag) => {
      const match = game.match(new RegExp(`\\[${tag}\\s"([^"]*)"\\]`));
      return match?.[1] ?? "";
    };
    const resultStr = getTag("Result").trim();
    const normalizedResultValue = resultStr === "1/2-1/2" ? "½-½" : resultStr;
    const roundParts = getTag("Round").split(".");
    return {
      white: getTag("White").trim() || "Unknown",
      whiteRating: Math.max(0, toNumberOr(getTag("WhiteElo"), 0)),
      whiteTitle: getTag("WhiteTitle").trim() || "",
      black: getTag("Black").trim() || "Unknown",
      blackRating: Math.max(0, toNumberOr(getTag("BlackElo"), 0)),
      blackTitle: getTag("BlackTitle").trim() || "",
      result: normalizedResultValue,
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

export function exportJSON() {
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
    link.download = `ChessRecord_${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  } catch (error) {
    console.error("Export failed:", error);
    alert("Failed to export games. Please try again.");
  }
}

export function importJSON(event) {
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

// Attach to window for HTML onclick compatibility
window.exportJSON = exportJSON;
window.importJSON = importJSON;
window.saveGames = saveGames;
