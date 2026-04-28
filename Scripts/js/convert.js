// convert.js - PGN to JSON converter page controller

// PGN to JSON converter for your format
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

window.addEventListener("DOMContentLoaded", function () {
  const form = document.getElementById("PGN-Form");
  const textarea = document.getElementById("PGN");

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    const pgn = textarea.value.trim();
    if (!pgn) {
      alert("Please enter a PGN value.");
      return;
    }

    // Using global pgnToJson from functions.js
    const json = pgnToJson(pgn);
    if (isEmpty(json)) {
      alert("No valid games found in PGN.");
      return;
    }

    const formatted = JSON.stringify(json, null, 2);

    // Extract event name for filename
    let eventName = (pgn.match(/\[Event "([^"]*)"\]/) || [, "chess_event"])[1];
    if (eventName.includes(":")) {
      eventName = eventName.substring(0, eventName.lastIndexOf(":")).trim();
    }
    eventName = eventName.replace(/[^a-z0-9\-_ ]/gi, "_");
    const filename = eventName + ".json";

    const blob = new Blob([formatted], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  });
});
