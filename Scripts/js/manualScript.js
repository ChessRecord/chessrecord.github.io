// manualScript.js - Custom page controller

/* --- Initialization --- */
window.games = JSON.parse(localStorage.getItem("chessGames")) || [];

/* --- Form Submission --- */
async function addGame(event) {
  event.preventDefault();
  showLoader("#addGame span");

  const result = document.getElementById("result").value;
  if (result === "0") {
    alert("Please select a result!");
    hideLoader("#addGame span");
    return;
  }

  const playerWhite = formatName(
    capitalize(document.getElementById("playerWhite").value),
  );
  const playerBlack = formatName(
    capitalize(document.getElementById("playerBlack").value),
  );
  const whiteRating =
    parseInt(document.getElementById("whiteRating").value) || 0;
  const blackRating =
    parseInt(document.getElementById("blackRating").value) || 0;
  const time = document.getElementById("time").value || "";
  const tournament = document.getElementById("tournament").value;
  const round = parseInt(document.getElementById("round").value) || 1;
  const date = document.getElementById("date").value;

  const game = {
    id: generateUniqueID(),
    white: playerWhite,
    whiteRating: Number(whiteRating),
    whiteTitle: abbreviateTitle(
      document.getElementById("whiteTitle").value.toUpperCase(),
    ),
    black: playerBlack,
    blackRating: Number(blackRating),
    blackTitle: abbreviateTitle(
      document.getElementById("blackTitle").value.toUpperCase(),
    ),
    result: result,
    tournament: tournament,
    round: Number(round),
    time: time,
    date: date,
    gameLink: document.getElementById("gameLink").value,
  };

  if (
    window.games.some(
      (g) =>
        (g.white === playerWhite || g.black === playerBlack) &&
        g.date === date &&
        g.tournament === tournament &&
        g.round === round,
    )
  ) {
    hideLoader("#addGame span");
    alert("Game already exists or player conflict in this round!");
    return;
  }

  window.games.push(game);
  saveGames();
  event.target.reset();
  hideLoader("#addGame span");

  alert(
    `${toUnicodeVariant(game.whiteTitle, "bold sans", "sans")} ${playerWhite} vs ${toUnicodeVariant(game.blackTitle, "bold sans", "sans")} ${playerBlack} Game Added!`,
  );
}

/* --- Event Listeners & Autocomplete --- */
document.addEventListener("DOMContentLoaded", () => {
  const gameForm = document.getElementById("gameForm");
  if (gameForm) {
    gameForm.addEventListener("submit", addGame);
  }

  const playerWhite = document.getElementById("playerWhite");
  const playerBlack = document.getElementById("playerBlack");

  if (playerWhite) {
    playerWhite.addEventListener("input", async function (e) {
      const query = e.target.value;
      const suggestionsContainer = document.getElementById("whiteSuggestions");
      if (query.length > 1) {
        const suggestions = await fetchPlayerNames(query);
        showSuggestions(e.target, suggestionsContainer, suggestions);
      } else {
        suggestionsContainer.innerHTML = "";
      }
    });
  }

  if (playerBlack) {
    playerBlack.addEventListener("input", async function (e) {
      const query = e.target.value;
      const suggestionsContainer = document.getElementById("blackSuggestions");
      if (query.length > 1) {
        const suggestions = await fetchPlayerNames(query);
        showSuggestions(e.target, suggestionsContainer, suggestions);
      } else {
        suggestionsContainer.innerHTML = "";
      }
    });
  }

  /* --- Suggestion Selection --- */
  document.addEventListener("click", (e) => {
    const suggestionItem = e.target.closest(".autocomplete-suggestion");
    if (suggestionItem) {
      const container = suggestionItem.closest(".autocomplete-suggestions");
      const isWhite = container.id === "whiteSuggestions";
      const playerInput = document.getElementById(
        isWhite ? "playerWhite" : "playerBlack",
      );
      const titleElement = document.getElementById(
        isWhite ? "whiteTitle" : "blackTitle",
      );
      playerInput.value = suggestionItem.dataset.name;
      titleElement.value = suggestionItem.dataset.title;
      container.innerHTML = "";
    }
  });
});

/* --- Global Listeners --- */
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    const w = document.getElementById("whiteSuggestions");
    const b = document.getElementById("blackSuggestions");
    if (w) w.innerHTML = "";
    if (b) b.innerHTML = "";
  }
});
