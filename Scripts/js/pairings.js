// =============================================================================
// Constants
// =============================================================================

const PROXY_URL = "https://proxy.caticuchess.workers.dev/";

const PLAYER_INFO_KEYS = new Set([
  "Name",
  "Title",
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

// =============================================================================
// Storage
//
// Two scopes with distinct lifetimes:
//   PersistentStorage — localStorage; survives tab/browser close.
//                       Holds only the URL so the input is pre-filled on
//                       every future visit.
//   SessionStorage    — sessionStorage; cleared when the tab closes.
//                       Holds rounds and playerData for instant within-session
//                       restores. Always verified against a fresh fetch before
//                       deciding whether to re-render.
// =============================================================================

const PersistentStorage = {
  KEY: "chessResultsUrl",

  get() {
    return localStorage.getItem(this.KEY);
  },
  set(value) {
    localStorage.setItem(this.KEY, String(value ?? ""));
  },
  clear() {
    localStorage.removeItem(this.KEY);
  },
};

const SessionStorage = {
  KEYS: {
    rounds: "pairingsRounds",
    playerData: "pairingsPlayerData",
  },

  get(key) {
    return sessionStorage.getItem(this.KEYS[key]);
  },

  getJSON(key) {
    try {
      return JSON.parse(this.get(key));
    } catch {
      return null;
    }
  },

  set(key, value) {
    sessionStorage.setItem(
      this.KEYS[key],
      typeof value === "object" ? JSON.stringify(value) : String(value ?? ""),
    );
  },

  clear(...keys) {
    keys.forEach((k) => sessionStorage.removeItem(this.KEYS[k]));
  },
};

// =============================================================================
// Utilities
// =============================================================================

/** True when a value is non-null, non-undefined, and non-empty-string. */
function hasValue(v) {
  return v !== null && v !== undefined && v !== "";
}

/**
 * Builds a chess-results.com profile URL for a given start number by
 * replacing the `snr` query parameter in the source URL.
 */
function buildOpponentProfileUrl(baseUrl, startNo) {
  const n = Number(startNo);
  if (!baseUrl || !startNo || isNaN(n) || n <= 0) return null;

  try {
    const u = new URL(baseUrl);
    u.searchParams.set("snr", String(n));
    return u.toString();
  } catch {
    if (typeof baseUrl !== "string") return null;
    const snr = encodeURIComponent(String(n));
    if (baseUrl.includes("snr="))
      return baseUrl.replace(/([?&]snr=)[^&]*/, "$1" + snr);
    return baseUrl + (baseUrl.includes("?") ? "&" : "?") + "snr=" + snr;
  }
}

/**
 * Formats a projected rating change as "+N" or "-N".
 * Returns "" when calcChange signals the result is indeterminate.
 * score: 1 = win, 0.5 = draw, 0 = loss.
 */
function formatRatingDelta(playerRating, oppRating, score) {
  const delta = calcChange(playerRating, oppRating, score);
  if (delta === "") return "";
  return (delta >= 0 ? "+" : "") + delta;
}

/**
 * Normalises fractional-point notation from the server format
 * (e.g. "1,5" → "1½", "0,5" → "½").
 */
function normalisePoints(raw) {
  return raw.replace(/,5/g, "&#189;").replace(/0&#189;/g, "&#189;");
}

// =============================================================================
// Data acquisition
// =============================================================================

/** Fetches raw HTML through the CORS proxy and returns it as a string. */
async function fetchPage(url) {
  const res = await fetch(PROXY_URL + url);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching page.`);
  return res.text();
}

/**
 * Extracts player metadata from the info table.
 * The table is located by inspecting only its own direct first-column cells
 * (not descendant text) for the exact label "Name". This prevents outer layout
 * tables — whose single large cells contain all descendant text — from
 * matching first. Only known keys defined in PLAYER_INFO_KEYS are retained.
 */
function parsePlayerInfo($html) {
  const $table = $html
    .find("table")
    .filter((_, t) =>
      $(t)
        .children("tbody")
        .children("tr")
        .children("td:first-child")
        .toArray()
        .some((td) => $(td).text().trim().replace(/:$/, "") === "Name"),
    )
    .first();

  if (!$table.length)
    throw new Error(
      "Chess-Results mismatch. Please verify the URL or tournament status.",
    );

  return Object.fromEntries(
    $table
      .find("tr:has(td)")
      .get()
      .map((row) => {
        const $cells = $(row).find("td");
        return [
          $cells.eq(0).text().trim().replace(/:$/, ""),
          $cells.eq(1).text().trim(),
        ];
      })
      .filter(([key]) => PLAYER_INFO_KEYS.has(key)),
  );
}

/**
 * Extracts all pairings from the results table.
 * The table is located by checking that its first row contains at least one
 * <th> element (ruling out outer layout tables, which have none) and that
 * those direct header cells include "Rd" and "Res". Column positions are
 * derived dynamically via header keywords matched with .includes(), so new
 * columns are handled automatically. tr:has(td):not(:has(th)) skips the
 * mixed-content header row; empty round cells filter remaining blank rows.
 */
function parsePairings($html, url) {
  const $table = $html
    .find("table")
    .filter((_, t) => {
      const $firstRow = $(t).children("tbody").children("tr").first();
      if (!$firstRow.children("th").length) return false;
      const headerTexts = $firstRow
        .children("th, td")
        .map((_, c) => $(c).text().trim())
        .get();
      return (
        headerTexts.some((h) => h.includes("Rd")) &&
        headerTexts.some((h) => h.includes("Res"))
      );
    })
    .first();

  if (!$table.length)
    throw new Error(
      "Chess-Results mismatch. Please verify the URL or tournament status.",
    );

  const headers = $table
    .find("tr")
    .first()
    .find("th")
    .map((_, th) => $(th).text().trim() || "Title")
    .get();

  // Finds the first header index whose text contains the given keyword.
  const colIdx = (keyword) => headers.findIndex((h) => h.includes(keyword));

  const idx = {
    rd: colIdx("Rd"),
    bo: colIdx("Bo"),
    sno: colIdx("SNo"),
    title: colIdx("Title"),
    name: colIdx("Name"),
    rtg: colIdx("Rtg"),
    fed: colIdx("FED"),
    club: colIdx("Club"),
    pts: colIdx("Pts"),
    res: colIdx("Res"),
  };

  if (idx.rd < 0 || idx.res < 0)
    throw new Error(
      "Chess-Results mismatch. Please verify the URL or tournament status.",
    );

  return $table
    .find("tr:has(td):not(:has(th))")
    .get()
    .map((row) => {
      const $cells = $(row).find("td");
      const cell = (i) => (i >= 0 ? $cells.eq(i).text().trim() : "");
      return {
        round: cell(idx.rd),
        boardNo: cell(idx.bo),
        playerStartNo: cell(idx.sno),
        opponentTitle: cell(idx.title),
        opponentName: cell(idx.name),
        opponentRating: parseInt(cell(idx.rtg)) || 0,
        opponentFederation: cell(idx.fed),
        opponentClub: cell(idx.club),
        opponentPoints: cell(idx.pts),
        result: cell(idx.res),
        playerColor: $cells.eq(idx.res).find("div.FarbesT").length
          ? "Black"
          : $cells.eq(idx.res).find("div.FarbewT").length
            ? "White"
            : "",
        opponentProfileUrl: buildOpponentProfileUrl(url, cell(idx.sno)),
      };
    })
    .filter((p) => p.round !== "");
}

/** Fetches and parses a chess-results.com player page. */
async function scrapeChessResults(url) {
  const $html = $("<div>").html(await fetchPage(url));
  return {
    playerInfo: parsePlayerInfo($html),
    pairings: parsePairings($html, url),
  };
}

// =============================================================================
// Data transformation
// =============================================================================

/**
 * Fetches, parses, and enriches a player's results page.
 * Each round is extended with projected rating deltas for win, draw, and loss.
 */
async function getChessResults(url) {
  if (!url.includes("chess-results.com"))
    throw new Error("Please enter a valid Chess-Results URL.");

  const { playerInfo, pairings } = await scrapeChessResults(url);

  const rating =
    parseInt(
      playerInfo["Rating"] ??
        playerInfo["Rating international"] ??
        playerInfo["Rating national"],
    ) || 0;

  const rtgchg = parseFloat(
    (playerInfo["FIDE rtg +/-"] ?? "0").replace(/,/g, "."),
  );

  // Spread each raw pairing and override only the three fields that differ:
  // opponentPoints is normalised and win/draw/loss are computed from ratings.
  const rounds = pairings.map((p) => ({
    ...p,
    opponentPoints: normalisePoints(p.opponentPoints),
    win: formatRatingDelta(rating, p.opponentRating, 1),
    draw: formatRatingDelta(rating, p.opponentRating, 0.5),
    loss: formatRatingDelta(rating, p.opponentRating, 0),
  }));

  return { playerInfo, rating, rtgchg, rounds };
}

/**
 * Shapes the raw playerInfo map and computed rating fields into the flat
 * playerData object used by the presentation layer.
 */
function buildPlayerData(playerInfo, rating, rtgchg, url) {
  return {
    url,
    name: playerInfo["Name"] ?? "",
    title: playerInfo["Title"] ?? "",
    rank: playerInfo["Rank"] ?? "",
    federation: playerInfo["Federation"] ?? "",
    rating,
    rtgchg,
  };
}

// =============================================================================
// Presentation
// =============================================================================

/**
 * Column definitions for the pairings table.
 *
 * Each entry carries:
 *   header     — the <th> label
 *   isPresent  — (round) => bool: does this round have data for the column?
 *   render     — (round) => <td> HTML string
 *
 * A column is only included when at least one round returns true from isPresent.
 */
const PAIRINGS_COLUMNS = [
  {
    header: "Round",
    isPresent: (r) => hasValue(r.round),
    render: (r) => `<td>${r.round}</td>`,
  },
  {
    header: "Board",
    isPresent: (r) => hasValue(r.boardNo),
    render: (r) => `<td>${r.boardNo}</td>`,
  },
  {
    header: "Start",
    isPresent: (r) => hasValue(r.playerStartNo),
    render: (r) => `<td>${r.playerStartNo}</td>`,
  },
  {
    header: "Name",
    isPresent: (r) => hasValue(r.opponentName),
    render: (r) => `<td>
      <span class="title">${r.opponentTitle || ""}</span>
      ${
        r.opponentProfileUrl
          ? `<a href="${r.opponentProfileUrl}" target="_blank">${r.opponentName}</a>`
          : r.opponentName
      }
    </td>`,
  },
  {
    header: "Rating",
    isPresent: (r) => hasValue(r.opponentRating),
    render: (r) =>
      `<td>${
        r.opponentRating
          ? `<span class="tooltip" style="height:100%;width:100%;">
          ${r.opponentRating}
          <span class="tooltiptext">
            Win: ${r.win}<br>Draw: ${r.draw}<br>Loss: ${r.loss}
          </span>
        </span>`
          : "0"
      }</td>`,
  },
  {
    header: "Federation",
    isPresent: (r) =>
      hasValue(r.opponentFederation) && r.opponentFederation.trim() !== "",
    render: (r) => `<td>${r.opponentFederation || ""}</td>`,
  },
  {
    header: "Club/City",
    isPresent: (r) => hasValue(r.opponentClub),
    render: (r) => `<td>${r.opponentClub}</td>`,
  },
  {
    header: "Points",
    isPresent: (r) => hasValue(r.opponentPoints),
    render: (r) => `<td>${r.opponentPoints}</td>`,
  },
  {
    // Result is always rendered; the colour indicator lives inside the cell.
    header: "Result",
    isPresent: () => true,
    render: (r) => {
      const colorSpan =
        r.playerColor === "Black"
          ? '<span class="box-black"></span>'
          : r.playerColor === "White"
            ? '<span class="box-white"></span>'
            : "";
      return `<td class="result-cell">${colorSpan}${r.result ? `<span>${r.result}</span>` : ""}</td>`;
    },
  },
];

/**
 * Renders (or updates) the player header above the table.
 * Format: #[Rank] [Federation] <Title> [Name] [New Rating] ([rtgchg])
 */
function renderPlayerHeader(playerData, url) {
  const { name, title, rank, rating, rtgchg, federation } = playerData;
  if (!name) return;

  if ($("#player-name").length === 0)
    $("#pairings-table").before('<div id="player-name"></div>');

  const rankHtml = rank ? `<span class="player-rank">#${rank}</span> ` : "";
  const fedHtml = federation
    ? `<span class="player-federation">${federation}</span> `
    : "";
  const titleHtml = title ? `<span class="title">${title}</span> ` : "";

  const nameHtml = url
    ? `<a href="${url}" id="player-name-link" target="_blank"><strong>${name}</strong></a>`
    : `<strong>${name}</strong>`;

  let ratingHtml = "";
  if (Number.isFinite(rating)) {
    const newRating = Math.round(
      rating + (Number.isFinite(rtgchg) ? rtgchg : 0),
    );
    const changeStr =
      Number.isFinite(rtgchg) && rtgchg !== 0
        ? `(<span class="player-rtgchg">${rtgchg > 0 ? "+" : ""}${rtgchg}</span>)`
        : "";
    ratingHtml = ` <span class="player-rating">${newRating} ${changeStr}</span>`;
  }

  $("#player-name").html(
    `${rankHtml}${fedHtml}${titleHtml}${nameHtml}${ratingHtml}`,
  );
}

/**
 * Renders the pairings table into #pairings-table.
 * Any column whose values are absent across every round is omitted.
 */
function renderPairingsTable(rounds, playerData, url) {
  renderPlayerHeader(playerData, url);

  const visible = PAIRINGS_COLUMNS.filter((col) =>
    rounds.some((r) => col.isPresent(r)),
  );
  const thead = `<thead><tr>${visible.map((c) => `<th>${c.header}</th>`).join("")}</tr></thead>`;
  const tbody = `<tbody>${rounds
    .map((r) => `<tr>${visible.map((c) => c.render(r)).join("")}</tr>`)
    .join("")}</tbody>`;

  $("#pairings-table").html(
    `<table>${thead}${tbody}</table>` +
      (playerData.rating > 0 &&
      rounds.some(
        (r) =>
          r.opponentRating > 0 &&
          Math.abs(playerData.rating - r.opponentRating) > 400,
      )
        ? '<div class="note">*) Rating difference of more than 400. It was limited to 400.</div>'
        : ""),
  );
}

// =============================================================================
// UI controller
// =============================================================================

/**
 * Resolves the URL from the input field or persistent cache, fetches live
 * results, and updates the table only when the data has changed.
 *
 * If the freshly fetched rounds are byte-for-byte identical to what is already
 * in the session cache the DOM is left untouched — no flicker, no redundant
 * repaint. When data differs, or when there is no cache yet, both the table
 * and the session cache are updated.
 *
 * The loader is always dismissed on exit, whether the fetch succeeds or fails.
 */
async function showPairingsTableFromInput() {
  let url = $("#url-input").val().trim();

  if (!url) {
    url = PersistentStorage.get() ?? "";
    if (url) $("#url-input").val(url);
  }
  if (!url) return;

  showLoader("#searchURL span");
  try {
    const { playerInfo, rating, rtgchg, rounds } = await getChessResults(url);
    const playerData = buildPlayerData(playerInfo, rating, rtgchg, url);
    const liveRoundsJSON = JSON.stringify(rounds);

    if (liveRoundsJSON !== SessionStorage.get("rounds")) {
      renderPairingsTable(rounds, playerData, url);
      SessionStorage.set("rounds", rounds);
      SessionStorage.set("playerData", playerData);
    }

    PersistentStorage.set(url); // always persisted on a successful fetch
  } catch (err) {
    alert(err.message || "No Pairings found for this URL.");
    console.error(err);
  } finally {
    hideLoader("#searchURL span");
  }
}

$(function () {
  const storedUrl = PersistentStorage.get();
  const cachedRounds = SessionStorage.getJSON("rounds");
  const cachedPlayerData = SessionStorage.getJSON("playerData");

  if (storedUrl) $("#url-input").val(storedUrl);

  // Restore from session cache immediately for an instant render, then fetch
  // live data in the background. The table is only re-rendered if the fresh
  // data differs from the cache.
  if (cachedRounds && cachedPlayerData && cachedPlayerData.url === storedUrl)
    renderPairingsTable(cachedRounds, cachedPlayerData, storedUrl);

  if (storedUrl) showPairingsTableFromInput();

  $("#chess-resultsForm").on("submit", (e) => {
    e.preventDefault();
    showPairingsTableFromInput();
  });
});
