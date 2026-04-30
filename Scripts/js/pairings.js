// pairings.js
import { calcChange, showLoader, hideLoader } from "./utils.js";

/**
 * Scrapes data from chess-results.com via a proxy.
 * Uses jQuery for parsing and extraction as per user preference.
 */
export async function scrapeChessResults(url) {
  const proxy = "https://proxy.caticuchess.workers.dev/";
  const fullUrl = proxy + url;

  const response = await fetch(fullUrl);
  const htmlText = await response.text();

  // Parse HTML using jQuery
  const $html = $("<div>").html(htmlText);

  // The pairings table is typically the 6th table (index 5)
  const table = $html.find("table").eq(5);
  const rows = table.find("tr");

  // Extract header keys from <th>
  const headerCells = table.find("tr").first().find("th");
  const headerKeys = headerCells
    .map((_, th) => {
      const txt = $(th).text().trim();
      return txt === "" ? "Title" : txt;
    })
    .get();

  /**
   * Helper to build opponent profile URL by replacing snr in the original url
   */
  function buildOpponentProfileUrl(baseUrl, opponentStartNo) {
    if (!baseUrl || !opponentStartNo || isNaN(Number(opponentStartNo)))
      return null;
    try {
      const urlObj = new URL(baseUrl);
      urlObj.searchParams.set("snr", String(Number(opponentStartNo)));
      return urlObj.toString();
    } catch {
      if (typeof baseUrl === "string") {
        const snr = encodeURIComponent(String(Number(opponentStartNo)));
        if (baseUrl.includes("snr=")) {
          return baseUrl.replace(/([?&]snr=)[^&]*/, "$1" + snr);
        } else if (baseUrl.includes("?")) {
          return baseUrl + "&snr=" + snr;
        } else {
          return baseUrl + "?snr=" + snr;
        }
      }
      return null;
    }
  }

  const pairings = [];

  rows.each((i, row) => {
    // Skip header row
    if (i === 0) return;
    // Only process odd rows (standard chess-results pairing list layout)
    if (i % 2 === 1) {
      const cells = $(row)
        .find("td")
        .map((_, cell) => $(cell).text().trim())
        .get();

      if (cells.length >= headerKeys.length) {
        // Build a mapping of headerKey -> cell value
        const rowObj = {};
        headerKeys.forEach((key, idx) => {
          rowObj[key] = cells[idx];
        });

        const $row = $(row);
        const resIdx = headerKeys.indexOf("Res.");
        const isBlack = $row.find(`td:eq(${resIdx}) div.FarbesT`).length > 0;
        const isWhite = $row.find(`td:eq(${resIdx}) div.FarbewT`).length > 0;

        const pairing = {
          round: rowObj["Rd."],
          boardNo: rowObj["Bo."],
          playerStartNo: rowObj["SNo"],
          opponentTitle: rowObj["Title"],
          opponentName: rowObj["Name"],
          opponentRating: parseInt(rowObj["Rtg"]) || 0,
          opponentFederation: rowObj["FED"],
          opponentClub: rowObj["Club/City"],
          opponentPoints: rowObj["Pts."],
          result: rowObj["Res."],
          playerColor: isBlack ? "Black" : isWhite ? "White" : "",
          opponentProfileUrl: buildOpponentProfileUrl(url, rowObj["SNo"]),
        };

        pairings.push(pairing);
      }
    }
  });

  const playerInfo = {};
  const knownKeys = new Set([
    "Name",
    "Starting rank",
    "Rating",
    "Rating national",
    "Rating international",
    "Performance rating",
    "FIDE rtg +/-",
    "Points",
    "Rank",
    "Federation",
    "Club/City",
    "Ident-Number",
    "Fide-ID",
    "Year of birth",
  ]);

  // Info rows are in the 5th table (index 4)
  const infoRows = $html.find("table").eq(4).find("tr");

  infoRows.each((_, row) => {
    const cells = $(row).find("td");
    if (cells.length >= 2) {
      const key = $(cells[0]).text().trim().replace(/:$/, "");
      const value = $(cells[1]).text().trim();
      if (knownKeys.has(key)) {
        playerInfo[key] = value;
      }
    }
  });

  return { playerInfo, pairings };
}

/**
 * Main function to fetch and return variables for all rounds
 */
