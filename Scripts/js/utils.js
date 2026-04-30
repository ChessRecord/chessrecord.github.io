// utils.js - General utility functions and Chess logic

export const isValidString = (s) => typeof s === "string" && s.length > 0;

export const toNumberOr = (value, fallback) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

export function generateUniqueID() {
  return crypto.randomUUID();
}

export function capitalize(str) {
  if (!isValidString(str)) return "";
  return str
    .split(" ")
    .filter((word) => word.length > 0)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export function formatName(name) {
  if (!isValidString(name)) return "";
  const parts = name.split(", ");
  if (parts.length !== 2) return name.trim();
  const [last, first] = parts;
  return `${first.trim()} ${last.trim()}`.trim();
}

export function isEmpty(array) {
  return !array || array.length === 0;
}

/* --- Unicode Variant Helpers --- */
const buildSpecialMap = (startCode, rangeStart = 97, rangeEnd = 122) => {
  const map = {};
  for (let i = rangeStart; i <= rangeEnd; i++) {
    map[String.fromCharCode(i)] = startCode + (i - rangeStart);
  }
  return map;
};

const SPECIAL_P = Object.freeze(buildSpecialMap(0x249c));
const SPECIAL_W = Object.freeze(buildSpecialMap(0xff41));

export function toUnicodeVariant(str, variant, flags) {
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

  const special = {
    m: { " ": 0x2000, "-": 0x2013 },
    i: { h: 0x210e },
    g: { C: 0x212d, H: 0x210c, I: 0x2111, R: 0x211c, Z: 0x2128 },
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

  const getType = (v) => variantOffsets[v] || (offsets[v] ? v : "m");
  const getFlag = (f, fs) =>
    isValidString(fs) && fs.split(",").some((val) => val.trim() === f);

  const type = getType(variant);
  const underline = getFlag("underline", flags);
  const strike = getFlag("strike", flags);
  let result = "";

  for (const k of str) {
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
    if (underline) result += "\u0332";
    if (strike) result += "\u0336";
  }
  return result;
}

/* --- Loader UI Helpers --- */
export function showLoader(target) {
  const el = document.querySelector(target);
  if (!el) return;
  if (typeof el._oldLoaderValue === "undefined") {
    el._oldLoaderValue = el.innerHTML;
  }
  const loader = document.getElementById("loader");
  if (loader) loader.style.display = "inline";
  el.innerHTML = "Loading";
}

export function hideLoader(target) {
  const el = document.querySelector(target);
  if (!el) return;
  const loader = document.getElementById("loader");
  if (loader) loader.style.display = "none";
  if (typeof el._oldLoaderValue !== "undefined") {
    el.innerHTML = el._oldLoaderValue;
    delete el._oldLoaderValue;
  }
}

/* --- Chess Specific Logic --- */

export const TITLE_MAP = Object.freeze({
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

export const TIME_CONTROL_ICONS = Object.freeze({
  Bullet: '<i class="fa-solid fa-bolt-lightning"></i><span class="gap"></span>',
  Blitz: '<i class="fa-solid fa-bolt-lightning"></i><span class="gap"></span>',
  Rapid: '<i class="fa-solid fa-clock"></i><span class="gap"></span>',
  Classical:
    '<i class="fa-solid fa-hourglass-half"></i><span class="gap"></span>',
  Unknown: "",
});

export function abbreviateTitle(title) {
  if (!isValidString(title)) return "";
  const normalized = title.toLowerCase().replace(/\s+/g, "");
  return TITLE_MAP[normalized] || title;
}

export function getTimeControlCategory(timeControl) {
  const parseTimeControl = (tc) => {
    const cleanTC = String(tc).toLowerCase().replace(/\s+/g, "");
    let initialTime, increment;
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

  const classifyTimeControl = (initial, increment) => {
    initial = Number(initial);
    increment = Number(increment);
    if (![initial, increment].every((n) => Number.isFinite(n) && n >= 0))
      return "Unknown";
    const initialSeconds = initial * 60;
    const estimatedMinutes = (initialSeconds + increment * 40) / 60;
    if (initial < 3 && estimatedMinutes < 7) return "Bullet";
    if (initial < 10 && estimatedMinutes < 25) return "Blitz";
    if (initial < 30 && estimatedMinutes < 60) return "Rapid";
    return "Classical";
  };

  try {
    const { initialTime, increment } = parseTimeControl(timeControl);
    return classifyTimeControl(initialTime, increment);
  } catch (error) {
    return "Unknown";
  }
}

export function formatResult(result) {
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
      return result.trim();
  }
}

export function normalizeResult(result) {
  if (!isValidString(result)) return "*";
  const cleaned = result.trim().replace(/½/g, "1/2").replace(/\s+/g, "");
  switch (cleaned) {
    case "1-0":
    case "0-1":
    case "1/2-1/2":
      return cleaned;
    default:
      return "*";
  }
}

// Rating Calculator logic
export function expectedScore(myRating, oppRating) {
  return 1 / (1 + Math.pow(10, (oppRating - myRating) / 400));
}

export function calcChange(myRating, oppRating, result, k = 40) {
  if (oppRating === 0) return "";
  const E = expectedScore(myRating, oppRating);
  return Math.round(k * (result - E) * 10) / 10;
}
