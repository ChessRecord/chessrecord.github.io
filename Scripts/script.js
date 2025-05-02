// Attach games to the global window object
window.games = JSON.parse(localStorage.getItem("chessGames")) || [];

document.addEventListener("DOMContentLoaded", () => {
  const gameForm = document.getElementById("gameForm");
  if (gameForm) {
    gameForm.addEventListener("submit", addGame);
  }
});

/*API REQUEST INFO*/
const LOADER_CONFIG = {
  TIMEOUT_MS: 5000,
  API_URL: 'https://lichess.org/api/fide/player/',
};
/*API REQUEST */
async function fide_api(FIDE) {
  if (!FIDE || isNaN(FIDE)) return ["N/A", ""];

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), LOADER_CONFIG.TIMEOUT_MS);

  try {
    const apiUrl = `${LOADER_CONFIG.API_URL}${FIDE}`;
    const response = await fetch(apiUrl, { signal: controller.signal });

    if (!response.ok) throw new Error(`API request failed with status ${response.status}`);

    const data = await response.json();
    clearTimeout(timeoutId); // Prevent timeout from firing after completion

    return [
      data.name || "N/A",
      data.title || "",
      data.standard || 0,
      data.rapid || 0,
      data.blitz || 0,
    ];
  } catch (error) {
    console.error("Error fetching data:", error);
    return ["N/A", "", 0, 0, 0];
  }
}

async function addGame(event) {
  event.preventDefault(); // Prevent form submission
  showLoader();

  const whiteFIDE = parseInt(document.getElementById("whiteFIDE").value.trim());
  const blackFIDE = parseInt(document.getElementById("blackFIDE").value.trim());

  if (isNaN(whiteFIDE) || isNaN(blackFIDE)) {
    hideLoader();
    alert("Invalid FIDE ID(s). Please enter a valid ID.");
    return;
  }

  const result = document.getElementById("result").value;

  if (result === "0") {
    alert("Please select a result!");
    hideLoader();
    return;
  }

  try {
    let [playerWhite, whiteTitle, whiteStandard, whiteRapid, whiteBlitz] = await fide_api(whiteFIDE);
    let [playerBlack, blackTitle, blackStandard, blackRapid, blackBlitz] = await fide_api(blackFIDE);

    if (playerWhite === "N/A" && playerBlack === "N/A") {
      hideLoader();
      alert("Both players have invalid FIDE IDs. Please try again.");
      return;
    }
    if (playerWhite === "N/A") {
      hideLoader();
      alert("Invalid FIDE ID for White player. Please try again.");
      return;
    }
    if (playerBlack === "N/A") {
      hideLoader();
      alert("Invalid FIDE ID for Black player. Please try again.");
      return;
    }

    whiteTitle = abbreviateTitle(whiteTitle);
    blackTitle = abbreviateTitle(blackTitle);

    playerWhite = formatName(capitalize(playerWhite));
    playerBlack = formatName(capitalize(playerBlack));

    const time = document.getElementById("time").value || "";

    let whiteRating = 0;
    let blackRating = 0;

    if (getTimeControlCategory(time) === "Classical") {
      whiteRating = whiteStandard;
      blackRating = blackStandard;
    } else if (getTimeControlCategory(time) === "Rapid") {
      whiteRating = whiteRapid;
      blackRating = blackRapid;
    } else if (getTimeControlCategory(time) === "Blitz") {
      whiteRating = whiteBlitz;
      blackRating = blackBlitz;
    }

    const tournament = document.getElementById("tournament").value;
    const round = parseInt(document.getElementById("round").value) || 1;
    const date = document.getElementById("date").value

    const game = {
      id: generateUniqueID(),
      white: playerWhite,
      whiteRating: whiteRating,
      whiteTitle: whiteTitle,
      black: playerBlack,
      blackRating: blackRating,
      blackTitle: blackTitle,
      result: result,
      tournament: tournament,
      round: round,
      time: time,
      date: date,
      gameLink: document.getElementById("gameLink").value,
    };

  // 🚀 **Add duplicate check here BEFORE pushing to games**
  if (window.games.some(g => 
    (g.white === playerWhite || g.black === playerBlack) && 
    g.date === date && 
    g.tournament === tournament && 
    g.round === round)) {
    hideLoader();
    alert("Game already exists or player conflict in this round!");
    return;
  }
    window.games.push(game);
    saveGames();
    event.target.reset();

    hideLoader();

    alert(
      `${toUnicodeVariant(
        game.whiteTitle,
        "bold sans",
        "sans"
      )} ${playerWhite} vs ${toUnicodeVariant(
        game.blackTitle,
        "bold sans",
        "sans"
      )} ${playerBlack} Game Added!`
    );
  } catch (error) {
    alert("Error fetching FIDE data. Please try again.");
    hideLoader();
  }
}
