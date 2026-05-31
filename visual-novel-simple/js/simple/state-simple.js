// simple/state-simple.js — 由 index.js 搬出(階段 3-G),內容未改動
// 相依:vnsUuid、state、SAMPLE_* 等皆經全域取得。

function _vnsSimpleSlideUuid() {
  return "slide_" + (typeof vnsUuid === "function" ? vnsUuid() : (Date.now().toString(36) + Math.random().toString(36).slice(2, 8)));
}

function _vnsChoiceUuid() {
  return "ch_" + (typeof vnsUuid === "function" ? vnsUuid() : (Date.now().toString(36) + Math.random().toString(36).slice(2, 8)));
}

// 任務 3:每幕「打完字後停留多久才切下一幕」的預設秒數
const SIMPLE_DEFAULT_HOLD = 1.0;

// 正規化特效陣列 — [{ id, intensity }],intensity 夾在 0~100,同種去重;
// 並過濾掉已移除的特效 id(舊存檔相容,task 1-4)。
function normalizeEffects(arr) {
  if (!Array.isArray(arr)) return [];
  const valid = (typeof VALID_EFFECT_IDS !== "undefined" && Array.isArray(VALID_EFFECT_IDS))
    ? VALID_EFFECT_IDS
    : ["blood_text", "fade_breathing", "glitch_text", "screen_noise", "scanlines", "shake", "out_of_focus", "vignette"];
  const seen = new Set();
  const out = [];
  for (const e of arr) {
    if (!e || typeof e !== "object" || typeof e.id !== "string") continue;
    if (!valid.includes(e.id)) continue;   // 過濾已移除特效
    if (seen.has(e.id)) continue;
    seen.add(e.id);
    let n = (typeof e.intensity === "number") ? e.intensity : 50;
    n = Math.max(0, Math.min(100, Math.round(n)));
    const item = { id: e.id, intensity: n };
    if (typeof e.color === "string" && e.color) item.color = e.color;   // 任務 4:保留客製色
    out.push(item);
  }
  return out;
}

function normalizeHold(v) {
  const n = (typeof v === "number" && isFinite(v)) ? v : SIMPLE_DEFAULT_HOLD;
  return Math.max(0, Math.min(10, Math.round(n * 10) / 10));
}

// 任務 4:結束轉場
const VALID_TRANSITIONS = ["none", "fade_black", "fade_white", "crossfade"];
function normalizeTransition(v) {
  return VALID_TRANSITIONS.includes(v) ? v : "none";
}

function createEmptySlide() {
  return {
    id: _vnsSimpleSlideUuid(),
    type: "dialog",
    cg: { type: "none" },
    dialogText: "",
    parsedLines: [],
    effects: [],
    holdDuration: SIMPLE_DEFAULT_HOLD,
    transition: "none",
  };
}

function createEmptyChoice() {
  return { id: _vnsChoiceUuid(), text: "", isCorrect: false };
}

function createChoiceSlide(prevCg) {
  const cg = (prevCg && typeof prevCg === "object")
    ? JSON.parse(JSON.stringify(prevCg))
    : { type: "none" };
  return {
    id: _vnsSimpleSlideUuid(),
    type: "choice",
    cg,
    choices: [createEmptyChoice(), createEmptyChoice()],
    effects: [],
    holdDuration: SIMPLE_DEFAULT_HOLD,
    transition: "none",
  };
}

function normalizeChoices(arr) {
  let choices = Array.isArray(arr)
    ? arr.filter(ch => ch && typeof ch === "object").map(ch => ({
        id: (typeof ch.id === "string" && ch.id) ? ch.id : _vnsChoiceUuid(),
        text: typeof ch.text === "string" ? ch.text : "",
        isCorrect: !!ch.isCorrect,
      }))
    : [];
  while (choices.length < 2) choices.push(createEmptyChoice());
  if (choices.length > 5) choices = choices.slice(0, 5);
  // 最多一個正解
  let seen = false;
  choices.forEach(ch => {
    if (ch.isCorrect && !seen) seen = true;
    else ch.isCorrect = false;
  });
  return choices;
}

function migrateSimpleCard(c) {
  if (!c || typeof c !== "object") return null;
  const id = (typeof c.id === "string" && c.id) ? c.id : _vnsSimpleSlideUuid();

  // CG 欄位:舊版 cgName 字串 → 新版 cg 物件
  let cg;
  if (c.cg && typeof c.cg === "object") {
    cg = {
      type: (c.cg.type === "upload" || c.cg.type === "library") ? c.cg.type : "none",
      name: c.cg.name || null,
      dataUrl: c.cg.dataUrl || null,
      cgId: c.cg.cgId || null,
    };
  } else if (typeof c.cgName === "string" && c.cgName) {
    cg = { type: "library", name: c.cgName, cgName: c.cgName };
  } else {
    cg = { type: "none" };
  }

  // 任務 5:對話框樣式改為全域,舊資料中每幕的 dialogStyle 一律丟棄(改用 state.style)

  // type 欄位:向後相容,沒有 type 一律視為 dialog
  const type = c.type === "choice" ? "choice" : "dialog";

  const effects = normalizeEffects(c.effects);
  const holdDuration = normalizeHold(c.holdDuration);
  const transition = normalizeTransition(c.transition);

  if (type === "choice") {
    return { id, type, cg, choices: normalizeChoices(c.choices), effects, holdDuration, transition };
  }

  // dialogText 欄位:優先用字串,否則從舊 dialogs 陣列拼回去
  let dialogText = "";
  if (typeof c.dialogText === "string") {
    dialogText = c.dialogText;
  } else if (Array.isArray(c.dialogs)) {
    dialogText = c.dialogs.map(d => {
      if (!d) return "";
      if (d.speaker) return d.speaker + ":" + (d.text || "");
      return d.text || "";
    }).join("\n\n");
  }

  return {
    id, type, cg, dialogText,
    parsedLines: Array.isArray(c.parsedLines) ? c.parsedLines : [],
    effects, holdDuration, transition,
  };
}

function migrateSimpleCards(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map(migrateSimpleCard).filter(Boolean);
}

function isChoiceSlide(card) { return !!(card && card.type === "choice"); }

function getCorrectChoice(card) {
  if (!isChoiceSlide(card) || !Array.isArray(card.choices)) return null;
  return card.choices.find(ch => ch && ch.isCorrect) || null;
}

function getCurrentSlide() {
  const cards = state.simpleCards || [];
  if (!cards.length) return null;
  if (state.simpleCurrentSlideId) {
    const found = cards.find(s => s.id === state.simpleCurrentSlideId);
    if (found) return found;
  }
  // fallback:回到第一張並更新 id
  state.simpleCurrentSlideId = cards[0].id;
  return cards[0];
}

function getCurrentSlideIdx() {
  const cards = state.simpleCards || [];
  if (!state.simpleCurrentSlideId) return cards.length ? 0 : -1;
  const i = cards.findIndex(s => s.id === state.simpleCurrentSlideId);
  return i < 0 ? (cards.length ? 0 : -1) : i;
}

export {
  SIMPLE_DEFAULT_HOLD,
  normalizeEffects,
  normalizeHold,
  _vnsSimpleSlideUuid,
  _vnsChoiceUuid,
  createEmptySlide,
  createEmptyChoice,
  createChoiceSlide,
  normalizeChoices,
  migrateSimpleCard,
  migrateSimpleCards,
  isChoiceSlide,
  getCorrectChoice,
  getCurrentSlide,
  getCurrentSlideIdx,
};
