// simple/state-simple.js — 由 index.js 搬出(階段 3-G),內容未改動
// 相依:vnsUuid、state、SAMPLE_* 等皆經全域取得。

function _vnsSimpleSlideUuid() {
  return "slide_" + (typeof vnsUuid === "function" ? vnsUuid() : (Date.now().toString(36) + Math.random().toString(36).slice(2, 8)));
}

function _vnsChoiceUuid() {
  return "ch_" + (typeof vnsUuid === "function" ? vnsUuid() : (Date.now().toString(36) + Math.random().toString(36).slice(2, 8)));
}

function createEmptySlide() {
  return {
    id: _vnsSimpleSlideUuid(),
    type: "dialog",
    cg: { type: "none" },
    dialogText: "",
    parsedLines: [],
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

  if (type === "choice") {
    return { id, type, cg, choices: normalizeChoices(c.choices) };
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
