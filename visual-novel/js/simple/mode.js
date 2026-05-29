// simple/mode.js — 由 index.js 搬出,內容未改動。簡易↔劇本轉換 + 模式內容判斷。
// (switchMode / renderMainView 因被 wire-up 重新賦值,保留於 index.js,經全域呼叫本檔)

function cardsToScript(cards) {
  if (!cards || !cards.length) return "";
  const lines = [];
  let currentCg = null;
  for (const card of cards) {
    if (card.cgName && card.cgName !== currentCg) {
      lines.push(`[cg: ${card.cgName}]`);
      currentCg = card.cgName;
    }
    for (const d of card.dialogs) {
      if (!d.text || !d.text.trim()) continue;
      if (d.speaker) lines.push(`${d.speaker}：${d.text}`);
      else lines.push(d.text);
    }
    lines.push("");
  }
  while (lines.length && lines[lines.length - 1] === "") lines.pop();
  return lines.join("\n");
}

function scriptToCards(script) {
  if (!script || !script.trim()) return [];
  const parsed = parseScript(script);
  const cards = [];
  let currentCg = null;
  let currentCard = null;
  for (const ln of parsed) {
    if (ln.type === "blank") continue;
    if (ln.type === "cg") {
      currentCg = ln.cgName;
      if (currentCard) cards.push(currentCard);
      currentCard = { cgName: currentCg, dialogs: [] };
    } else if (ln.type === "cg_off") {
      currentCg = null;
      if (currentCard) cards.push(currentCard);
      currentCard = null;
    } else if (ln.type === "dialog") {
      if (!currentCard) currentCard = { cgName: currentCg, dialogs: [] };
      currentCard.dialogs.push({ speaker: ln.speaker, text: ln.text });
    } else if (ln.type === "narration") {
      if (!currentCard) currentCard = { cgName: currentCg, dialogs: [] };
      currentCard.dialogs.push({ speaker: null, text: ln.text });
    } else {
      return null;
    }
  }
  if (currentCard) cards.push(currentCard);
  return cards;
}

function scriptToCardsLossy(script) {
  if (!script || !script.trim()) return [];
  const parsed = parseScript(script);
  const cards = [];
  let currentCg = null;
  let currentCard = null;
  for (const ln of parsed) {
    if (ln.type === "cg") {
      currentCg = ln.cgName;
      if (currentCard) cards.push(currentCard);
      currentCard = { cgName: currentCg, dialogs: [] };
    } else if (ln.type === "cg_off") {
      currentCg = null;
      if (currentCard) cards.push(currentCard);
      currentCard = null;
    } else if (ln.type === "dialog") {
      if (!currentCard) currentCard = { cgName: currentCg, dialogs: [] };
      currentCard.dialogs.push({ speaker: ln.speaker, text: ln.text });
    } else if (ln.type === "narration") {
      if (!currentCard) currentCard = { cgName: currentCg, dialogs: [] };
      currentCard.dialogs.push({ speaker: null, text: ln.text });
    }
    // 其他指令(bg/exit/choices/love/light)直接略過
  }
  if (currentCard) cards.push(currentCard);
  return cards;
}

function syncSimpleToScript() {
  state.script = cardsToScript(state.simpleCards);
  if (els.scriptArea) els.scriptArea.value = state.script;
  saveToStorage();
  if (state.mode === "simple") {
    state.parsed = parseScript(state.script);
    // 不馬上 render(會吃效能)
  }
}

function vnsCurrentModeHasContent() {
  if (state.mode === "simple") {
    return Array.isArray(state.simpleCards) && state.simpleCards.length > 0;
  }
  return typeof state.script === "string" && state.script.trim().length > 0;
}

export {
  cardsToScript,
  scriptToCards,
  scriptToCardsLossy,
  syncSimpleToScript,
  vnsCurrentModeHasContent,
};