export async function getChessResults(url) {
  if (!url.includes("chess-results.com")) {
    throw new Error("Please enter a valid Chess-Results URL.");
  }

  const { playerInfo, pairings } = await scrapeChessResults(url);

  const rating = parseInt(playerInfo["Rating"]);
  if (isNaN(rating)) {
    throw new Error("Could not detect your rating from the page.");
  }

  const rtgchgStr = playerInfo["FIDE rtg +/-"]
    ? playerInfo["FIDE rtg +/-"].replace(/,/g, ".")
    : "0";
  const rtgchg = parseFloat(rtgchgStr);

  // Calculate rating change info for all rounds
  const rounds = pairings.map((pairing) => {
    const oppRating = pairing.opponentRating;
    return {
      ...pairing,
      opponentPoints: pairing.opponentPoints
        .replace(/,5/g, "&#189;")
        .replace(/0&#189;/g, "&#189;"),
      win:
        calcChange(rating, oppRating, 1) === ""
          ? ""
          : (calcChange(rating, oppRating, 1) >= 0 ? "+" : "-") +
            Math.abs(calcChange(rating, oppRating, 1)),
      draw:
        calcChange(rating, oppRating, 0.5) === ""
          ? ""
          : (calcChange(rating, oppRating, 0.5) >= 0 ? "+" : "-") +
            Math.abs(calcChange(rating, oppRating, 0.5)),
      loss:
        calcChange(rating, oppRating, 0) === ""
          ? ""
          : (calcChange(rating, oppRating, 0) >= 0 ? "+" : "-") +
            Math.abs(calcChange(rating, oppRating, 0)),
    };
  });

  return { playerInfo, rating, rtgchg, rounds };
}

/**
 * Render rounds data into #pairings-table in the required format
 */
export function renderPairingsTable(rounds, playerName, playerRating, url) {
  const $tableContainer = $("#pairings-table");
  if ($tableContainer.length === 0) return;

  // Show player name and rating above the table
  if (playerName) {
    let $nameEl = $("#player-name");
    if ($nameEl.length === 0) {
      $nameEl = $('<div id="player-name"></div>');
      $tableContainer.before($nameEl);
    }

    let displayHtml = "";
    if (url) {
      displayHtml += `<a href="${url}" id="player-name-link" target="_blank"><strong>${playerName}</strong></a>`;
    } else {
      displayHtml += "<strong>" + playerName + "</strong>";
    }
    if (playerRating) {
      displayHtml += ' <span class="player-rating">' + playerRating + "</span>";
    }
    $nameEl.html(displayHtml);
  }

  // Check if any round has a federation value
  const hasFederation = rounds.some(
    (r) => r.opponentFederation && r.opponentFederation.trim() !== "",
  );

  // Build table HTML
  let tableHtml = `
    <table>
      <thead>
        <tr>
          <th>Round</th>
          <th>Board</th>
          <th>Start</th>
          <th>Name</th>
          <th>Rating</th>
          ${hasFederation ? "<th>Federation</th>" : ""}
          <th>Club/City</th>
          <th>Points</th>
          <th>Result</th>
        </tr>
      </thead>
      <tbody>
  `;

  rounds.forEach((round) => {
    let colorSpan = "";
    if (round.playerColor === "Black") {
      colorSpan = '<span class="box-black"></span>';
    } else if (round.playerColor === "White") {
      colorSpan = '<span class="box-white"></span>';
    }

    tableHtml += `
      <tr>
        <td>${round.round}</td>
        <td>${round.boardNo}</td>
        <td>${round.playerStartNo}</td>
        <td>
          <span class="title">${round.opponentTitle}</span>
          ${round.opponentProfileUrl ? `<a href="${round.opponentProfileUrl}" target="_blank">${round.opponentName}</a>` : round.opponentName}
        </td>
        <td>
        ${
          round.opponentRating !== 0
            ? `<span class="tooltip" style="height: 100%;width: 100%;">
                ${round.opponentRating}
                <span class="tooltiptext">
                  Win: ${round.win}<br>Draw: ${round.draw}<br>Loss: ${round.loss}
                </span>
              </span>`
            : `${round.opponentRating}`
        }
        </td>
        ${hasFederation ? `<td>${round.opponentFederation || ""}</td>` : ""}
        <td>${round.opponentClub}</td>
        <td>${round.opponentPoints}</td>
        <td class="result-cell">${colorSpan}${round.result ? `<span>${round.result}</span>` : ""}</td>
      </tr>
    `;
  });

  tableHtml += `
      </tbody>
    </table>
    <div class="note">
      *) Rating difference of more than 400. It was limited to 400.
    </div>
  `;

  $tableContainer.html(tableHtml);
}

/**
 * Example usage for UI (call this from your form/button event)
 */
export async function showPairingsTableFromInput() {
  const $urlInput = $("#url-input");
  let url = $urlInput.val().trim();

  // Save to localStorage
  if (url) {
    localStorage.setItem("chessResultsUrl", url);
  } else {
    // If input is empty, try to load from localStorage
    url = localStorage.getItem("chessResultsUrl") || "";
    $urlInput.val(url);
  }

  if (!url) return;

  showLoader("#searchURL span");
  try {
    const data = await getChessResults(url);
    const playerRating = data.playerInfo?.["Rating international"] || null;

    renderPairingsTable(
      data.rounds,
      data.playerInfo?.["Name"],
      playerRating,
      url,
    );

    // Cache rounds data in localStorage
    localStorage.setItem("pairingsRounds", JSON.stringify(data.rounds));
    localStorage.setItem("pairingsPlayerName", data.playerInfo?.["Name"] || "");
    localStorage.setItem("pairingsPlayerRating", playerRating || "");
    hideLoader("#searchURL span");
  } catch (err) {
    hideLoader("#searchURL span");
    alert("No Pairings found for this URL.");
    console.error(err);
  }
}

/**
 * Initialization Logic
 */
const initPairings = () => {
  // On page load, fill input from localStorage if available
  const storedUrl = localStorage.getItem("chessResultsUrl");
  if (storedUrl) {
    $("#url-input").val(storedUrl);
  }

  // On page load, restore pairings table if cached
  const cachedRounds = localStorage.getItem("pairingsRounds");
  const cachedPlayerName = localStorage.getItem("pairingsPlayerName");
  const cachedPlayerRating = localStorage.getItem("pairingsPlayerRating");
  const url = localStorage.getItem("chessResultsUrl");

  if (cachedRounds) {
    try {
      const rounds = JSON.parse(cachedRounds);
      renderPairingsTable(rounds, cachedPlayerName, cachedPlayerRating, url);
    } catch (e) {
      // If parsing fails, clear the cache
      localStorage.removeItem("pairingsRounds");
      localStorage.removeItem("pairingsPlayerName");
      localStorage.removeItem("pairingsPlayerRating");
    }
  }

  $("#chess-resultsForm").on("submit", function (e) {
    e.preventDefault();
    showPairingsTableFromInput();
  });
};

// Initialize
// jQuery is loaded via a separate script tag in the HTML, so it's globally available.
$(initPairings);
