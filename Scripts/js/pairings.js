function expectedScore(myRating, oppRating) {
  return 1 / (1 + Math.pow(10, (oppRating - myRating) / 400));
}

function calcChange(myRating, oppRating, result, k = 40) {
  if (oppRating === 0) return "";
  const E = expectedScore(myRating, oppRating);
  return Math.round(k * (result - E) * 10) / 10;
}

async function scrapeChessResults(url) {
  const proxy = "https://proxy.caticuchess.workers.dev/";
  const fullUrl = proxy + url;

  const response = await fetch(fullUrl);
  const htmlText = await response.text();

  const $html = $("<div>").html(htmlText);
  const table = $html.find("table").eq(5);
  const rows = table.find("tr");

  // Extract header keys from <th>
  const headerCells = table.find("tr").first().find("th");
  let headerKeys = headerCells
    .map((_, th) => {
      const txt = $(th).text().trim();
      return txt === "" ? "Title" : txt;
    })
    .get();

  // Map header keys to normalized property names
  const keyMap = {
    "Rd.": "round",
    "Bo.": "boardNo",
    "SNo": "playerStartNo",
    "Title": "opponentTitle",
    "Name": "opponentName",
    "Rtg": "opponentRating",
    "FED": "opponentFederation",
    "Club/City": "opponentClub",
    "Pts.": "opponentPoints",
    "Res.": "result",
  };

  // Helper to build opponent profile URL by replacing snr in the original url
  function buildOpponentProfileUrl(baseUrl, opponentStartNo) {
    if (!baseUrl || !opponentStartNo || isNaN(Number(opponentStartNo))) return null;
    try {
      const urlObj = new URL(baseUrl);
      urlObj.searchParams.set('snr', String(Number(opponentStartNo)));
      return urlObj.toString();
    } catch {
      if (typeof baseUrl === 'string') {
        const snr = encodeURIComponent(String(Number(opponentStartNo)));
        if (baseUrl.includes('snr=')) {
          return baseUrl.replace(/([?&]snr=)[^&]*/, '$1' + snr);
        } else if (baseUrl.includes('?')) {
          return baseUrl + '&snr=' + snr;
        } else {
          return baseUrl + '?snr=' + snr;
        }
      }
      return null;
    }
  }

  const pairings = [];

  rows.each((i, row) => {
    // Skip header row
    if (i === 0) return;
    // Only process odd rows (as before)
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

        const nameCell = $(row).find("td").eq(headerKeys.indexOf("Name"));
        const nameLink = nameCell.find("a").attr("href");

        // Compose pairing object using mapped keys
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
          playerColor:
            $(row).find("td:eq(" + (headerKeys.indexOf("Res.")) + ") div.FarbesT").length > 0
              ? "Black"
              : $(row).find("td:eq(" + (headerKeys.indexOf("Res.")) + ") div.FarbewT").length > 0
              ? "White"
              : "",
          opponentProfileUrl: buildOpponentProfileUrl(url, rowObj["SNo"])
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

// Main function to fetch and return variables for all rounds
async function getChessResults(url) {
  if (!url.includes("chess-results.com")) {
    throw new Error("Please enter a valid Chess-Results URL.");
  }

  const { playerInfo, pairings } = await scrapeChessResults(url);

  const rating = parseInt(playerInfo["Rating"]);
  const rtgchg = parseFloat(playerInfo["FIDE rtg +/-"].replace(/,/g, "."));
  if (isNaN(rating)) {
    throw new Error("Could not detect your rating from the page.");
  }

  // Calculate rating change info for all rounds
  const rounds = pairings.map((pairing) => {
    const oppRating = pairing.opponentRating;
    return {
      round: pairing.round,
      boardNo: pairing.boardNo,
      playerStartNo: pairing.playerStartNo,
      opponentTitle: pairing.opponentTitle,
      opponentName: pairing.opponentName,
      opponentRating: oppRating,
      opponentFederation: pairing.opponentFederation,
      opponentClub: pairing.opponentClub,
      opponentPoints: pairing.opponentPoints.replace(/,5/g, "&#189;").replace(/0&#189;/g, "&#189;"),
      result: pairing.result,
      playerColor: pairing.playerColor,
      opponentProfileUrl: pairing.opponentProfileUrl,
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

  return {
    playerInfo,
    rating,
    rtgchg,
    rounds,
  };
}

// Render rounds data into #pairings-table in the required format
function renderPairingsTable(rounds, playerName, playerRating, url) {
  // Show player name and rating above the table
  if (playerName) {
    if ($('#player-name').length === 0) {
      $('#pairings-table').before('<div id="player-name"></div>');
    }
    let displayHtml = '';
    if (url) {
      displayHtml += `<a href="${url}" id="player-name-link" target="_blank"><strong>${playerName}</strong></a>`;
    } else {
      displayHtml += '<strong>' + playerName + '</strong>';
    }
    if (playerRating) {
      displayHtml += ' <span class="player-rating">' + playerRating + '</span>';
    }
    $('#player-name').html(displayHtml);
  }
  const $table = $("#pairings-table");
  // Check if any round has a federation value
  const hasFederation = rounds.some(r => r.opponentFederation && r.opponentFederation.trim() !== "");

  // Build thead only once
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

    let resultDisplay = round.result;

    tableHtml += `
      <tr>
        <td>${round.round}</td>
        <td>${round.boardNo}</td>
        <td>${round.playerStartNo}</td>
        <td>
          <span class="title">${round.opponentTitle}</span>
          ${
            round.opponentProfileUrl
              ? `<a href="${round.opponentProfileUrl}" target="_blank">${round.opponentName}</a>`
              : round.opponentName
          }
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
        <td class="result-cell">${colorSpan}${resultDisplay ? `<span>${resultDisplay}</span>` : ''}</td>
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

  $table.html(tableHtml);
}

// Example usage for UI (call this from your form/button event)
async function showPairingsTableFromInput() {
  let url = $("#url-input").val().trim();
  // Save to localStorage
  if (url) {
    window.localStorage.setItem("chessResultsUrl", url);
  } else {
    // If input is empty, try to load from localStorage
    const storedUrl = window.localStorage.getItem("chessResultsUrl");
    if (storedUrl) {
      url = storedUrl;
      $("#url-input").val(url);
    }
  }
  if (!url) return;
  showLoader("#searchURL span");
  try {
    const data = await getChessResults(url);
    const playerRating = data.playerInfo && data.playerInfo["Rating international"] ? data.playerInfo["Rating international"] : null;
    renderPairingsTable(data.rounds, data.playerInfo && data.playerInfo["Name"], playerRating, url); // pass url here
    // Cache rounds data in localStorage (also cache player name and rating)
    window.localStorage.setItem("pairingsRounds", JSON.stringify(data.rounds));
    window.localStorage.setItem("pairingsPlayerName", data.playerInfo && data.playerInfo["Name"] ? data.playerInfo["Name"] : "");
    window.localStorage.setItem("pairingsPlayerRating", playerRating ? playerRating : "");
    hideLoader("#searchURL span");
  } catch (err) {
    hideLoader("#searchURL span");
    alert("No Pairings found for this URL.");
    console.error(err);
  }
}

// Optionally, attach to form submit
$(function () {
  // On page load, fill input from localStorage if available
  const storedUrl = window.localStorage.getItem("chessResultsUrl");
  if (storedUrl) {
    $("#url-input").val(storedUrl);
  }

  // On page load, restore pairings table if cached
  const cachedRounds = window.localStorage.getItem("pairingsRounds");
  const cachedPlayerName = window.localStorage.getItem("pairingsPlayerName");
  const cachedPlayerRating = window.localStorage.getItem("pairingsPlayerRating");
  const url = window.localStorage.getItem("chessResultsUrl"); // ensure url is available
  if (cachedRounds) {
    try {
      const rounds = JSON.parse(cachedRounds);
      renderPairingsTable(rounds, cachedPlayerName, cachedPlayerRating, url); // pass url here
    } catch (e) {
      // If parsing fails, clear the cache
      window.localStorage.removeItem("pairingsRounds");
      window.localStorage.removeItem("pairingsPlayerName");
      window.localStorage.removeItem("pairingsPlayerRating");
    }
  }

  $("#chess-resultsForm").on("submit", function (e) {
    e.preventDefault();
    // Removed check that disables repeated submissions
    showPairingsTableFromInput();
  });
});

// Example usage:
// getChessResults("https://chess-results.com/tnr123456.aspx?lan=1&art=9&snr=1")
//   .then(res => console.log(JSON.stringify(res, null, 2)))
//   .catch(err => console.error(err));