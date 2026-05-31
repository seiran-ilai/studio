// detail/stage.js — 由 index.js 搬出(階段 3-D),內容未改動

function placeCharacter(charId, emotion, position) {
  // remove this char from any current slot first
  for (const p of POS_TAGS) {
    if (state.stage.slots[p] && state.stage.slots[p].charId === charId) {
      if (!position) position = p; // keep existing slot
      state.stage.slots[p] = null;
    }
  }
  if (!position) position = "中";
  // if another char already in this slot, push it aside? For simplicity, evict.
  state.stage.slots[position] = { charId, emotion: emotion || null };
  return position;
}

function computeStageStateAt(parsedLines, upToIdx) {
  state.stage = { bg: "default", slots: { 左: null, 中: null, 右: null }, cg: null, lightMode: state.lightMode || DEFAULT_LIGHT_MODE };
  // Batch 3:好感度重算 — 從初始值開始
  state.loveValues = {};
  for (const [k, v] of Object.entries(state.loveInitial || {})) {
    state.loveValues[k] = v;
  }
  let activeChar = null;
  for (let i = 0; i <= upToIdx && i < parsedLines.length; i++) {
    const ln = parsedLines[i];

    // apply any scene operations merged into this beat first
    if (ln.sceneOps && ln.sceneOps.length) {
      for (const op of ln.sceneOps) {
        if (op.type === "bg") state.stage.bg = op.bgName;
        else if (op.type === "exit") {
          state.stage.slots = { 左: null, 中: null, 右: null };
          activeChar = null;
        }
        else if (op.type === "cg") state.stage.cg = { name: op.cgName, hideDialog: op.hideDialog, hideGameUI: op.hideGameUI };
        else if (op.type === "cg_off") state.stage.cg = null;
        else if (op.type === "light") state.stage.lightMode = op.mode;
      }
    }

    if (ln.type === "bg") {
      state.stage.bg = ln.bgName;
    } else if (ln.type === "exit") {
      state.stage.slots = { 左: null, 中: null, 右: null };
      activeChar = null;
    } else if (ln.type === "cg") {
      state.stage.cg = { name: ln.cgName, hideDialog: ln.hideDialog, hideGameUI: ln.hideGameUI };
    } else if (ln.type === "cg_off") {
      state.stage.cg = null;
    } else if (ln.type === "light") {
      state.stage.lightMode = ln.mode;
    } else if (ln.type === "dialog") {
      if (ln.isProtagonist) {
        // 主角不出立繪、不變更舞台（其他立繪保持不動）
        activeChar = null;
      } else {
        const ch = findCharacter(ln.speaker);
        if (ch) {
          placeCharacter(ch.id, ln.emotion, ln.position);
          activeChar = ch.id;
        } else {
          activeChar = null;
        }
      }
    } else if (ln.type === "narration") {
      // narration doesn't change slot occupancy or active char highlight
    } else if (ln.type === "love") {
      // Batch 3:套用好感度變動
      let target = ln.targetName;
      if (!target) {
        // 沒指定 → 用 gameUI.love.charId 對應角色,否則第一個非主角角色
        const u = state.gameUI && state.gameUI.love;
        const ch = u && u.charId
          ? state.characters.find(c => c.id === u.charId)
          : state.characters.find(c => c.kind !== "protagonist");
        if (ch) target = ch.name;
      }
      if (target) {
        const cur = state.loveValues[target] || state.loveInitial[target] || 0;
        let next;
        if (ln.operator === "=") next = ln.value;
        else if (ln.operator === "+") next = cur + ln.value;
        else next = cur - ln.value;
        state.loveValues[target] = Math.max(0, Math.min(100, next));
      }
    }
  }
  return activeChar;
}

export {
  placeCharacter,
  computeStageStateAt,
};
