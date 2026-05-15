"use strict";

// ============================================================
//  Data Model
// ============================================================

const SAMPLE_SCRIPT = `[bg: 黃昏]
放學後的圖書館，夕陽透過窗戶灑進來。

學長[?][微笑][右]：嗨，原來你也在這裡。
我[害羞][左]：這個聲音...是？
學長[認真][右]：是我啊，怎麼了？
我[驚訝][左]：學...學長！

[bg: 教室]
學長[微笑][中]：要不要一起去買杯咖啡？

[選項]
- 好啊
- 改天吧
- * 我...我也喜歡你

我[害羞]：我...我也喜歡你。

[cg: 告白]
這就是我們故事的開始。
[cg off]

[離場]
（完）`;

const SAMPLE_CHARACTERS = [
  {
    id: "senpai",
    name: "學長",
    color: "#c4a265",
    emotions: ["微笑", "認真", "溫柔", "驚訝"],
    portraits: {} // emotion -> dataUrl, empty = use placeholder
  },
  {
    id: "me",
    name: "我",
    color: "#d4869a",
    emotions: ["普通", "害羞", "開心", "緊張"],
    portraits: {}
  },
  {
    id: "classmate",
    name: "同學",
    color: "#8b9fd4",
    emotions: ["普通", "驚訝", "得意"],
    portraits: {}
  }
];

const SAMPLE_BACKGROUNDS = {
  "黃昏": { type: "preset", className: "stage-bg-sunset" },
  "教室": { type: "preset", className: "stage-bg-classroom" },
  "夜晚": { type: "preset", className: "stage-bg-night" },
  "default": { type: "preset", className: "stage-bg-default" }
};

// ============================================================
//  State
// ============================================================

const DEFAULT_DIALOG_STYLE = { color: "#0d0716", opacity: 0.88 };

const state = {
  script: "",
  characters: JSON.parse(JSON.stringify(SAMPLE_CHARACTERS)),
  backgrounds: { ...SAMPLE_BACKGROUNDS },
  cgs: {},            // name -> { dataUrl }
  cgOrder: [],        // for managing UI ordering
  parsed: [],
  currentIndex: 0,
  ratio: "16:9",
  typingTimer: null,
  isTyping: false,
  fullText: "",
  dialogStyle: { ...DEFAULT_DIALOG_STYLE },
  // live stage state
  stage: {
    bg: "default",
    slots: { 左: null, 中: null, 右: null },
    cg: null,         // { name, hideDialog } or null
  }
};

// Curated presets for the dialog box appearance.
const DIALOG_PRESETS = [
  { id: "default",  name: "深紫（預設）", color: "#0d0716", opacity: 0.88 },
  { id: "midnight", name: "深夜藍",       color: "#0a1628", opacity: 0.85 },
  { id: "rose",     name: "玫瑰",         color: "#3a1424", opacity: 0.82 },
  { id: "forest",   name: "森林",         color: "#0f2118", opacity: 0.85 },
  { id: "wine",     name: "酒紅",         color: "#2a0a14", opacity: 0.85 },
  { id: "parchment",name: "羊皮紙",       color: "#3a2810", opacity: 0.82 },
  { id: "ink",      name: "純黑",         color: "#000000", opacity: 0.78 },
];

// ============================================================
//  Parser
//  Format: 角色[emotion][position][?][?:某人]：text
//          [bg: name]
//          [離場] / [無人] / [退場]
//          [cg: name]       — show CG, dialog box visible
//          [cg full: name]  — show CG, hide dialog box
//          [cg off]         — hide CG
//          [選項]           — start a choices block
//            - option text
//            - * final choice (marked with *)
//          <empty or text without :> = narration
// ============================================================

const LINE_RE = /^([^:：\[]{1,24})((?:\[[^\]]+\])*)\s*[:：]\s*(.+)$/;
const CMD_BG_RE = /^\[bg\s*:\s*(.+?)\]$/i;
const CMD_EXIT_RE = /^\[(離場|無人|退場)\]$/;
const CMD_CG_RE = /^\[cg\s*(full)?\s*:\s*(.+?)\]$/i;
const CMD_CG_OFF_RE = /^\[cg\s+off\]$/i;
const CMD_CHOICES_RE = /^\[(選項|choices?)\]$/i;
const CHOICE_ITEM_RE = /^[-－]\s*(\*?)\s*(.+)$/;
const POS_TAGS = ["左", "中", "右"];
// Bracket content > this many characters is treated as a name-override
// (descriptive alias) instead of an emotion label.
const ALIAS_BRACKET_THRESHOLD = 8;

function parseLine(raw, idx) {
  const line = raw.trim();
  if (!line) return { type: "blank", idx, raw };

  // line-comment: `// xxx` or `# xxx` are skipped during preview
  if (/^(\/\/|#)/.test(line)) return { type: "blank", idx, raw };

  // bg command
  const bgMatch = line.match(CMD_BG_RE);
  if (bgMatch) return { type: "bg", idx, raw, bgName: bgMatch[1].trim() };

  // exit command
  if (CMD_EXIT_RE.test(line)) return { type: "exit", idx, raw };

  // cg off
  if (CMD_CG_OFF_RE.test(line)) return { type: "cg_off", idx, raw };

  // cg show
  const cgMatch = line.match(CMD_CG_RE);
  if (cgMatch) {
    return {
      type: "cg",
      idx, raw,
      cgName: cgMatch[2].trim(),
      hideDialog: !!cgMatch[1], // [cg full: ...] hides dialog box
    };
  }

  // choices start marker
  if (CMD_CHOICES_RE.test(line)) return { type: "choices_start", idx, raw };

  // dialog
  const m = line.match(LINE_RE);
  if (m) {
    const name = m[1].trim();
    const tagsRaw = m[2] || "";
    const text = m[3].trim();
    const tags = [...tagsRaw.matchAll(/\[([^\]]+)\]/g)].map(t => t[1].trim());
    let position = null, emotion = null;
    let nameHidden = false;
    let nameOverride = null;
    // Look up speaker's known emotions so we can disambiguate brackets.
    const ch = (typeof state !== "undefined" && state.characters)
      ? state.characters.find(c => c.name === name)
      : null;
    const knownEmotions = ch && Array.isArray(ch.emotions) ? ch.emotions : null;
    for (const t of tags) {
      if (POS_TAGS.includes(t)) {
        position = t;
      } else if (t === "?" || t === "？" || t === "???") {
        nameHidden = true;
      } else if (/^[?？][:：]/.test(t)) {
        // [?:某人] / [？：某人] — hide real name, show override
        nameHidden = true;
        nameOverride = t.slice(2).trim() || null;
      } else if (knownEmotions && knownEmotions.includes(t)) {
        // matches a defined emotion → it's an emotion
        emotion = t;
      } else if (emotion || t.length >= ALIAS_BRACKET_THRESHOLD) {
        // emotion slot already filled, OR long descriptive text → alias
        // (matches the in-bracket picker logic so behaviour is consistent)
        nameHidden = true;
        nameOverride = t;
      } else {
        // short, undefined → fall back to emotion (allows new emotion names)
        emotion = t;
      }
    }
    return {
      type: "dialog",
      idx, raw,
      speaker: name,
      text,
      position,
      emotion,
      nameHidden,
      nameOverride,
    };
  }

  // choice item (`- text` or `- * text`)
  const ci = line.match(CHOICE_ITEM_RE);
  if (ci) return { type: "choice_item", idx, raw, isFinal: ci[1] === "*", text: ci[2].trim() };

  // narration
  return { type: "narration", idx, raw, text: line };
}

// Second pass: collapse `choices_start` + following `choice_item`s into a single `choices` node.
function collapseChoices(lines) {
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const ln = lines[i];
    if (ln.type === "choices_start") {
      const items = [];
      let j = i + 1;
      while (j < lines.length && lines[j].type === "choice_item") {
        items.push({ text: lines[j].text, isFinal: lines[j].isFinal });
        j++;
      }
      if (items.length > 0) {
        // ensure at least one final; if none marked, last one is final by default
        const hasFinal = items.some(it => it.isFinal);
        if (!hasFinal) items[items.length - 1].isFinal = true;
        out.push({
          type: "choices",
          idx: ln.idx,
          raw: ln.raw,
          items,
        });
      }
      i = j;
    } else if (ln.type === "choice_item") {
      // orphan choice item (no preceding [選項]) — treat as narration
      out.push({ type: "narration", idx: ln.idx, raw: ln.raw, text: ln.raw });
      i++;
    } else {
      out.push(ln);
      i++;
    }
  }
  return out;
}

function parseScript(text) {
  const raw = text.split("\n").map(parseLine).filter(l => l.type !== "blank");
  return collapseChoices(raw);
}

// ============================================================
//  Render
// ============================================================

const els = {
  stage: document.getElementById("stage"),
  stageBg: document.getElementById("stageBg"),
  characters: document.getElementById("characters"),
  stageCg: document.getElementById("stageCg"),
  choicesOverlay: document.getElementById("choicesOverlay"),
  dialogBox: document.getElementById("dialogBox"),
  dialogSpeaker: document.getElementById("dialogSpeaker"),
  dialogText: document.getElementById("dialogText"),
  dialogIndicator: document.getElementById("dialogIndicator"),
  dialogProgress: document.getElementById("dialogProgress"),
  scriptArea: document.getElementById("scriptArea"),
  lineCount: document.getElementById("lineCount"),
};

function findCharacter(name) {
  return state.characters.find(c => c.name === name);
}

// Place a character into the stage state for a dialog line.
// If position is unspecified, fall back to whichever slot the char is already in, else 中.
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

// Compute stage state up to and including line index `upToIdx`.
function computeStageStateAt(parsedLines, upToIdx) {
  state.stage = { bg: "default", slots: { 左: null, 中: null, 右: null }, cg: null };
  let activeChar = null;
  for (let i = 0; i <= upToIdx && i < parsedLines.length; i++) {
    const ln = parsedLines[i];
    if (ln.type === "bg") {
      state.stage.bg = ln.bgName;
    } else if (ln.type === "exit") {
      state.stage.slots = { 左: null, 中: null, 右: null };
      activeChar = null;
    } else if (ln.type === "cg") {
      state.stage.cg = { name: ln.cgName, hideDialog: ln.hideDialog };
    } else if (ln.type === "cg_off") {
      state.stage.cg = null;
    } else if (ln.type === "dialog") {
      const ch = findCharacter(ln.speaker);
      if (ch) {
        placeCharacter(ch.id, ln.emotion, ln.position);
        activeChar = ch.id;
      } else {
        activeChar = null;
      }
    } else if (ln.type === "narration") {
      // narration doesn't change slot occupancy or active char highlight
    }
  }
  return activeChar;
}

function renderBackground() {
  const bgKey = state.stage.bg;
  const bg = state.backgrounds[bgKey] || state.backgrounds.default;
  // remove any preset class then add the current one
  els.stageBg.className = "stage-bg";
  if (bg.type === "preset") {
    els.stageBg.classList.add(bg.className);
    els.stageBg.style.backgroundImage = "";
  } else if (bg.type === "image") {
    els.stageBg.style.backgroundImage = `url(${bg.dataUrl})`;
  }
}

// SVG silhouette for placeholder portrait
function svgPortrait(color, label) {
  const safe = (label || "?").slice(0, 1);
  // a simple stylized silhouette with initial
  return `
  <svg viewBox="0 0 200 400" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMax meet" style="width:100%;height:100%;display:block;">
    <defs>
      <linearGradient id="grad-${color.replace('#','')}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${color}" stop-opacity="0.95"/>
        <stop offset="100%" stop-color="${color}" stop-opacity="0.45"/>
      </linearGradient>
    </defs>
    <!-- body/torso silhouette -->
    <path d="M 100 80
             C 70 80, 55 110, 60 140
             L 50 200
             C 30 230, 25 290, 35 380
             L 165 380
             C 175 290, 170 230, 150 200
             L 140 140
             C 145 110, 130 80, 100 80 Z"
          fill="url(#grad-${color.replace('#','')})"
          stroke="${color}"
          stroke-width="1.5"
          stroke-opacity="0.6"/>
    <!-- head -->
    <circle cx="100" cy="55" r="38" fill="url(#grad-${color.replace('#','')})" stroke="${color}" stroke-width="1.5" stroke-opacity="0.6"/>
    <!-- initial letter -->
    <text x="100" y="68" text-anchor="middle"
          font-family="Cormorant Garamond, serif" font-style="italic" font-size="36"
          fill="${color === '#c4a265' ? '#2a1f10' : '#fff'}" fill-opacity="0.85" font-weight="600">${safe}</text>
  </svg>`;
}

function renderCharacters(activeCharId) {
  els.characters.innerHTML = "";
  for (const pos of POS_TAGS) {
    const slot = document.createElement("div");
    slot.className = "char-slot";
    slot.dataset.pos = pos;

    const occupant = state.stage.slots[pos];
    if (occupant) {
      const ch = state.characters.find(c => c.id === occupant.charId);
      if (ch) {
        const fig = document.createElement("div");
        fig.className = "char-figure" + (activeCharId === ch.id ? " active" : "");

        // portrait or placeholder
        const portraitSrc = ch.portraits[occupant.emotion] || ch.portraits["__default__"];
        if (portraitSrc) {
          const img = document.createElement("img");
          img.className = "char-portrait";
          img.src = portraitSrc;
          fig.appendChild(img);
        } else {
          const ph = document.createElement("div");
          ph.className = "char-portrait-placeholder";
          ph.innerHTML = svgPortrait(ch.color, ch.name);
          fig.appendChild(ph);
        }

        // badge
        const badge = document.createElement("div");
        badge.className = "char-badge";
        badge.style.color = ch.color;
        badge.textContent = ch.name + (occupant.emotion ? ` · ${occupant.emotion}` : "");
        fig.appendChild(badge);

        slot.appendChild(fig);
      }
    }
    els.characters.appendChild(slot);
  }
}

function renderDialog(line) {
  // clear typing
  if (state.typingTimer) { clearInterval(state.typingTimer); state.typingTimer = null; }
  els.dialogIndicator.classList.remove("show");

  // dialog or narration?
  if (!line) {
    els.dialogBox.style.display = "none";
    return;
  }
  els.dialogBox.style.display = "block";

  if (line.type === "narration") {
    els.dialogSpeaker.textContent = "";
    els.dialogSpeaker.style.display = "none";
    els.dialogText.classList.add("narration");
    typewrite(line.text);
  } else if (line.type === "dialog") {
    const ch = findCharacter(line.speaker);
    els.dialogSpeaker.style.display = "flex";

    // name display logic: [?] → ???, [?:某人] → 某人, otherwise → real name
    let displayName = line.speaker;
    let displayColor = ch ? ch.color : "var(--text-primary)";
    if (line.nameHidden) {
      displayName = line.nameOverride || "???";
      displayColor = "var(--text-muted)"; // dim for unknown
    }
    els.dialogSpeaker.textContent = displayName;
    els.dialogSpeaker.style.color = displayColor;
    els.dialogText.classList.remove("narration");
    typewrite(line.text);
  } else {
    els.dialogBox.style.display = "none";
  }
}

// Render the CG layer based on current stage state.
function renderCg() {
  const cg = state.stage.cg;
  els.stageCg.innerHTML = "";
  if (!cg) {
    els.stageCg.classList.remove("show");
    els.stage.classList.remove("cg-active", "cg-hide-dialog");
    return;
  }
  const cgData = state.cgs[cg.name];
  if (cgData && cgData.dataUrl) {
    const img = document.createElement("img");
    img.src = cgData.dataUrl;
    els.stageCg.appendChild(img);
  } else {
    // placeholder when CG name doesn't exist
    const empty = document.createElement("div");
    empty.className = "stage-cg-empty";
    empty.textContent = `CG: ${cg.name}`;
    els.stageCg.appendChild(empty);
  }
  els.stageCg.classList.add("show");
  els.stage.classList.add("cg-active");
  els.stage.classList.toggle("cg-hide-dialog", !!cg.hideDialog);
}

// Render choices overlay in static (preview) mode — shows all 3 with final highlighted.
function renderChoicesStatic(choicesLine) {
  els.choicesOverlay.innerHTML = "";
  if (!choicesLine || !choicesLine.items) {
    els.choicesOverlay.classList.remove("show");
    return;
  }
  for (const item of choicesLine.items) {
    const el = document.createElement("div");
    el.className = "choice-item show" + (item.isFinal ? " final" : "");
    el.textContent = item.text;
    els.choicesOverlay.appendChild(el);
  }
  els.choicesOverlay.classList.add("show");
}

function typewrite(text) {
  state.fullText = text;
  state.isTyping = true;
  els.dialogText.textContent = "";
  let i = 0;
  state.typingTimer = setInterval(() => {
    i++;
    els.dialogText.textContent = text.slice(0, i);
    if (i >= text.length) {
      clearInterval(state.typingTimer);
      state.typingTimer = null;
      state.isTyping = false;
      els.dialogIndicator.classList.add("show");
    }
  }, 45);
}

function updateProgress() {
  const total = state.parsed.filter(p => p.type === "dialog" || p.type === "narration" || p.type === "choices").length;
  const current = state.parsed.slice(0, state.currentIndex + 1).filter(p => p.type === "dialog" || p.type === "narration" || p.type === "choices").length;
  els.dialogProgress.textContent = total > 0 ? `${String(current).padStart(2, "0")} / ${String(total).padStart(2, "0")}` : "";
}

function renderLineCount() {
  const visible = state.parsed.filter(p => p.type === "dialog" || p.type === "narration" || p.type === "choices").length;
  els.lineCount.textContent = `${visible} 步 · ${state.parsed.length} 行`;
}

// Main render: show stage + current dialog at currentIndex.
function renderAt(idx) {
  // clamp
  if (idx < 0) idx = 0;
  if (idx >= state.parsed.length) idx = state.parsed.length - 1;
  state.currentIndex = idx;

  const activeChar = computeStageStateAt(state.parsed, idx);
  renderBackground();
  renderCharacters(activeChar);
  renderCg();

  const cur = state.parsed[idx];
  if (cur && cur.type === "choices") {
    // show choices preview, hide dialog box
    renderChoicesStatic(cur);
    renderDialog(null);
  } else if (cur && (cur.type === "dialog" || cur.type === "narration")) {
    renderChoicesStatic(null);
    renderDialog(cur);
  } else if (cur) {
    renderChoicesStatic(null);
    renderDialog(null);
  }
  updateProgress();
}

// ============================================================
//  Navigation
// ============================================================

function isVisibleType(ln) {
  return ln.type === "dialog" || ln.type === "narration" || ln.type === "choices";
}

function nextLine() {
  if (state.isTyping) {
    // finish typing instantly
    if (state.typingTimer) { clearInterval(state.typingTimer); state.typingTimer = null; }
    els.dialogText.textContent = state.fullText;
    state.isTyping = false;
    els.dialogIndicator.classList.add("show");
    return;
  }
  let next = state.currentIndex + 1;
  while (next < state.parsed.length) {
    if (isVisibleType(state.parsed[next])) break;
    next++;
  }
  if (next >= state.parsed.length) return;
  renderAt(next);
}

function prevLine() {
  // If still typing, just finish — don't go back yet (matches VN convention).
  if (state.isTyping) {
    if (state.typingTimer) { clearInterval(state.typingTimer); state.typingTimer = null; }
    els.dialogText.textContent = state.fullText;
    state.isTyping = false;
    els.dialogIndicator.classList.add("show");
    return;
  }
  let prev = state.currentIndex - 1;
  while (prev >= 0) {
    if (isVisibleType(state.parsed[prev])) break;
    prev--;
  }
  if (prev < 0) return;
  renderAt(prev);
}

function jumpToStart() {
  let i = 0;
  while (i < state.parsed.length) {
    if (isVisibleType(state.parsed[i])) break;
    i++;
  }
  renderAt(Math.min(i, state.parsed.length - 1));
}

// ============================================================
//  Wire-up
// ============================================================

function reparseAndRender(resetIndex = false) {
  state.parsed = parseScript(state.script);
  renderLineCount();
  if (resetIndex || state.currentIndex >= state.parsed.length) {
    jumpToStart();
  } else {
    renderAt(state.currentIndex);
  }
}

function setScript(text) {
  state.script = text;
  els.scriptArea.value = text;
  reparseAndRender(true);
}

function setRatio(r) {
  state.ratio = r;
  els.stage.dataset.ratio = r;
  document.querySelectorAll(".ratio-toggle button").forEach(b => {
    b.classList.toggle("active", b.dataset.ratio === r);
  });
}

// events
els.scriptArea.addEventListener("input", (e) => {
  state.script = e.target.value;
  reparseAndRender(false);
});

// ----- Bidirectional binding: script cursor <-> preview line -----

// Find the latest parsed step whose source line is at or before `rawLineNo`.
function findParsedStepForRawLine(rawLineNo) {
  let result = -1;
  for (let i = 0; i < state.parsed.length; i++) {
    const item = state.parsed[i];
    if (typeof item.idx !== "number") continue;
    if (item.idx <= rawLineNo) result = i;
    else break;
  }
  return result;
}

function getCaretRawLine() {
  const ta = els.scriptArea;
  const pos = ta.selectionStart || 0;
  const before = ta.value.slice(0, pos);
  return (before.match(/\n/g) || []).length;
}

let cursorSyncTimer = null;
let suppressCursorSync = false;
function scheduleCursorSync() {
  if (suppressCursorSync) return;
  if (cursorSyncTimer) clearTimeout(cursorSyncTimer);
  cursorSyncTimer = setTimeout(() => {
    const line = getCaretRawLine();
    const step = findParsedStepForRawLine(line);
    if (step >= 0 && step !== state.currentIndex) {
      // walk to nearest visible step (don't render an invisible 'bg' or 'exit' line)
      let target = step;
      while (target >= 0 && !isVisibleType(state.parsed[target])) target--;
      if (target >= 0 && target !== state.currentIndex) {
        renderAt(target);
      }
    }
  }, 80);
}

els.scriptArea.addEventListener("click", scheduleCursorSync);
els.scriptArea.addEventListener("keyup", (e) => {
  if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End"].includes(e.key)) {
    scheduleCursorSync();
  }
});

// Highlight the source line of the currently-previewed step in the textarea.
const scriptHighlightEl = document.getElementById("scriptCurrentLine");
function updateScriptLineHighlight() {
  if (!scriptHighlightEl) return;
  const step = state.parsed[state.currentIndex];
  if (!step || typeof step.idx !== "number") {
    scriptHighlightEl.classList.remove("show");
    return;
  }
  const ta = els.scriptArea;
  const cs = window.getComputedStyle(ta);
  const lineHeight = parseFloat(cs.lineHeight) || (parseFloat(cs.fontSize) * 1.9);
  const padTop = parseFloat(cs.paddingTop) || 0;
  const top = padTop + step.idx * lineHeight - ta.scrollTop;
  scriptHighlightEl.style.top = top + "px";
  scriptHighlightEl.style.height = lineHeight + "px";
  scriptHighlightEl.classList.add("show");
}
els.scriptArea.addEventListener("scroll", updateScriptLineHighlight);
window.addEventListener("resize", updateScriptLineHighlight);

// Auto-scroll script to current line when preview advances (but not while editing)
let lastScrolledStep = -1;
function autoScrollScriptToCurrentLine() {
  const step = state.parsed[state.currentIndex];
  if (!step || typeof step.idx !== "number") return;
  if (lastScrolledStep === state.currentIndex) return;
  lastScrolledStep = state.currentIndex;
  if (document.activeElement === els.scriptArea) return;  // don't yank cursor while editing
  const ta = els.scriptArea;
  const cs = window.getComputedStyle(ta);
  const lineHeight = parseFloat(cs.lineHeight) || 26.6;
  const padTop = parseFloat(cs.paddingTop) || 0;
  const targetTop = padTop + step.idx * lineHeight;
  const visTop = ta.scrollTop;
  const visBottom = visTop + ta.clientHeight;
  if (targetTop < visTop + 40 || targetTop > visBottom - 40) {
    ta.scrollTop = targetTop - ta.clientHeight / 2 + lineHeight / 2;
  }
}

// Hook into renderAt — every preview update refreshes the highlight + auto-scrolls.
const _origRenderAt = renderAt;
renderAt = function(idx) {
  _origRenderAt(idx);
  updateScriptLineHighlight();
  autoScrollScriptToCurrentLine();
};

// Run highlight once after install (init already happened above).
requestAnimationFrame(updateScriptLineHighlight);
window.addEventListener("load", updateScriptLineHighlight);

// snippet insertion buttons
const SNIPPETS = {
  bg: `\n[bg: ]\n`,
  exit: `\n[離場]\n`,
  cg: `\n[cg: ]\n旁白文字…\n[cg off]\n`,
  cgoff: `\n[cg off]\n`,
  choices: `\n[選項]\n- 選項一\n- 選項二\n- * 最終選擇（加 * 標記）\n`,
  unknown: `角色名[?]：他的聲音很陌生。\n`,
};

// Where (relative to inserted text end) the cursor should land for each snippet.
// negative = chars from end of insertion. null = stay at end.
const SNIPPET_CURSOR_OFFSET = {
  bg: -2,       // place inside `[bg: |]\n`
  cg: -("\n旁白文字…\n[cg off]\n".length + 1),  // inside `[cg: |]`
};

function insertSnippet(snippetKey) {
  const ta = els.scriptArea;
  const snippet = SNIPPETS[snippetKey] || "";
  if (!snippet) return;
  const start = ta.selectionStart;
  const end = ta.selectionEnd;
  const before = ta.value.slice(0, start);
  const after = ta.value.slice(end);
  // ensure snippet starts on a new line if cursor not at line start
  let prefix = "";
  if (before.length > 0 && !before.endsWith("\n") && !snippet.startsWith("\n")) {
    prefix = "\n";
  }
  const insertText = prefix + snippet;
  ta.value = before + insertText + after;
  state.script = ta.value;
  // place cursor — by default at end of inserted text, or at snippet-specific offset
  const offset = SNIPPET_CURSOR_OFFSET[snippetKey];
  const cursorPos = (offset !== undefined && offset !== null)
    ? start + insertText.length + offset
    : start + insertText.length;
  ta.focus();
  ta.setSelectionRange(cursorPos, cursorPos);
  reparseAndRender(false);
  saveToStorage();
  // immediately offer autocomplete if cursor is now inside [bg:/cg:
  if (snippetKey === "bg" || snippetKey === "cg") {
    setTimeout(maybeShowAutoComplete, 0);
  }
}

document.querySelectorAll(".snippet-btn").forEach(b => {
  b.addEventListener("click", () => insertSnippet(b.dataset.snippet));
});

// Split stage into 3 zones: left ~25% = prev, middle = next (default), right ~25% = next
// We also have explicit hover chevrons at left/right edges.
els.stage.addEventListener("click", (e) => {
  const rect = els.stage.getBoundingClientRect();
  const xRatio = (e.clientX - rect.left) / rect.width;
  if (xRatio < 0.22) prevLine();
  else nextLine();
});
document.getElementById("stageNavLeft").addEventListener("click", (e) => { e.stopPropagation(); prevLine(); });
document.getElementById("stageNavRight").addEventListener("click", (e) => { e.stopPropagation(); nextLine(); });

// Keyboard navigation — only when textarea is NOT focused
document.addEventListener("keydown", (e) => {
  // skip if any text input or modal is active
  const ae = document.activeElement;
  const inText = ae && (ae.tagName === "TEXTAREA" || ae.tagName === "INPUT" || ae.isContentEditable);
  if (inText) return;
  // skip if a modal is open
  if (document.querySelector(".modal-backdrop.show, .inline-modal-backdrop.show")) return;
  if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === " " || e.key === "Enter") {
    e.preventDefault();
    nextLine();
  } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
    e.preventDefault();
    prevLine();
  } else if (e.key === "Home") {
    e.preventDefault();
    jumpToStart();
  }
});

document.querySelectorAll(".ratio-toggle button").forEach(b => {
  b.addEventListener("click", () => setRatio(b.dataset.ratio));
});

document.getElementById("btnReset").addEventListener("click", async () => {
  const choice = await inlineChoose({
    title: "重設選項",
    message: "選擇要做什麼：",
    options: [
      { key: "sample", label: "↻ 載入範例劇本", desc: "只覆蓋劇本內容,角色和上傳圖片保留" },
      { key: "clearScript", label: "✕ 清空劇本", desc: "把劇本欄變空白,角色和圖片保留" },
      { key: "clearAll", label: "⚠ 全部重置", desc: "刪除角色、上傳圖片、劇本、所有設定（無法復原）", danger: true },
    ],
  });
  if (!choice) return;
  if (choice === "sample") {
    setScript(SAMPLE_SCRIPT);
    saveToStorage();
    showToast("✨ 已載入範例劇本", "success");
  } else if (choice === "clearScript") {
    setScript("");
    saveToStorage();
    showToast("✨ 劇本已清空", "success");
  } else if (choice === "clearAll") {
    const confirmAll = await inlineConfirm({
      title: "⚠ 真的要全部重置?",
      message: "角色、上傳的所有圖片、劇本與設定都會被永久刪除,且無法復原。",
      okText: "全部重置",
      danger: true,
    });
    if (!confirmAll) return;
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
  }
});

// ============================================================
//  Storage (localStorage persistence)
// ============================================================

const STORAGE_KEY = "otome_studio_v1";
const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5MB
const STORAGE_WARN_BYTES = 4 * 1024 * 1024; // warn at 4MB usage

function saveToStorage() {
  setSaveIndicator("saving");
  try {
    const payload = {
      v: 1,
      script: state.script,
      characters: state.characters,
      // backgrounds: only save image-type ones, presets are static
      backgrounds: Object.fromEntries(
        Object.entries(state.backgrounds).filter(([k, v]) => v.type === "image")
      ),
      bgOrder: state.bgOrder,
      cgs: state.cgs,
      cgOrder: state.cgOrder,
      ratio: state.ratio,
      dialogStyle: state.dialogStyle,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    updateStorageMeter();
    setSaveIndicator("saved");
    return true;
  } catch (e) {
    setSaveIndicator("error");
    showToast("⚠ 儲存空間已滿,最近上傳的圖片無法保存(重整會丟失)", "warn", 4000);
    return false;
  }
}

// Save-state indicator in topbar.
let _saveIndicatorTimer = null;
function setSaveIndicator(state) {
  const el = document.getElementById("saveIndicator");
  if (!el) return;
  el.classList.remove("saving", "saved", "error");
  el.classList.add(state);
  const text = el.querySelector(".save-text");
  if (state === "saving") {
    if (text) text.textContent = "儲存中…";
  } else if (state === "saved") {
    if (text) text.textContent = "已儲存";
    if (_saveIndicatorTimer) clearTimeout(_saveIndicatorTimer);
    // brief "just saved" flash, then settle
    _saveIndicatorTimer = setTimeout(() => {
      const t = el.querySelector(".save-text");
      if (t) t.textContent = "已儲存";
    }, 1200);
  } else if (state === "error") {
    if (text) text.textContent = "儲存失敗";
  }
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const payload = JSON.parse(raw);
    if (payload.script !== undefined) state.script = payload.script;
    if (Array.isArray(payload.characters)) state.characters = payload.characters;
    // merge backgrounds: keep presets, add saved image bgs
    state.backgrounds = { ...SAMPLE_BACKGROUNDS };
    if (payload.backgrounds) {
      for (const [k, v] of Object.entries(payload.backgrounds)) {
        state.backgrounds[k] = v;
      }
    }
    if (Array.isArray(payload.bgOrder)) state.bgOrder = payload.bgOrder;
    if (payload.cgs && typeof payload.cgs === "object") state.cgs = payload.cgs;
    if (Array.isArray(payload.cgOrder)) state.cgOrder = payload.cgOrder;
    if (payload.ratio) state.ratio = payload.ratio;
    if (payload.dialogStyle && typeof payload.dialogStyle === "object") {
      state.dialogStyle = {
        color: typeof payload.dialogStyle.color === "string" ? payload.dialogStyle.color : DEFAULT_DIALOG_STYLE.color,
        opacity: typeof payload.dialogStyle.opacity === "number" ? payload.dialogStyle.opacity : DEFAULT_DIALOG_STYLE.opacity,
      };
    }
    return true;
  } catch (e) {
    console.warn("Failed to load from storage:", e);
    return false;
  }
}

function getStorageUsage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || "";
    return raw.length * 2; // rough: 2 bytes per char (UTF-16)
  } catch { return 0; }
}

function fmtBytes(n) {
  if (n < 1024) return n + " B";
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
  return (n / (1024 * 1024)).toFixed(2) + " MB";
}

function updateStorageMeter() {
  const used = getStorageUsage();
  const charCount = state.characters.length;
  const portraitCount = state.characters.reduce((a, c) => a + Object.keys(c.portraits || {}).length, 0);
  const bgImgCount = Object.values(state.backgrounds).filter(b => b.type === "image").length;
  const cgCount = Object.values(state.cgs || {}).filter(c => c && c.dataUrl).length;
  const imgCount = portraitCount + bgImgCount + cgCount;

  const meter = document.getElementById("storageMeter");
  if (meter) {
    meter.innerHTML = `儲存:<strong>${fmtBytes(used)}</strong> · ${charCount} 角色 · ${imgCount} 張圖`;
    meter.style.color = used > STORAGE_WARN_BYTES ? "var(--danger)" : "";
  }

  // topbar dot
  const dot = document.getElementById("storageDot");
  if (dot) {
    dot.classList.remove("warn", "danger");
    if (used > STORAGE_WARN_BYTES) dot.classList.add("danger");
    else if (used > STORAGE_WARN_BYTES * 0.7) dot.classList.add("warn");
    dot.title = `本機儲存:${fmtBytes(used)} / 約 5 MB · ${charCount} 角色 · ${imgCount} 張圖`;
  }
}

// ============================================================
//  Image utilities
// ============================================================

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Downscale large images to save space. Returns { dataUrl, width, height, original: {width, height}, scaled: bool }
function downscaleImage(dataUrl, maxDim = 1024) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const ow = img.naturalWidth, oh = img.naturalHeight;
      const scale = Math.min(1, maxDim / Math.max(ow, oh));
      if (scale === 1) {
        resolve({ dataUrl, width: ow, height: oh, original: { width: ow, height: oh }, scaled: false });
        return;
      }
      const width = Math.round(ow * scale);
      const height = Math.round(oh * scale);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);
      const isPng = dataUrl.startsWith("data:image/png");
      const out = canvas.toDataURL(isPng ? "image/png" : "image/jpeg", 0.88);
      resolve({ dataUrl: out, width, height, original: { width: ow, height: oh }, scaled: true });
    };
    img.onerror = () => resolve({ dataUrl, width: 0, height: 0, original: { width: 0, height: 0 }, scaled: false });
    img.src = dataUrl;
  });
}

function describeScale(result) {
  if (!result || !result.scaled) {
    return result && result.width ? `${result.width}×${result.height}` : "";
  }
  return `已壓縮 ${result.original.width}×${result.original.height} → ${result.width}×${result.height}`;
}

// Attach drag-drop image upload to an element. handler(file) is async.
function attachDropTarget(el, handler) {
  let depth = 0;
  el.addEventListener("dragenter", (e) => {
    if (!e.dataTransfer || !Array.from(e.dataTransfer.types || []).includes("Files")) return;
    e.preventDefault();
    depth++;
    el.classList.add("drag-over");
  });
  el.addEventListener("dragover", (e) => {
    if (!e.dataTransfer || !Array.from(e.dataTransfer.types || []).includes("Files")) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  });
  el.addEventListener("dragleave", (e) => {
    depth = Math.max(0, depth - 1);
    if (depth === 0) el.classList.remove("drag-over");
  });
  el.addEventListener("drop", async (e) => {
    e.preventDefault();
    depth = 0;
    el.classList.remove("drag-over");
    const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (!file) return;
    if (!/^image\//.test(file.type)) {
      showToast("請拖放圖片檔（JPG / PNG / WebP）", "warn");
      return;
    }
    await handler(file);
  });
}

// ============================================================
//  Toast
// ============================================================

let toastTimer = null;
function showToast(msg, variant = "", duration = 2500) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.className = "toast show " + variant;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    t.classList.remove("show");
  }, duration);
}

// ============================================================
//  Asset Manager UI
// ============================================================

const modalEl = document.getElementById("assetsModal");

function openModal(tab = "chars") {
  modalEl.classList.add("show");
  switchTab(tab);
  renderCharList();
  renderBgList();
  renderCgList();
  renderStyleTab();
  updateStorageMeter();
}

function closeModal() {
  modalEl.classList.remove("show");
  // re-render preview in case data changed
  reparseAndRender(false);
}

function switchTab(name) {
  document.querySelectorAll(".tab").forEach(t => {
    t.classList.toggle("active", t.dataset.tab === name);
  });
  document.querySelectorAll(".tab-panel").forEach(p => {
    p.classList.toggle("active", p.dataset.tab === name);
  });
  const titles = { chars: "角色 · 立繪", bgs: "場景 · 背景", cgs: "CG · 圖卡", style: "🎨 樣式" };
  document.getElementById("modalTitle").textContent = titles[name] || "資產管理";
}

// ----- Dialog box style customization -----

function hexToRgb(hex) {
  const m = String(hex || "").match(/^#([0-9a-f]{6})$/i);
  if (!m) return { r: 13, g: 7, b: 22 };
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function applyDialogStyle() {
  const { color, opacity } = state.dialogStyle;
  const { r, g, b } = hexToRgb(color);
  // Slightly lighter shade for the gradient bottom — shift toward warmer
  const r2 = Math.min(255, r + 10);
  const g2 = Math.min(255, g + 6);
  const b2 = Math.min(255, b + 14);
  const root = document.documentElement;
  root.style.setProperty("--dialog-bg-rgb", `${r}, ${g}, ${b}`);
  root.style.setProperty("--dialog-bg-rgb-2", `${r2}, ${g2}, ${b2}`);
  root.style.setProperty("--dialog-bg-alpha", String(opacity));
}

function renderStyleTab() {
  const presetsEl = document.getElementById("dialogPresets");
  const colorEl = document.getElementById("dialogColorInput");
  const opEl = document.getElementById("dialogOpacityInput");
  const opLabel = document.getElementById("dialogOpacityLabel");
  if (!presetsEl || !colorEl || !opEl) return;

  presetsEl.innerHTML = "";
  for (const p of DIALOG_PRESETS) {
    const btn = document.createElement("button");
    btn.className = "style-preset";
    const isActive =
      p.color.toLowerCase() === (state.dialogStyle.color || "").toLowerCase() &&
      Math.abs((p.opacity || 0) - state.dialogStyle.opacity) < 0.01;
    if (isActive) btn.classList.add("active");
    btn.dataset.id = p.id;
    btn.title = `${p.name}（${p.color} · ${Math.round(p.opacity * 100)}%）`;

    const swatch = document.createElement("div");
    swatch.className = "style-preset-swatch";
    const { r, g, b } = hexToRgb(p.color);
    swatch.style.background = `linear-gradient(180deg, rgba(${r},${g},${b},${p.opacity - 0.03}), rgba(${Math.min(255,r+10)},${Math.min(255,g+6)},${Math.min(255,b+14)},${p.opacity}))`;
    btn.appendChild(swatch);
    const label = document.createElement("span");
    label.textContent = p.name;
    btn.appendChild(label);

    btn.addEventListener("click", () => {
      state.dialogStyle = { color: p.color, opacity: p.opacity };
      applyDialogStyle();
      saveToStorage();
      renderStyleTab();
    });
    presetsEl.appendChild(btn);
  }

  colorEl.value = state.dialogStyle.color;
  opEl.value = String(Math.round(state.dialogStyle.opacity * 100));
  opLabel.textContent = `${Math.round(state.dialogStyle.opacity * 100)}%`;
}

// Wire up live inputs once.
(function wireDialogStyleInputs() {
  const colorEl = document.getElementById("dialogColorInput");
  const opEl = document.getElementById("dialogOpacityInput");
  const opLabel = document.getElementById("dialogOpacityLabel");
  const resetBtn = document.getElementById("dialogStyleReset");
  if (!colorEl || !opEl || !resetBtn) return;
  colorEl.addEventListener("input", (e) => {
    state.dialogStyle.color = e.target.value;
    applyDialogStyle();
    saveToStorage();
    // refresh preset highlights
    renderStyleTab();
  });
  opEl.addEventListener("input", (e) => {
    const v = parseInt(e.target.value, 10) / 100;
    state.dialogStyle.opacity = v;
    opLabel.textContent = `${e.target.value}%`;
    applyDialogStyle();
  });
  opEl.addEventListener("change", () => {
    saveToStorage();
    renderStyleTab();
  });
  resetBtn.addEventListener("click", () => {
    state.dialogStyle = { ...DEFAULT_DIALOG_STYLE };
    applyDialogStyle();
    saveToStorage();
    renderStyleTab();
  });
})();

// ----- Character list -----

function renderCharList() {
  const list = document.getElementById("charList");
  list.innerHTML = "";
  state.characters.forEach((ch, idx) => {
    list.appendChild(renderCharCard(ch, idx));
  });
}

function renderCharCard(ch, idx) {
  const card = document.createElement("div");
  card.className = "char-card";

  // head: color dot + name + delete
  const head = document.createElement("div");
  head.className = "char-card-head";

  const dot = document.createElement("label");
  dot.className = "char-color-dot";
  dot.style.background = ch.color;
  const colorIn = document.createElement("input");
  colorIn.type = "color";
  colorIn.value = ch.color;
  colorIn.addEventListener("input", (e) => {
    ch.color = e.target.value;
    dot.style.background = ch.color;
    saveToStorage();
  });
  dot.appendChild(colorIn);
  head.appendChild(dot);

  const nameIn = document.createElement("input");
  nameIn.className = "char-name-input";
  nameIn.value = ch.name;
  nameIn.placeholder = "角色名";
  nameIn.addEventListener("input", (e) => {
    ch.name = e.target.value;
    saveToStorage();
  });
  head.appendChild(nameIn);

  const del = document.createElement("button");
  del.className = "icon-btn icon-btn-danger";
  del.innerHTML = "🗑";
  del.title = "刪除角色";
  del.addEventListener("click", async () => {
    const ok = await inlineConfirm({
      title: `刪除角色「${ch.name}」?`,
      message: "所有上傳的立繪會一起刪除,此動作無法復原。",
      okText: "刪除",
      danger: true,
    });
    if (!ok) return;
    state.characters.splice(idx, 1);
    saveToStorage();
    renderCharList();
    updateStorageMeter();
  });
  head.appendChild(del);

  card.appendChild(head);

  // emotions grid
  const grid = document.createElement("div");
  grid.className = "emotions-grid";

  ch.emotions.forEach((emo, emoIdx) => {
    grid.appendChild(renderEmotionSlot(ch, emo, emoIdx));
  });

  // add emotion button
  const addBtn = document.createElement("button");
  addBtn.className = "add-emotion-btn";
  addBtn.textContent = "+ 表情";
  addBtn.addEventListener("click", async () => {
    const name = await inlinePrompt({
      title: `新增「${ch.name}」的表情`,
      message: "例如:微笑、害羞、生氣",
      placeholder: "表情名稱",
      validate: (v) => {
        if (!v) return "請輸入名稱";
        if (ch.emotions.includes(v)) return "已有同名表情";
        return null;
      },
    });
    if (!name) return;
    ch.emotions.push(name);
    saveToStorage();
    renderCharList();
  });
  grid.appendChild(addBtn);

  card.appendChild(grid);
  return card;
}

function renderEmotionSlot(ch, emoName, emoIdx) {
  const slot = document.createElement("div");
  const hasImg = !!ch.portraits[emoName];
  slot.className = "emotion-slot" + (hasImg ? " has-image" : "");

  // thumbnail
  const thumb = document.createElement("div");
  thumb.className = "emotion-thumb";
  if (hasImg) {
    const img = document.createElement("img");
    img.src = ch.portraits[emoName];
    thumb.appendChild(img);
  } else {
    // svg placeholder
    thumb.innerHTML = svgPortrait(ch.color, ch.name);
  }
  const overlay = document.createElement("div");
  overlay.className = "emotion-thumb-overlay";
  overlay.textContent = hasImg ? "🔄 換圖" : "📁 上傳立繪";
  thumb.appendChild(overlay);
  thumb.addEventListener("click", () => {
    triggerCharImageUpload(ch, emoName);
  });
  thumb.title = "點擊或拖放圖片更換";
  attachDropTarget(thumb, (file) => applyCharImageUpload(file, ch, emoName));
  slot.appendChild(thumb);

  // name + del
  const row = document.createElement("div");
  row.className = "emotion-row";
  const nameIn = document.createElement("input");
  nameIn.className = "emotion-label-input";
  nameIn.value = emoName;
  nameIn.addEventListener("change", (e) => {
    const newName = e.target.value.trim();
    if (!newName) { e.target.value = emoName; return; }
    if (newName === emoName) return;
    if (ch.emotions.includes(newName)) {
      showToast("已有同名表情", "warn");
      e.target.value = emoName;
      return;
    }
    // rename: update emotions array + portraits map
    ch.emotions[emoIdx] = newName;
    if (ch.portraits[emoName]) {
      ch.portraits[newName] = ch.portraits[emoName];
      delete ch.portraits[emoName];
    }
    saveToStorage();
    renderCharList();
  });
  row.appendChild(nameIn);

  const delBtn = document.createElement("button");
  delBtn.className = "emotion-del";
  delBtn.innerHTML = "×";
  delBtn.title = "刪除此表情";
  delBtn.addEventListener("click", async () => {
    const ok = await inlineConfirm({
      title: `刪除表情「${emoName}」?`,
      message: "對應的立繪也會一起刪除。",
      okText: "刪除",
      danger: true,
    });
    if (!ok) return;
    ch.emotions.splice(emoIdx, 1);
    delete ch.portraits[emoName];
    saveToStorage();
    renderCharList();
  });
  row.appendChild(delBtn);
  slot.appendChild(row);

  // small "clear image" if has image
  if (hasImg) {
    const clearBtn = document.createElement("button");
    clearBtn.className = "emotion-del";
    clearBtn.textContent = "移除圖";
    clearBtn.style.fontSize = "10px";
    clearBtn.style.padding = "0";
    clearBtn.title = "移除這張立繪(保留表情)";
    clearBtn.addEventListener("click", () => {
      delete ch.portraits[emoName];
      saveToStorage();
      renderCharList();
    });
    row.appendChild(clearBtn);
  }

  return slot;
}

// Trigger file upload for a specific character's emotion
let pendingUpload = null;
function triggerCharImageUpload(ch, emoName) {
  pendingUpload = { kind: "char", ch, emoName };
  const input = document.getElementById("charImgInput");
  input.value = "";
  input.click();
}

document.getElementById("charImgInput").addEventListener("change", async (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file || !pendingUpload) return;
  await applyCharImageUpload(file, pendingUpload.ch, pendingUpload.emoName);
  pendingUpload = null;
});

async function applyCharImageUpload(file, ch, emoName) {
  if (file.size > MAX_FILE_BYTES) {
    showToast(`圖片過大(${fmtBytes(file.size)}),最多 5MB`, "warn", 3500);
    return false;
  }
  try {
    const raw = await readFileAsDataURL(file);
    const result = await downscaleImage(raw, 1200);
    ch.portraits[emoName] = result.dataUrl;
    const ok = saveToStorage();
    if (ok) {
      const note = result.scaled ? `（${describeScale(result)}）` : "";
      showToast(`✨ 已上傳「${ch.name} · ${emoName}」${note}`, "success", result.scaled ? 3500 : 2500);
      renderCharList();
    }
    return ok;
  } catch (err) {
    console.error(err);
    showToast("讀取失敗", "warn");
    return false;
  }
}

// ----- Background list -----

function renderBgList() {
  const list = document.getElementById("bgList");
  list.innerHTML = "";

  // ensure bgOrder includes all current bgs (presets first, then user)
  const allKeys = Object.keys(state.backgrounds).filter(k => k !== "default");
  state.bgOrder = state.bgOrder || [];
  // add any missing
  for (const k of allKeys) {
    if (!state.bgOrder.includes(k)) state.bgOrder.push(k);
  }
  // remove any orphans
  state.bgOrder = state.bgOrder.filter(k => state.backgrounds[k]);

  state.bgOrder.forEach((key) => {
    list.appendChild(renderBgCard(key));
  });
}

function renderBgCard(key) {
  const bg = state.backgrounds[key];
  const card = document.createElement("div");
  card.className = "bg-card";

  // thumb
  const thumb = document.createElement("div");
  thumb.className = "bg-thumb";
  if (bg.type === "image") {
    thumb.style.backgroundImage = `url(${bg.dataUrl})`;
  } else if (bg.type === "preset") {
    // apply preset class to a temp inner div
    const inner = document.createElement("div");
    inner.className = "stage-bg " + bg.className;
    inner.style.position = "absolute";
    inner.style.inset = "0";
    thumb.style.position = "relative";
    thumb.style.overflow = "hidden";
    thumb.appendChild(inner);
  }
  thumb.title = "點擊或拖放圖片更換";
  thumb.addEventListener("click", () => triggerBgImageUpload(key));
  attachDropTarget(thumb, (file) => applyBgImageUpload(file, key));
  card.appendChild(thumb);

  // name
  const nameIn = document.createElement("input");
  nameIn.className = "bg-name-input";
  nameIn.value = key;
  nameIn.placeholder = "背景名";
  nameIn.addEventListener("change", (e) => {
    const newKey = e.target.value.trim();
    if (!newKey || newKey === key) { e.target.value = key; return; }
    if (state.backgrounds[newKey]) {
      showToast("已有同名背景", "warn");
      e.target.value = key;
      return;
    }
    state.backgrounds[newKey] = state.backgrounds[key];
    delete state.backgrounds[key];
    state.bgOrder = state.bgOrder.map(k => k === key ? newKey : k);
    // also update script if current bg references this name
    saveToStorage();
    renderBgList();
  });
  card.appendChild(nameIn);

  // tag
  const tag = document.createElement("div");
  tag.className = "bg-tag";
  tag.textContent = bg.type === "preset" ? "預設" : "自訂";
  card.appendChild(tag);

  // delete (only allow on custom or rename-able presets)
  const del = document.createElement("button");
  del.className = "icon-btn icon-btn-danger";
  del.innerHTML = "🗑";
  del.title = "刪除背景";
  del.addEventListener("click", async () => {
    const ok = await inlineConfirm({
      title: `刪除背景「${key}」?`,
      message: bg.type === "image" ? "上傳的圖片也會一起刪除。" : "預設背景刪除後可從重置範例還原。",
      okText: "刪除",
      danger: true,
    });
    if (!ok) return;
    delete state.backgrounds[key];
    state.bgOrder = state.bgOrder.filter(k => k !== key);
    saveToStorage();
    renderBgList();
    updateStorageMeter();
  });
  card.appendChild(del);

  return card;
}

function triggerBgImageUpload(key) {
  pendingUpload = { kind: "bg", key };
  const input = document.getElementById("bgImgInput");
  input.value = "";
  input.click();
}

document.getElementById("bgImgInput").addEventListener("change", async (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file || !pendingUpload) return;
  await applyBgImageUpload(file, pendingUpload.key);
  pendingUpload = null;
});

async function applyBgImageUpload(file, key) {
  if (file.size > MAX_FILE_BYTES) {
    showToast(`圖片過大(${fmtBytes(file.size)}),最多 5MB`, "warn", 3500);
    return false;
  }
  try {
    const raw = await readFileAsDataURL(file);
    const result = await downscaleImage(raw, 1600);
    state.backgrounds[key] = { type: "image", dataUrl: result.dataUrl };
    const ok = saveToStorage();
    if (ok) {
      const note = result.scaled ? `（${describeScale(result)}）` : "";
      showToast(`✨ 已上傳背景「${key}」${note}`, "success", result.scaled ? 3500 : 2500);
      renderBgList();
    }
    return ok;
  } catch (err) {
    console.error(err);
    showToast("讀取失敗", "warn");
    return false;
  }
}

// ----- Add buttons -----

document.getElementById("addCharBtn").addEventListener("click", async () => {
  const name = await inlinePrompt({
    title: "新增角色",
    message: "輸入角色名稱（可在劇本中作為說話者）",
    placeholder: "例如:學長、同學、神秘人",
    validate: (v) => {
      if (!v) return "請輸入角色名";
      if (state.characters.find(c => c.name === v)) return "已有同名角色";
      return null;
    },
  });
  if (!name) return;
  const colors = ["#c4a265", "#d4869a", "#8b9fd4", "#a8d486", "#b888d4", "#d4b886"];
  const used = state.characters.map(c => c.color);
  const color = colors.find(c => !used.includes(c)) || colors[Math.floor(Math.random() * colors.length)];
  state.characters.push({
    id: "ch_" + Date.now(),
    name,
    color,
    emotions: ["普通"],
    portraits: {}
  });
  saveToStorage();
  renderCharList();
});

document.getElementById("addBgBtn").addEventListener("click", async () => {
  const name = await inlinePrompt({
    title: "新增背景",
    message: "輸入背景名稱（劇本中用 [bg: 名稱] 切換），按確認後選圖片",
    placeholder: "例如:海邊、咖啡廳",
    validate: (v) => {
      if (!v) return "請輸入背景名";
      if (state.backgrounds[v]) return "已有同名背景";
      return null;
    },
  });
  if (!name) return;
  // placeholder preset to occupy slot — will be overwritten by upload
  state.backgrounds[name] = { type: "preset", className: "stage-bg-default" };
  state.bgOrder.push(name);
  saveToStorage();
  renderBgList();
  // auto-trigger upload
  triggerBgImageUpload(name);
});

// ----- CG list -----

function renderCgList() {
  const list = document.getElementById("cgList");
  list.innerHTML = "";
  if (!state.cgOrder) state.cgOrder = [];
  // ensure all keys in cgOrder
  for (const k of Object.keys(state.cgs)) {
    if (!state.cgOrder.includes(k)) state.cgOrder.push(k);
  }
  state.cgOrder = state.cgOrder.filter(k => state.cgs[k]);

  for (const key of state.cgOrder) {
    list.appendChild(renderCgCard(key));
  }
}

function renderCgCard(key) {
  const cg = state.cgs[key];
  const card = document.createElement("div");
  card.className = "cg-card";

  const thumb = document.createElement("div");
  thumb.className = "cg-thumb";
  if (cg && cg.dataUrl) {
    thumb.style.backgroundImage = `url(${cg.dataUrl})`;
  } else {
    thumb.textContent = "尚未上傳";
  }
  thumb.title = "點擊或拖放圖片更換";
  thumb.addEventListener("click", () => triggerCgImageUpload(key));
  attachDropTarget(thumb, (file) => applyCgImageUpload(file, key));
  card.appendChild(thumb);

  const nameIn = document.createElement("input");
  nameIn.className = "cg-name-input";
  nameIn.value = key;
  nameIn.placeholder = "CG 名稱";
  nameIn.addEventListener("change", (e) => {
    const newKey = e.target.value.trim();
    if (!newKey || newKey === key) { e.target.value = key; return; }
    if (state.cgs[newKey]) { showToast("已有同名 CG", "warn"); e.target.value = key; return; }
    state.cgs[newKey] = state.cgs[key];
    delete state.cgs[key];
    state.cgOrder = state.cgOrder.map(k => k === key ? newKey : k);
    saveToStorage();
    renderCgList();
  });
  card.appendChild(nameIn);

  const actions = document.createElement("div");
  actions.className = "cg-card-actions";
  const tag = document.createElement("div");
  tag.className = "bg-tag";
  tag.textContent = cg && cg.dataUrl ? "已上傳" : "未上傳";
  actions.appendChild(tag);

  const del = document.createElement("button");
  del.className = "icon-btn icon-btn-danger";
  del.innerHTML = "🗑";
  del.title = "刪除 CG";
  del.addEventListener("click", async () => {
    const ok = await inlineConfirm({
      title: `刪除 CG「${key}」?`,
      message: "上傳的圖卡也會一起刪除。",
      okText: "刪除",
      danger: true,
    });
    if (!ok) return;
    delete state.cgs[key];
    state.cgOrder = state.cgOrder.filter(k => k !== key);
    saveToStorage();
    renderCgList();
    updateStorageMeter();
  });
  actions.appendChild(del);

  card.appendChild(actions);
  return card;
}

function triggerCgImageUpload(key) {
  pendingUpload = { kind: "cg", key };
  const input = document.getElementById("cgImgInput");
  input.value = "";
  input.click();
}

document.getElementById("cgImgInput").addEventListener("change", async (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file || !pendingUpload) return;
  await applyCgImageUpload(file, pendingUpload.key);
  pendingUpload = null;
});

async function applyCgImageUpload(file, key) {
  if (file.size > MAX_FILE_BYTES) {
    showToast(`圖片過大(${fmtBytes(file.size)}),最多 5MB`, "warn", 3500);
    return false;
  }
  try {
    const raw = await readFileAsDataURL(file);
    const result = await downscaleImage(raw, 1600);
    state.cgs[key] = { dataUrl: result.dataUrl };
    const ok = saveToStorage();
    if (ok) {
      const note = result.scaled ? `（${describeScale(result)}）` : "";
      showToast(`✨ 已上傳 CG「${key}」${note}`, "success", result.scaled ? 3500 : 2500);
      renderCgList();
    }
    return ok;
  } catch (err) {
    console.error(err);
    showToast("讀取失敗", "warn");
    return false;
  }
}

document.getElementById("addCgBtn").addEventListener("click", async () => {
  const name = await inlinePrompt({
    title: "新增 CG 圖卡",
    message: "輸入 CG 名稱（劇本中用 [cg: 名稱] 顯示），按確認後選圖片",
    placeholder: "例如:告白、初吻、回憶",
    validate: (v) => {
      if (!v) return "請輸入 CG 名";
      if (state.cgs[v]) return "已有同名 CG";
      return null;
    },
  });
  if (!name) return;
  state.cgs[name] = { dataUrl: null };
  if (!state.cgOrder.includes(name)) state.cgOrder.push(name);
  saveToStorage();
  renderCgList();
  triggerCgImageUpload(name);
});

// ----- Modal open/close -----

document.getElementById("btnChars").addEventListener("click", () => openModal("chars"));
document.getElementById("modalClose").addEventListener("click", closeModal);
document.getElementById("modalDoneBtn").addEventListener("click", closeModal);
modalEl.addEventListener("click", (e) => {
  if (e.target === modalEl) closeModal();
});
document.querySelectorAll(".tab").forEach(t => {
  t.addEventListener("click", () => switchTab(t.dataset.tab));
});

// ============================================================
//  Canvas Renderer (used by screenshot AND recording)
// ============================================================
//  Replicates the visual stage onto a canvas, so we can:
//   - download as PNG (screenshot)
//   - captureStream() it to MediaRecorder (recording)
//
//  Output dimensions:
//    16:9 → 1280x720
//    9:16 →  720x1280

const RENDER_SIZES = {
  "16:9": { w: 1280, h: 720 },
  "9:16": { w: 720, h: 1280 },
};

// Preset background drawing functions (matching CSS gradients).
function drawPresetBg(ctx, w, h, className) {
  if (className === "stage-bg-sunset") {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#2a1640");
    g.addColorStop(0.4, "#d4869a");
    g.addColorStop(0.7, "#f4b878");
    g.addColorStop(1, "#4a1f3d");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // sun glow
    const sun = ctx.createRadialGradient(w * 0.5, h * 0.3, 0, w * 0.5, h * 0.3, w * 0.55);
    sun.addColorStop(0, "rgba(255,180,100,0.5)");
    sun.addColorStop(1, "rgba(255,180,100,0)");
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, w, h);
  } else if (className === "stage-bg-classroom") {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, "#4a3a2a");
    g.addColorStop(0.6, "#6b4f3a");
    g.addColorStop(1, "#3a2820");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // top warm light
    const top = ctx.createLinearGradient(0, 0, 0, h * 0.4);
    top.addColorStop(0, "rgba(255,200,150,0.2)");
    top.addColorStop(1, "rgba(255,200,150,0)");
    ctx.fillStyle = top;
    ctx.fillRect(0, 0, w, h * 0.4);
    // bottom shadow
    const bot = ctx.createLinearGradient(0, h * 0.5, 0, h);
    bot.addColorStop(0, "rgba(70,50,40,0)");
    bot.addColorStop(1, "rgba(70,50,40,0.6)");
    ctx.fillStyle = bot;
    ctx.fillRect(0, h * 0.5, w, h * 0.5);
  } else if (className === "stage-bg-night") {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#0a0518");
    g.addColorStop(0.5, "#1a0f30");
    g.addColorStop(1, "#2a1640");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // moon glow
    const moon = ctx.createRadialGradient(w * 0.7, h * 0.2, 0, w * 0.7, h * 0.2, w * 0.4);
    moon.addColorStop(0, "rgba(220,220,255,0.2)");
    moon.addColorStop(1, "rgba(220,220,255,0)");
    ctx.fillStyle = moon;
    ctx.fillRect(0, 0, w, h);
  } else {
    // default
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#2a1640");
    g.addColorStop(0.5, "#4a1f3d");
    g.addColorStop(1, "#1a0b2e");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    const a = ctx.createRadialGradient(w * 0.3, h * 0.4, 0, w * 0.3, h * 0.4, w * 0.5);
    a.addColorStop(0, "rgba(212,134,154,0.4)");
    a.addColorStop(1, "rgba(212,134,154,0)");
    ctx.fillStyle = a;
    ctx.fillRect(0, 0, w, h);
    const b = ctx.createRadialGradient(w * 0.7, h * 0.6, 0, w * 0.7, h * 0.6, w * 0.5);
    b.addColorStop(0, "rgba(139,95,184,0.4)");
    b.addColorStop(1, "rgba(139,95,184,0)");
    ctx.fillStyle = b;
    ctx.fillRect(0, 0, w, h);
  }
}

// Image cache so we don't recreate on every frame
const imageCache = new Map();
function getImage(src) {
  if (imageCache.has(src)) return imageCache.get(src);
  const img = new Image();
  img.src = src;
  // best-effort: store even before load
  imageCache.set(src, img);
  return img;
}
function preloadImage(src) {
  return new Promise((resolve) => {
    const img = getImage(src);
    if (img.complete && img.naturalWidth > 0) { resolve(img); return; }
    img.onload = () => resolve(img);
    img.onerror = () => resolve(img); // resolve anyway
  });
}

// Preload everything currently in state — call before screenshot/recording
async function preloadAllAssets() {
  const tasks = [];
  for (const bg of Object.values(state.backgrounds)) {
    if (bg.type === "image" && bg.dataUrl) tasks.push(preloadImage(bg.dataUrl));
  }
  for (const ch of state.characters) {
    for (const url of Object.values(ch.portraits || {})) {
      if (url) tasks.push(preloadImage(url));
    }
  }
  for (const cg of Object.values(state.cgs || {})) {
    if (cg && cg.dataUrl) tasks.push(preloadImage(cg.dataUrl));
  }
  await Promise.all(tasks);
}

// Draw a placeholder portrait silhouette (matches the SVG version visually).
function drawPlaceholderPortrait(ctx, x, y, w, h, color, name) {
  ctx.save();
  const cx = x + w / 2;
  const bottom = y + h;
  // body silhouette path (normalized to 200x400)
  const sx = w / 200;
  const sy = h / 400;
  const tx = x;
  const ty = y;

  // gradient
  const grad = ctx.createLinearGradient(0, ty, 0, ty + h);
  grad.addColorStop(0, color);
  grad.addColorStop(1, hexWithAlpha(color, 0.45));

  ctx.fillStyle = grad;
  ctx.strokeStyle = hexWithAlpha(color, 0.6);
  ctx.lineWidth = 1.5;

  // body
  ctx.beginPath();
  ctx.moveTo(tx + 100 * sx, ty + 80 * sy);
  ctx.bezierCurveTo(tx + 70 * sx, ty + 80 * sy, tx + 55 * sx, ty + 110 * sy, tx + 60 * sx, ty + 140 * sy);
  ctx.lineTo(tx + 50 * sx, ty + 200 * sy);
  ctx.bezierCurveTo(tx + 30 * sx, ty + 230 * sy, tx + 25 * sx, ty + 290 * sy, tx + 35 * sx, ty + 380 * sy);
  ctx.lineTo(tx + 165 * sx, ty + 380 * sy);
  ctx.bezierCurveTo(tx + 175 * sx, ty + 290 * sy, tx + 170 * sx, ty + 230 * sy, tx + 150 * sx, ty + 200 * sy);
  ctx.lineTo(tx + 140 * sx, ty + 140 * sy);
  ctx.bezierCurveTo(tx + 145 * sx, ty + 110 * sy, tx + 130 * sx, ty + 80 * sy, tx + 100 * sx, ty + 80 * sy);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // head
  ctx.beginPath();
  ctx.arc(tx + 100 * sx, ty + 55 * sy, 38 * Math.min(sx, sy), 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // initial letter
  const letter = (name || "?").slice(0, 1);
  const isLight = color === "#c4a265";
  ctx.fillStyle = isLight ? "rgba(42,31,16,0.85)" : "rgba(255,255,255,0.85)";
  const fontSize = 36 * Math.min(sx, sy);
  ctx.font = `italic 600 ${fontSize}px "Cormorant Garamond", serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(letter, tx + 100 * sx, ty + 56 * sy);
  ctx.restore();
}

function hexWithAlpha(hex, alpha) {
  const m = hex.match(/^#([0-9a-f]{6})$/i);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

// Wrap text into lines that fit within maxWidth.
function wrapText(ctx, text, maxWidth) {
  const lines = [];
  const paragraphs = text.split("\n");
  for (const para of paragraphs) {
    if (!para) { lines.push(""); continue; }
    let line = "";
    for (const ch of para) {
      const test = line + ch;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = ch;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

// Render the stage to a canvas given a "frame" object:
//   { bg, slots: {左,中,右}, dialog: {speaker, text, color, isNarration} | null, activeCharId }
// Returns the canvas (caller can toDataURL it or stream it).
async function renderFrameToCanvas(canvas, frame) {
  const ratio = state.ratio;
  const { w, h } = RENDER_SIZES[ratio];
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");

  // --- background ---
  const bgKey = frame.bg || "default";
  const bg = state.backgrounds[bgKey] || state.backgrounds.default;
  if (bg.type === "image" && bg.dataUrl) {
    const img = await preloadImage(bg.dataUrl);
    if (img.complete && img.naturalWidth > 0) {
      // cover fit
      const iw = img.naturalWidth, ih = img.naturalHeight;
      const scale = Math.max(w / iw, h / ih);
      const dw = iw * scale, dh = ih * scale;
      ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
    } else {
      drawPresetBg(ctx, w, h, "stage-bg-default");
    }
  } else if (bg.type === "preset") {
    drawPresetBg(ctx, w, h, bg.className);
  } else {
    drawPresetBg(ctx, w, h, "stage-bg-default");
  }

  // --- characters ---
  // Slot layout: 3 columns with tight padding so portraits dominate the frame.
  const padX = w * 0.015;
  const slotW = (w - padX * 2) / 3;
  // Full stage height — portraits use object-fit:contain bottom-aligned, so
  // tall artwork extends up to the top of the stage like a proper VN tachie.
  const charH = h;
  const charY = 0;
  const positions = ["左", "中", "右"];

  for (let i = 0; i < positions.length; i++) {
    const pos = positions[i];
    const slot = frame.slots && frame.slots[pos];
    if (!slot) continue;
    const ch = state.characters.find(c => c.id === slot.charId);
    if (!ch) continue;
    const isActive = frame.activeCharId === ch.id;

    const slotCx = padX + slotW * (i + 0.5);
    const charW = slotW * 0.98;
    const charX = slotCx - charW / 2;

    // Active gets a soft glow behind
    if (isActive) {
      ctx.save();
      const glow = ctx.createRadialGradient(slotCx, charY + charH * 0.5, 0, slotCx, charY + charH * 0.5, charW * 0.9);
      glow.addColorStop(0, "rgba(196,162,101,0.25)");
      glow.addColorStop(1, "rgba(196,162,101,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(charX - charW * 0.3, charY - charH * 0.05, charW * 1.6, charH * 1.1);
      ctx.restore();
    }

    // Brightness filter for inactive
    const portraitSrc = ch.portraits[slot.emotion] || ch.portraits["__default__"];
    if (portraitSrc) {
      const img = await preloadImage(portraitSrc);
      if (img.complete && img.naturalWidth > 0) {
        // fit contain, bottom-aligned
        const iw = img.naturalWidth, ih = img.naturalHeight;
        const scale = Math.min(charW / iw, charH / ih);
        const dw = iw * scale, dh = ih * scale;
        const dx = slotCx - dw / 2;
        const dy = charY + charH - dh;
        if (!isActive) {
          ctx.save();
          ctx.filter = "brightness(0.55)";
          ctx.drawImage(img, dx, dy, dw, dh);
          ctx.restore();
        } else {
          // drop-shadow glow on portrait
          ctx.save();
          ctx.shadowColor = "rgba(196,162,101,0.4)";
          ctx.shadowBlur = 30;
          ctx.drawImage(img, dx, dy, dw, dh);
          ctx.restore();
        }
      }
    } else {
      // placeholder
      ctx.save();
      if (!isActive) ctx.filter = "brightness(0.55)";
      drawPlaceholderPortrait(ctx, charX, charY, charW, charH, ch.color, ch.name);
      ctx.restore();
    }

    // No floating badge — speaker name lives in the dialog box, matching VN convention.
  }

  // --- CG (full-screen art layer, drawn over characters) ---
  if (frame.cg) {
    const cgData = state.cgs[frame.cg.name];
    if (cgData && cgData.dataUrl) {
      const img = await preloadImage(cgData.dataUrl);
      if (img.complete && img.naturalWidth > 0) {
        // black bg first, then cover
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, w, h);
        const iw = img.naturalWidth, ih = img.naturalHeight;
        const scale = Math.max(w / iw, h / ih);
        const dw = iw * scale, dh = ih * scale;
        ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
      }
    } else {
      // placeholder
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, "#2a1640");
      g.addColorStop(1, "#4a1f3d");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "rgba(243, 233, 216, 0.4)";
      ctx.font = `italic 500 ${Math.round(h * 0.05)}px "Cormorant Garamond", serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`CG: ${frame.cg.name}`, w / 2, h / 2);
    }
  }

  // --- dialog box ---
  // Hidden when CG in "full" mode
  const dialogHidden = frame.cg && frame.cg.hideDialog;
  if (frame.dialog && !dialogHidden) {
    const boxPad = w * 0.04;
    const boxX = boxPad;
    const boxW = w - boxPad * 2;
    const boxH = h * 0.24;
    const boxY = h - boxH - h * 0.04;

    // backdrop — uses user-customizable dialog color
    ctx.save();
    const ds = state.dialogStyle || DEFAULT_DIALOG_STYLE;
    const dsRgb = hexToRgb(ds.color);
    const dsR2 = Math.min(255, dsRgb.r + 10);
    const dsG2 = Math.min(255, dsRgb.g + 6);
    const dsB2 = Math.min(255, dsRgb.b + 14);
    const aTop = Math.max(0, ds.opacity - 0.03);
    const aBot = Math.min(1, ds.opacity + 0.04);
    const grad = ctx.createLinearGradient(0, boxY, 0, boxY + boxH);
    grad.addColorStop(0, `rgba(${dsRgb.r}, ${dsRgb.g}, ${dsRgb.b}, ${aTop})`);
    grad.addColorStop(1, `rgba(${dsR2}, ${dsG2}, ${dsB2}, ${aBot})`);
    ctx.fillStyle = grad;
    roundRect(ctx, boxX, boxY, boxW, boxH, 4);
    ctx.fill();
    ctx.strokeStyle = "rgba(196, 162, 101, 0.45)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // inner highlight
    ctx.strokeStyle = "rgba(196, 162, 101, 0.15)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(boxX + 2, boxY + 1.5);
    ctx.lineTo(boxX + boxW - 2, boxY + 1.5);
    ctx.stroke();
    ctx.restore();

    // gold corner brackets
    drawCornerBrackets(ctx, boxX, boxY, boxW, boxH, h * 0.025);

    const contentPad = w * 0.028;
    const contentX = boxX + contentPad;
    const contentW = boxW - contentPad * 2;

    if (frame.dialog.isNarration) {
      ctx.save();
      ctx.fillStyle = "#9a8aa8";
      const fontSize = Math.round(h * 0.035);
      ctx.font = `italic 400 ${fontSize}px "Noto Serif TC", "PingFang TC", serif`;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      const lines = wrapText(ctx, frame.dialog.text, contentW);
      const lineH = fontSize * 1.7;
      const totalH = lines.length * lineH;
      const startY = boxY + (boxH - totalH) / 2;
      for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], contentX, startY + i * lineH);
      }
      ctx.restore();
    } else {
      // speaker
      ctx.save();
      ctx.fillStyle = frame.dialog.color || "#f3e9d8";
      const nameSize = Math.round(h * 0.042);
      ctx.font = `italic 500 ${nameSize}px "Cormorant Garamond", "Noto Serif TC", serif`;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      const nameY = boxY + contentPad * 0.8;
      ctx.fillText(frame.dialog.speaker, contentX, nameY);
      // decorative line after name
      const nameWidth = ctx.measureText(frame.dialog.speaker).width;
      const lineStart = contentX + nameWidth + 10;
      const lineY = nameY + nameSize / 2 + 2;
      const lineGrad = ctx.createLinearGradient(lineStart, lineY, contentX + contentW * 0.4, lineY);
      lineGrad.addColorStop(0, hexWithAlpha(frame.dialog.color || "#f3e9d8", 0.4));
      lineGrad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.strokeStyle = lineGrad;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(lineStart, lineY);
      ctx.lineTo(contentX + contentW * 0.4, lineY);
      ctx.stroke();
      ctx.restore();

      // text
      ctx.save();
      ctx.fillStyle = "#f3e9d8";
      const textSize = Math.round(h * 0.036);
      ctx.font = `400 ${textSize}px "PingFang TC", "Noto Sans TC", sans-serif`;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      const lines = wrapText(ctx, frame.dialog.text, contentW);
      const lineH = textSize * 1.7;
      const startY = boxY + contentPad * 0.8 + nameSize + h * 0.012;
      for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], contentX, startY + i * lineH);
      }
      ctx.restore();
    }
  }

  // --- choices overlay ---
  if (frame.choices) {
    drawChoicesOverlay(ctx, w, h, frame.choices);
  }

  return canvas;
}

// Draws the choices overlay onto the canvas. Items are objects of:
//   { text, isFinal, shown: bool|undefined }
// If shown===false, the item is skipped (not yet revealed in animation).
function drawChoicesOverlay(ctx, w, h, choices) {
  // dimmed backdrop
  ctx.save();
  ctx.fillStyle = "rgba(13, 7, 22, 0.55)";
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  const items = choices.items.filter(it => it.shown !== false);
  if (items.length === 0) return;

  const boxW = w * 0.6;
  const boxH = h * 0.1;
  const gap = h * 0.024;
  const totalH = items.length * boxH + (items.length - 1) * gap;
  let y = (h - totalH) / 2;
  const x = (w - boxW) / 2;

  const fontSize = Math.round(h * 0.035);
  ctx.font = `400 ${fontSize}px "PingFang TC", "Noto Sans TC", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for (const item of items) {
    ctx.save();
    const cx = x + boxW / 2;
    const cy = y + boxH / 2;
    if (item.isFinal) {
      // highlighted box
      const gradF = ctx.createLinearGradient(0, y, 0, y + boxH);
      gradF.addColorStop(0, "rgba(196, 162, 101, 0.22)");
      gradF.addColorStop(1, "rgba(212, 134, 154, 0.22)");
      ctx.fillStyle = gradF;
      roundRect(ctx, x, y, boxW, boxH, 3);
      ctx.fill();
      ctx.strokeStyle = "#e6c989";
      ctx.lineWidth = 2;
      ctx.stroke();
      // shadow glow
      ctx.shadowColor = "rgba(196, 162, 101, 0.5)";
      ctx.shadowBlur = 20;
      ctx.strokeStyle = "rgba(230, 201, 137, 0.4)";
      ctx.lineWidth = 1;
      roundRect(ctx, x, y, boxW, boxH, 3);
      ctx.stroke();
      ctx.shadowBlur = 0;
      // text
      ctx.fillStyle = "#e6c989";
      ctx.font = `600 ${fontSize}px "PingFang TC", sans-serif`;
      // corner brackets
      drawCornerBrackets(ctx, x, y, boxW, boxH, h * 0.015);
    } else {
      // regular dimmed box
      const grad = ctx.createLinearGradient(0, y, 0, y + boxH);
      grad.addColorStop(0, "rgba(13, 7, 22, 0.85)");
      grad.addColorStop(1, "rgba(23, 13, 36, 0.92)");
      ctx.fillStyle = grad;
      roundRect(ctx, x, y, boxW, boxH, 3);
      ctx.fill();
      ctx.strokeStyle = "rgba(196, 162, 101, 0.4)";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = "rgba(243, 233, 216, 0.7)";
      ctx.font = `400 ${fontSize}px "PingFang TC", sans-serif`;
      drawCornerBrackets(ctx, x, y, boxW, boxH, h * 0.012);
    }
    ctx.fillText(item.text, cx, cy + 2);
    ctx.restore();
    y += boxH + gap;
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCornerBrackets(ctx, x, y, w, h, size) {
  ctx.save();
  ctx.strokeStyle = "#c4a265";
  ctx.lineWidth = 1.5;
  // top-left
  ctx.beginPath();
  ctx.moveTo(x, y + size);
  ctx.lineTo(x, y);
  ctx.lineTo(x + size, y);
  ctx.stroke();
  // bottom-right
  ctx.beginPath();
  ctx.moveTo(x + w, y + h - size);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x + w - size, y + h);
  ctx.stroke();
  ctx.restore();
}

// Build a "frame" from current state at given line index
function buildFrameAt(idx) {
  const activeCharId = computeStageStateAt(state.parsed, idx);
  const cur = state.parsed[idx];
  let dialog = null;
  let choices = null;
  if (cur) {
    if (cur.type === "dialog") {
      const ch = findCharacter(cur.speaker);
      let displayName = cur.speaker;
      let displayColor = ch ? ch.color : "#f3e9d8";
      if (cur.nameHidden) {
        displayName = cur.nameOverride || "???";
        displayColor = "#9a8aa8";
      }
      dialog = {
        speaker: displayName,
        text: cur.text,
        color: displayColor,
        isNarration: false,
      };
    } else if (cur.type === "narration") {
      dialog = { speaker: "", text: cur.text, color: "#9a8aa8", isNarration: true };
    } else if (cur.type === "choices") {
      // for static preview/screenshot, show full choices state
      choices = {
        items: cur.items.map(it => ({ text: it.text, isFinal: it.isFinal, shown: true })),
      };
    }
  }
  return {
    bg: state.stage.bg,
    slots: { ...state.stage.slots },
    cg: state.stage.cg,
    activeCharId,
    dialog,
    choices,
  };
}

// ============================================================
//  Screenshot
// ============================================================

document.getElementById("btnScreenshot").addEventListener("click", async () => {
  if (!state.parsed.length) {
    showToast("劇本是空的", "warn");
    return;
  }
  showToast("📸 正在繪製...", "", 1500);
  try {
    await preloadAllAssets();
    const canvas = document.createElement("canvas");
    const frame = buildFrameAt(state.currentIndex);
    await renderFrameToCanvas(canvas, frame);
    canvas.toBlob((blob) => {
      if (!blob) { showToast("截圖失敗", "warn"); return; }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `otome-${timestamp()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast("✨ 截圖已下載", "success");
    }, "image/png");
  } catch (e) {
    console.error(e);
    showToast("截圖失敗:" + e.message, "warn", 4000);
  }
});

function timestamp() {
  const d = new Date();
  const pad = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

// ============================================================
//  Share: Export project as JSON
// ============================================================

document.getElementById("btnShare").addEventListener("click", () => {
  try {
    const project = {
      version: 3,
      app: "otome-studio",
      exportedAt: new Date().toISOString(),
      script: state.script,
      characters: state.characters,
      backgrounds: Object.fromEntries(
        Object.entries(state.backgrounds).filter(([k]) => k !== "default")
      ),
      bgOrder: state.bgOrder,
      cgs: state.cgs,
      cgOrder: state.cgOrder,
      ratio: state.ratio,
    };
    const json = JSON.stringify(project, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `otome-project-${timestamp()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    const sizeMB = (blob.size / (1024 * 1024)).toFixed(2);
    showToast(`📤 已匯出專案(${sizeMB} MB)`, "success", 3000);
  } catch (e) {
    console.error(e);
    showToast("匯出失敗:" + e.message, "warn", 4000);
  }
});

// ============================================================
//  Import: Load project / 劇本速寫 JSON
// ============================================================

document.getElementById("btnImport").addEventListener("click", () => {
  const input = document.getElementById("projectInput");
  input.value = "";
  input.click();
});

document.getElementById("projectInput").addEventListener("change", async (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);

    // Determine format:
    // - otome-studio export: has app === "otome-studio"
    // - 劇本速寫: { version: 1, script, characters: [...] } without "app"
    const isOtome = data.app === "otome-studio";
    const isSpeedDraft = !isOtome && data.script !== undefined && Array.isArray(data.characters);

    if (!isOtome && !isSpeedDraft) {
      throw new Error("無法識別的 JSON 格式");
    }

    const ok = await inlineConfirm({
      title: isOtome ? "匯入 Otome Studio 專案?" : "匯入「劇本速寫」檔案?",
      message: isOtome
        ? "會覆蓋目前所有資料：劇本、角色及立繪、背景。\n\n建議先按 📤 備份目前的專案。"
        : "會覆蓋目前的劇本和角色設定。\n背景和立繪圖片不受影響。\n\n建議先按 📤 備份目前的專案。",
      okText: "覆蓋匯入",
      danger: true,
    });
    if (!ok) return;

    if (isOtome) {
      // full import
      state.script = data.script || "";
      state.characters = Array.isArray(data.characters) ? data.characters : [];
      // ensure each character has portraits object
      state.characters.forEach(c => { if (!c.portraits) c.portraits = {}; if (!c.emotions) c.emotions = []; });
      // merge presets + imported
      state.backgrounds = { ...SAMPLE_BACKGROUNDS };
      if (data.backgrounds) {
        for (const [k, v] of Object.entries(data.backgrounds)) {
          state.backgrounds[k] = v;
        }
      }
      state.bgOrder = Array.isArray(data.bgOrder) ? data.bgOrder : ["黃昏", "教室", "夜晚"];
      state.cgs = (data.cgs && typeof data.cgs === "object") ? data.cgs : {};
      state.cgOrder = Array.isArray(data.cgOrder) ? data.cgOrder : Object.keys(state.cgs);
      if (data.ratio) state.ratio = data.ratio;
    } else {
      // speed-draft: just script + characters (preserve existing portraits if name matches)
      const existingByName = new Map(state.characters.map(c => [c.name, c]));
      state.script = data.script || "";
      state.characters = data.characters.map((c, idx) => {
        const existing = existingByName.get(c.name);
        return {
          id: existing ? existing.id : ("ch_imp_" + Date.now() + "_" + idx),
          name: c.name,
          color: c.color || "#c4a265",
          emotions: Array.isArray(c.emotions) ? c.emotions : ["普通"],
          portraits: existing ? existing.portraits : {},
        };
      });
    }

    // re-render everything
    els.scriptArea.value = state.script;
    setRatio(state.ratio);
    state.currentIndex = 0;
    reparseAndRender(true);
    saveToStorage();
    showToast(isOtome ? "✨ 專案已匯入" : "✨ 劇本速寫已匯入", "success", 3000);
  } catch (err) {
    console.error(err);
    showToast("匯入失敗:" + err.message, "warn", 4000);
  }
});

// ============================================================
//  Recording: MediaRecorder + Canvas Animation
// ============================================================

const recState = {
  typeSpeed: 45,      // ms per char
  holdTime: 1.5,      // seconds to hold after typing done
  bgHold: 0.6,        // seconds to hold on bg/exit transitions
  preferredMime: null,
  mediaRecorder: null,
  chunks: [],
  startTime: 0,
  stopRequested: false,
};

// detect best supported mime type for output
function detectMimeType() {
  const candidates = [
    "video/mp4;codecs=avc1.42E01E",
    "video/mp4;codecs=avc1",
    "video/mp4",
    "video/webm;codecs=h264",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  if (!window.MediaRecorder) return null;
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) return c;
  }
  return null;
}

function updateRecordFormatInfo() {
  const el = document.getElementById("recordFormatInfo");
  if (!recState.preferredMime) {
    el.innerHTML = "<span style='color:var(--danger)'>⚠ 瀏覽器不支援錄影</span>";
    return;
  }
  const isMp4 = recState.preferredMime.startsWith("video/mp4");
  if (isMp4) {
    el.innerHTML = "輸出格式:<strong>MP4</strong>(可直接上傳社群)";
  } else {
    el.innerHTML = "輸出:<strong>WebM</strong> · 可選轉成 MP4(載入 ~25MB)";
  }
}

// Estimate total duration of the script when animated.
function estimateRecordingDuration() {
  let total = 0;
  let visibleCount = 0;
  for (const ln of state.parsed) {
    let dt = 0;
    if (ln.type === "dialog" || ln.type === "narration") {
      const charCount = (ln.text || "").length;
      dt = charCount * recState.typeSpeed / 1000 + recState.holdTime;
    } else if (ln.type === "bg" || ln.type === "exit" || ln.type === "cg_off") {
      dt = recState.bgHold;
    } else if (ln.type === "cg") {
      dt = recState.bgHold * 1.5;
    } else if (ln.type === "choices") {
      dt = (ln.items.length * 0.6) + 0.3 + 1.2;
    }
    total += dt;
    if (ln.type === "dialog" || ln.type === "narration" || ln.type === "choices") {
      visibleCount++;
    }
  }
  return { total, totalVisible: visibleCount };
}

function fmtDuration(secs) {
  const m = Math.floor(secs / 60);
  const s = secs - m * 60;
  if (m === 0) return `${s.toFixed(1)} 秒`;
  return `${m} 分 ${s.toFixed(0)} 秒`;
}

function updateEstimate() {
  const info = estimateRecordingDuration();
  const dur = info.total;
  const el = document.getElementById("recordEstimate");
  // ~0.5 MB/sec at 4 Mbps + container overhead
  const sizeMB = (dur * 0.5).toFixed(1);
  const heavy = dur > 180;
  el.classList.toggle("over-limit", heavy);
  if (heavy) {
    el.innerHTML = `預計片長:<strong>${fmtDuration(dur)}</strong> · 約 ${sizeMB} MB<br>` +
      `⚠ 較長的片子建議分段錄影,避免瀏覽器記憶體吃緊`;
  } else {
    el.innerHTML = `預計片長:<strong>${fmtDuration(dur)}</strong> · 約 ${sizeMB} MB（共 ${info.totalVisible} 句）`;
  }
}

// ----- Open record settings modal -----

document.getElementById("btnRecord").addEventListener("click", () => {
  if (!state.parsed.length) {
    showToast("劇本是空的", "warn");
    return;
  }
  recState.preferredMime = detectMimeType();
  if (!recState.preferredMime) {
    showToast("此瀏覽器不支援錄影,請用 Chrome/Edge/Safari 桌面版", "warn", 4000);
    return;
  }
  updateRecordFormatInfo();
  updateEstimate();
  document.getElementById("recordModal").classList.add("show");
});

document.getElementById("recordModalClose").addEventListener("click", () => {
  document.getElementById("recordModal").classList.remove("show");
});
document.getElementById("recordModal").addEventListener("click", (e) => {
  if (e.target.id === "recordModal") {
    document.getElementById("recordModal").classList.remove("show");
  }
});

// sliders
function speedLabel(ms) {
  if (ms <= 30) return `快速 · ${ms}ms`;
  if (ms <= 60) return `中速 · ${ms}ms`;
  return `慢速 · ${ms}ms`;
}
document.getElementById("typeSpeed").addEventListener("input", (e) => {
  recState.typeSpeed = parseInt(e.target.value, 10);
  document.getElementById("typeSpeedLabel").textContent = speedLabel(recState.typeSpeed);
  updateEstimate();
});
document.getElementById("holdTime").addEventListener("input", (e) => {
  recState.holdTime = parseFloat(e.target.value);
  document.getElementById("holdTimeLabel").textContent = `${recState.holdTime.toFixed(1)} 秒`;
  updateEstimate();
});
document.getElementById("bgHold").addEventListener("input", (e) => {
  recState.bgHold = parseFloat(e.target.value);
  document.getElementById("bgHoldLabel").textContent = `${recState.bgHold.toFixed(1)} 秒`;
  updateEstimate();
});

// ----- Start recording -----

document.getElementById("recordStartBtn").addEventListener("click", async () => {
  document.getElementById("recordModal").classList.remove("show");
  await beginRecording();
});

document.getElementById("recStopBtn").addEventListener("click", () => {
  recState.stopRequested = true;
});

async function beginRecording() {
  // preload assets
  await preloadAllAssets();

  const canvas = document.getElementById("recordingCanvas");
  const ratio = state.ratio;
  const { w, h } = RENDER_SIZES[ratio];
  canvas.width = w;
  canvas.height = h;
  canvas.dataset.ratio = ratio;

  // show overlay
  document.getElementById("recordingOverlay").classList.add("show");
  document.getElementById("recTimer").innerHTML = "<strong>00:00</strong>";

  // set up MediaRecorder on canvas stream
  const stream = canvas.captureStream(30); // 30fps
  let mime = recState.preferredMime;
  let recorder;
  try {
    recorder = new MediaRecorder(stream, {
      mimeType: mime,
      videoBitsPerSecond: 4_000_000, // 4 Mbps — good quality for the resolution
    });
  } catch (e) {
    // fallback to default
    try {
      recorder = new MediaRecorder(stream);
      mime = recorder.mimeType;
    } catch (e2) {
      showToast("無法啟動錄影:" + e2.message, "warn", 4000);
      document.getElementById("recordingOverlay").classList.remove("show");
      return;
    }
  }

  recState.mediaRecorder = recorder;
  recState.chunks = [];
  recState.stopRequested = false;
  recState.startTime = performance.now();

  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) recState.chunks.push(e.data);
  };

  const recordingPromise = new Promise((resolve) => {
    recorder.onstop = () => {
      const blob = new Blob(recState.chunks, { type: mime });
      resolve(blob);
    };
  });

  recorder.start(100); // gather chunks every 100ms

  // visibility-change watcher — warn if user switches tab mid-recording
  let _wasHidden = false;
  const visHandler = () => {
    if (document.hidden) {
      _wasHidden = true;
      // give a soft toast (some browsers will still throttle, but capture should continue)
      showToast("⚠ 偵測到切換分頁,動畫可能變慢或卡頓", "warn", 3500);
    }
  };
  document.addEventListener("visibilitychange", visHandler);

  // run animation
  try {
    await runRecordingAnimation(canvas);
  } catch (e) {
    console.error("Animation error:", e);
  }
  document.removeEventListener("visibilitychange", visHandler);
  if (_wasHidden) {
    showToast("⚠ 錄影過程中曾切換分頁,影片可能不順", "warn", 4000);
  }

  // stop recorder
  if (recorder.state !== "inactive") recorder.stop();
  const blob = await recordingPromise;

  // close overlay
  document.getElementById("recordingOverlay").classList.remove("show");

  // restore preview state to where it was before recording
  reparseAndRender(false);

  // show result
  showRecordingResult(blob, mime);
}

// ----- Animation driver -----
// Walks through state.parsed, drawing each frame to the canvas.
// For each dialog line: typewriter effect, then hold, then advance.
// For bg/exit: brief hold, then continue.

async function runRecordingAnimation(canvas) {
  const ctx = canvas.getContext("2d");

  // reset stage at start (include cg field)
  state.stage = { bg: "default", slots: { 左: null, 中: null, 右: null }, cg: null };

  // No hard time limit — recording continues until script ends or user clicks Stop.
  // We keep the totalDurationMs param threaded through helpers (now Infinity) so the
  // existing signatures stay intact.
  const totalDurationMs = Infinity;
  const startMs = performance.now();

  // walk through parsed
  for (let i = 0; i < state.parsed.length; i++) {
    if (recState.stopRequested) break;
    const elapsed = performance.now() - startMs;
    if (elapsed >= totalDurationMs) break;

    const ln = state.parsed[i];

    if (ln.type === "bg") {
      state.stage.bg = ln.bgName;
      await drawCurrentFrameDuringRec(canvas, null, null);
      await sleepWithTimer(recState.bgHold * 1000, startMs, totalDurationMs);
    } else if (ln.type === "exit") {
      state.stage.slots = { 左: null, 中: null, 右: null };
      await drawCurrentFrameDuringRec(canvas, null, null);
      await sleepWithTimer(recState.bgHold * 1000, startMs, totalDurationMs);
    } else if (ln.type === "cg") {
      state.stage.cg = { name: ln.cgName, hideDialog: ln.hideDialog };
      await drawCurrentFrameDuringRec(canvas, null, null);
      await sleepWithTimer(recState.bgHold * 1000 * 1.5, startMs, totalDurationMs);
    } else if (ln.type === "cg_off") {
      state.stage.cg = null;
      await drawCurrentFrameDuringRec(canvas, null, null);
      await sleepWithTimer(recState.bgHold * 1000, startMs, totalDurationMs);
    } else if (ln.type === "choices") {
      await animateChoices(canvas, ln, startMs, totalDurationMs);
    } else if (ln.type === "dialog") {
      const ch = findCharacter(ln.speaker);
      let activeCharId = null;
      if (ch) {
        placeCharacter(ch.id, ln.emotion, ln.position);
        activeCharId = ch.id;
      }
      // determine display name with [?] / [?:某人] handling
      let displayName = ln.speaker;
      let dialogColor = ch ? ch.color : "#f3e9d8";
      if (ln.nameHidden) {
        displayName = ln.nameOverride || "???";
        dialogColor = "#9a8aa8";
      }
      const text = ln.text || "";
      let charsShown = 0;
      const typeStart = performance.now();
      while (charsShown < text.length) {
        if (recState.stopRequested) break;
        const elapsedType = performance.now() - typeStart;
        const targetChars = Math.min(text.length, Math.floor(elapsedType / recState.typeSpeed));
        if (targetChars > charsShown) {
          charsShown = targetChars;
          await drawCurrentFrameDuringRec(canvas, {
            speaker: displayName,
            text: text.slice(0, charsShown),
            color: dialogColor,
            isNarration: false,
          }, activeCharId);
        }
        if (performance.now() - startMs >= totalDurationMs) break;
        await new Promise(r => requestAnimationFrame(r));
        updateRecTimer(startMs);
      }
      await drawCurrentFrameDuringRec(canvas, {
        speaker: displayName,
        text,
        color: dialogColor,
        isNarration: false,
      }, activeCharId);
      await sleepWithTimer(recState.holdTime * 1000, startMs, totalDurationMs);
    } else if (ln.type === "narration") {
      const text = ln.text || "";
      const activeCharId = null;
      let charsShown = 0;
      const typeStart = performance.now();
      while (charsShown < text.length) {
        if (recState.stopRequested) break;
        const elapsedType = performance.now() - typeStart;
        const targetChars = Math.min(text.length, Math.floor(elapsedType / recState.typeSpeed));
        if (targetChars > charsShown) {
          charsShown = targetChars;
          await drawCurrentFrameDuringRec(canvas, {
            speaker: "",
            text: text.slice(0, charsShown),
            color: "#9a8aa8",
            isNarration: true,
          }, activeCharId);
        }
        if (performance.now() - startMs >= totalDurationMs) break;
        await new Promise(r => requestAnimationFrame(r));
        updateRecTimer(startMs);
      }
      await drawCurrentFrameDuringRec(canvas, {
        speaker: "",
        text,
        color: "#9a8aa8",
        isNarration: true,
      }, activeCharId);
      await sleepWithTimer(recState.holdTime * 1000, startMs, totalDurationMs);
    }
  }
}

// Animate the choices sequence:
//  - each item appears with 0.6s gap
//  - after all shown, hold ~0.6s, then highlight final and hold 1.2s
async function animateChoices(canvas, choicesLine, startMs, totalDurationMs) {
  const items = choicesLine.items.map(it => ({ ...it, shown: false }));
  const PER_ITEM_MS = 600;
  const FINAL_HOLD_MS = 1200;
  const PRE_HIGHLIGHT_MS = 300;

  // reveal each item one-by-one
  for (let k = 0; k < items.length; k++) {
    if (recState.stopRequested) return;
    if (performance.now() - startMs >= totalDurationMs) return;
    items[k].shown = true;
    await drawChoicesFrame(canvas, items, false);
    await sleepWithTimer(PER_ITEM_MS, startMs, totalDurationMs);
  }
  // brief pause before highlighting final
  await sleepWithTimer(PRE_HIGHLIGHT_MS, startMs, totalDurationMs);
  // highlight phase — render with isFinal already on the marked item (it already was)
  // final hold
  await drawChoicesFrame(canvas, items, true);
  await sleepWithTimer(FINAL_HOLD_MS, startMs, totalDurationMs);
}

async function drawChoicesFrame(canvas, items, finalPhase) {
  // During the reveal phase, suppress the gold highlight even if isFinal=true,
  // so all visible items look equal. When finalPhase=true, the * one lights up.
  const renderItems = items.map(it => ({
    text: it.text,
    isFinal: finalPhase ? it.isFinal : false,
    shown: it.shown,
  }));
  const frame = {
    bg: state.stage.bg,
    slots: { ...state.stage.slots },
    cg: state.stage.cg,
    activeCharId: null,
    dialog: null,
    choices: { items: renderItems },
  };
  await renderFrameToCanvas(canvas, frame);
}

async function drawCurrentFrameDuringRec(canvas, dialog, activeCharId) {
  const frame = {
    bg: state.stage.bg,
    slots: { ...state.stage.slots },
    cg: state.stage.cg,
    activeCharId,
    dialog,
  };
  await renderFrameToCanvas(canvas, frame);
}

async function sleepWithTimer(ms, startMs, totalDurationMs) {
  const target = performance.now() + ms;
  while (performance.now() < target) {
    if (recState.stopRequested) return;
    if (performance.now() - startMs >= totalDurationMs) return;
    updateRecTimer(startMs);
    await new Promise(r => requestAnimationFrame(r));
  }
}

function updateRecTimer(startMs) {
  const elapsed = (performance.now() - startMs) / 1000;
  const m = Math.floor(elapsed / 60);
  const s = Math.floor(elapsed % 60);
  document.getElementById("recTimer").innerHTML =
    `<strong>${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}</strong>`;
}

// ----- Result modal -----

function showRecordingResult(blob, mime) {
  const modal = document.getElementById("resultModal");
  const video = document.getElementById("resultVideo");
  const meta = document.getElementById("resultMeta");
  const actions = document.getElementById("resultActions");

  const url = URL.createObjectURL(blob);
  video.src = url;
  video.load();

  const isMp4 = mime.startsWith("video/mp4");
  const sizeMB = (blob.size / (1024 * 1024)).toFixed(2);
  const ext = isMp4 ? "mp4" : "webm";

  meta.textContent = `${ext.toUpperCase()} · ${sizeMB} MB · ${RENDER_SIZES[state.ratio].w}×${RENDER_SIZES[state.ratio].h}`;

  actions.innerHTML = "";

  // primary download button
  const dlBtn = document.createElement("button");
  dlBtn.className = "btn btn-primary";
  dlBtn.textContent = `⬇ 下載 ${ext.toUpperCase()}`;
  dlBtn.addEventListener("click", () => {
    const a = document.createElement("a");
    a.href = url;
    a.download = `otome-${timestamp()}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  });
  actions.appendChild(dlBtn);

  // if webm, offer guidance + a one-click cloudconvert link
  // (ffmpeg.wasm requires SharedArrayBuffer + cross-origin isolation which
  //  doesn't work reliably in a standalone html file opened from disk or
  //  served without specific COOP/COEP headers)
  if (!isMp4) {
    const convBtn = document.createElement("button");
    convBtn.className = "btn btn-ghost";
    convBtn.textContent = "🌐 線上轉 MP4";
    convBtn.title = "在新分頁打開 cloudconvert.com,把剛下載的 WebM 拖進去即可";
    convBtn.addEventListener("click", () => {
      window.open("https://cloudconvert.com/webm-to-mp4", "_blank", "noopener");
    });
    actions.appendChild(convBtn);

    const note = document.createElement("div");
    note.style.cssText = "font-size:11px;color:var(--text-muted);text-align:center;line-height:1.7;max-width:380px;margin:0 auto;";
    note.innerHTML = `💡 你的瀏覽器只支援 WebM。<br>` +
      `先按 <strong style="color:var(--gold-bright)">⬇ 下載 WEBM</strong>,然後 <strong>🌐 線上轉 MP4</strong> 把檔案拖進去。<br>` +
      `或改用 Chrome / Edge / Safari 桌面版重錄,可直接輸出 MP4。`;
    actions.appendChild(note);
  }

  // close
  const closeBtn = document.createElement("button");
  closeBtn.className = "btn btn-ghost";
  closeBtn.textContent = "關閉";
  closeBtn.addEventListener("click", () => {
    modal.classList.remove("show");
    URL.revokeObjectURL(url);
    video.src = "";
  });
  actions.appendChild(closeBtn);

  modal.classList.add("show");
}

document.getElementById("resultModalClose").addEventListener("click", () => {
  const modal = document.getElementById("resultModal");
  const video = document.getElementById("resultVideo");
  modal.classList.remove("show");
  if (video.src) {
    URL.revokeObjectURL(video.src);
    video.src = "";
  }
});

// also save script on input (debounced)
let scriptSaveTimer = null;
els.scriptArea.addEventListener("input", () => {
  setSaveIndicator("saving");
  if (scriptSaveTimer) clearTimeout(scriptSaveTimer);
  scriptSaveTimer = setTimeout(saveToStorage, 500);
});

// ============================================================
//  Init
// ============================================================

// state field defaults
state.bgOrder = ["黃昏", "教室", "夜晚"]; // preset order
state.cgOrder = [];

// try restore from storage
const restored = loadFromStorage();
if (!restored) {
  state.script = SAMPLE_SCRIPT;
}

// apply ratio if restored
setRatio(state.ratio);
els.scriptArea.value = state.script;
applyDialogStyle();
reparseAndRender(true);
updateStorageMeter();

// ============================================================
//  Inline Modal helpers (replaces native confirm/prompt)
// ============================================================
// Drop-in async replacements that match the otome theme.
// Resolves to:
//   inlineConfirm() → boolean
//   inlinePrompt()  → trimmed string OR null on cancel
//   inlineChoose()  → key of chosen option OR null

function _imodalEsc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function _openInlineModal(buildBody, onKeydown) {
  const back = document.createElement("div");
  back.className = "inline-modal-backdrop show";
  const wrap = document.createElement("div");
  wrap.className = "inline-modal";
  back.appendChild(wrap);
  buildBody(wrap);
  document.body.appendChild(back);
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    back.remove();
    document.removeEventListener("keydown", keyHandler, true);
  };
  const keyHandler = (e) => {
    if (closed) return;
    onKeydown && onKeydown(e, close);
  };
  document.addEventListener("keydown", keyHandler, true);
  return { back, wrap, close };
}

function inlineConfirm({ title = "確認", message = "", okText = "確認", cancelText = "取消", danger = false } = {}) {
  return new Promise((resolve) => {
    const handle = _openInlineModal((wrap) => {
      wrap.innerHTML = `
        <div class="inline-modal-title${danger ? " danger" : ""}">${_imodalEsc(title)}</div>
        ${message ? `<div class="inline-modal-body">${typeof message === "string" ? _imodalEsc(message) : ""}</div>` : ""}
        <div class="inline-modal-footer">
          <button class="btn btn-ghost" data-act="cancel">${_imodalEsc(cancelText)}</button>
          <button class="btn ${danger ? "btn-danger" : "btn-primary"}" data-act="ok">${_imodalEsc(okText)}</button>
        </div>
      `;
      // Allow message to be HTML when explicitly passed as { __html: ... }
      if (message && typeof message === "object" && message.__html) {
        wrap.querySelector(".inline-modal-body").innerHTML = message.__html;
      }
    }, (e, close) => {
      if (e.key === "Escape") { e.preventDefault(); close(); resolve(false); }
      else if (e.key === "Enter") { e.preventDefault(); close(); resolve(true); }
    });
    handle.back.addEventListener("click", (e) => {
      if (e.target === handle.back) { handle.close(); resolve(false); return; }
      const btn = e.target.closest("button[data-act]");
      if (!btn) return;
      handle.close();
      resolve(btn.dataset.act === "ok");
    });
    requestAnimationFrame(() => {
      const ok = handle.wrap.querySelector('button[data-act="ok"]');
      if (ok) ok.focus();
    });
  });
}

function inlinePrompt({
  title = "輸入", message = "", defaultValue = "", placeholder = "",
  okText = "確認", cancelText = "取消",
  validate = null,  // (value) => string | null  (return error message to block)
} = {}) {
  return new Promise((resolve) => {
    const handle = _openInlineModal((wrap) => {
      wrap.innerHTML = `
        <div class="inline-modal-title">${_imodalEsc(title)}</div>
        ${message ? `<div class="inline-modal-body">${_imodalEsc(message)}</div>` : ""}
        <input type="text" class="inline-modal-input" placeholder="${_imodalEsc(placeholder)}" value="${_imodalEsc(defaultValue)}">
        <div class="inline-modal-body" data-error style="color:var(--danger);font-size:12px;margin-bottom:8px;display:none;"></div>
        <div class="inline-modal-footer">
          <button class="btn btn-ghost" data-act="cancel">${_imodalEsc(cancelText)}</button>
          <button class="btn btn-primary" data-act="ok">${_imodalEsc(okText)}</button>
        </div>
      `;
    }, (e, close) => {
      if (e.key === "Escape") { e.preventDefault(); close(); resolve(null); }
    });
    const input = handle.wrap.querySelector(".inline-modal-input");
    const errBox = handle.wrap.querySelector("[data-error]");
    const submit = () => {
      const v = (input.value || "").trim();
      if (validate) {
        const err = validate(v);
        if (err) {
          errBox.textContent = err;
          errBox.style.display = "block";
          input.classList.add("error");
          input.focus();
          input.select();
          return;
        }
      }
      handle.close();
      resolve(v);
    };
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); submit(); }
    });
    handle.back.addEventListener("click", (e) => {
      if (e.target === handle.back) { handle.close(); resolve(null); return; }
      const btn = e.target.closest("button[data-act]");
      if (!btn) return;
      if (btn.dataset.act === "ok") submit();
      else { handle.close(); resolve(null); }
    });
    requestAnimationFrame(() => { input.focus(); input.select(); });
  });
}

// Multi-choice picker — returns chosen key, or null on cancel.
// options: [{ key, label, desc?, danger? }]
function inlineChoose({ title, message = "", options = [], cancelText = "取消" } = {}) {
  return new Promise((resolve) => {
    const handle = _openInlineModal((wrap) => {
      const optsHtml = options.map(o =>
        `<button class="inline-modal-choice${o.danger ? " danger" : ""}" data-key="${_imodalEsc(o.key)}">
           <strong>${_imodalEsc(o.label)}</strong>${o.desc ? _imodalEsc(o.desc) : ""}
         </button>`
      ).join("");
      wrap.innerHTML = `
        <div class="inline-modal-title">${_imodalEsc(title)}</div>
        ${message ? `<div class="inline-modal-body">${_imodalEsc(message)}</div>` : ""}
        <div class="inline-modal-choices">${optsHtml}</div>
        <div class="inline-modal-footer">
          <button class="btn btn-ghost" data-act="cancel">${_imodalEsc(cancelText)}</button>
        </div>
      `;
    }, (e, close) => {
      if (e.key === "Escape") { e.preventDefault(); close(); resolve(null); }
    });
    handle.back.addEventListener("click", (e) => {
      if (e.target === handle.back) { handle.close(); resolve(null); return; }
      const choice = e.target.closest(".inline-modal-choice");
      if (choice) { handle.close(); resolve(choice.dataset.key); return; }
      const cancel = e.target.closest('button[data-act="cancel"]');
      if (cancel) { handle.close(); resolve(null); }
    });
  });
}

// ============================================================
//  Script Editor Autocomplete
// ============================================================
// Three modes share one popup:
//   "asset"    inside [bg:…], [cg:…], [cg full:…]
//   "char"     at line start, typing a character name
//   "position" Tab pressed right after a character name (pick 左/中/右)

const ac = {
  popup: null,
  items: [],         // shape varies per kind
  selectedIdx: 0,
  kind: null,        // "asset" | "char" | "position"
  type: null,        // asset sub-type: "bg" | "cg" | "cg_full"
  start: -1,         // start index (in textarea value) of the portion to replace
  end: -1,           // end index
  query: "",
};

// Detect whether the caret is inside an [bg:..|cg:..|cg full:..] token.
// Returns { type, query, start, end } or null.
function detectAssetToken() {
  const ta = els.scriptArea;
  const pos = ta.selectionStart || 0;
  const text = ta.value;
  const lineStart = text.lastIndexOf("\n", pos - 1) + 1;
  const lineEndIdx = text.indexOf("\n", pos);
  const lineEnd = lineEndIdx === -1 ? text.length : lineEndIdx;
  const beforeCursor = text.slice(lineStart, pos);
  const afterCursor = text.slice(pos, lineEnd);

  // The bracket must not have been closed before the cursor on this line.
  const m = beforeCursor.match(/\[(bg|cg(?:\s+full)?)\s*:\s*([^\]\n]*)$/i);
  if (!m) return null;
  const tag = m[1].toLowerCase().replace(/\s+/g, " ");
  const type = tag === "bg" ? "bg" : (tag === "cg full" ? "cg_full" : "cg");
  const query = m[2];

  // The query portion ends at cursor, OR at the next ] if the user clicked into
  // the middle of an existing [bg: 黃昏].  In the latter case we want to
  // replace the whole inner part.
  let queryEnd = pos;
  const closing = afterCursor.match(/^([^\]\n]*)/);
  if (closing) queryEnd = pos + closing[1].length;
  const queryText = text.slice(pos - query.length, queryEnd);
  return {
    type,
    query: queryText.trim(),
    start: pos - query.length,
    end: queryEnd,
  };
}

function listAssetNames(type) {
  if (type === "bg") {
    return Object.keys(state.backgrounds).filter(k => k !== "default");
  }
  // cg / cg_full share the same list
  return Object.keys(state.cgs);
}

function suggestAssets(type, query) {
  const all = listAssetNames(type);
  const q = (query || "").trim();
  const qLower = q.toLowerCase();
  const scored = [];
  for (const name of all) {
    const lower = name.toLowerCase();
    let score = -1;
    if (!q) score = 0;
    else if (lower === qLower || name === q) score = 0;
    else if (lower.startsWith(qLower) || name.startsWith(q)) score = 1;
    else if (lower.includes(qLower) || name.includes(q)) score = 2;
    if (score >= 0) scored.push({ name, score });
  }
  scored.sort((a, b) => a.score - b.score || a.name.localeCompare(b.name, "zh"));
  return scored.slice(0, 10);
}

// Caret coords inside a textarea via mirror div technique.
function getTextareaCaretCoords(ta) {
  const cs = window.getComputedStyle(ta);
  const div = document.createElement("div");
  const props = [
    "boxSizing", "width", "height", "overflowX", "overflowY",
    "borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth",
    "borderStyle", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
    "fontStyle", "fontVariant", "fontWeight", "fontStretch", "fontSize",
    "lineHeight", "fontFamily", "textAlign", "textTransform", "textIndent",
    "letterSpacing", "wordSpacing", "tabSize", "MozTabSize", "whiteSpace", "wordWrap",
  ];
  for (const p of props) div.style[p] = cs[p];
  div.style.position = "absolute";
  div.style.visibility = "hidden";
  div.style.whiteSpace = "pre-wrap";
  div.style.wordWrap = "break-word";
  div.style.top = "0";
  div.style.left = "-9999px";

  const pos = ta.selectionStart;
  div.textContent = ta.value.substring(0, pos);
  const span = document.createElement("span");
  span.textContent = ta.value.substring(pos) || ".";
  div.appendChild(span);

  document.body.appendChild(div);
  const spanRect = span.getBoundingClientRect();
  const divRect = div.getBoundingClientRect();
  const taRect = ta.getBoundingClientRect();
  const offsetTop = spanRect.top - divRect.top;
  const offsetLeft = spanRect.left - divRect.left;
  const lineHeight = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2;
  document.body.removeChild(div);
  return {
    top: taRect.top + offsetTop - ta.scrollTop,
    left: taRect.left + offsetLeft - ta.scrollLeft,
    lineHeight,
  };
}

function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function highlightMatch(name, query) {
  if (!query) return escapeHtml(name);
  const lower = name.toLowerCase();
  const qLower = query.toLowerCase();
  const idx = lower.indexOf(qLower);
  if (idx < 0) return escapeHtml(name);
  return escapeHtml(name.slice(0, idx)) +
    `<span class="asset-ac-match">${escapeHtml(name.slice(idx, idx + query.length))}</span>` +
    escapeHtml(name.slice(idx + query.length));
}

function maybeShowAssetAutoComplete() {
  const tok = detectAssetToken();
  if (!tok) { closeAssetAutoComplete(); return; }
  const items = suggestAssets(tok.type, tok.query);
  showAssetAutoComplete(tok, items);
}

function showAssetAutoComplete(tok, items) {
  closeAssetAutoComplete();
  ac.kind = "asset";
  ac.type = tok.type;
  ac.start = tok.start;
  ac.end = tok.end;
  ac.query = tok.query;
  ac.items = items;
  ac.selectedIdx = 0;

  const popup = document.createElement("div");
  popup.className = "asset-ac-popup";
  ac.popup = popup;

  const labels = { bg: "背景", cg: "CG 圖卡", cg_full: "CG 圖卡（全螢幕）" };
  const icons = { bg: "🌄", cg: "🖼", cg_full: "🖼" };
  const header = document.createElement("div");
  header.className = "asset-ac-header";
  header.innerHTML = `提示 · <strong>${labels[tok.type]}</strong>`;
  popup.appendChild(header);

  if (items.length === 0) {
    const empty = document.createElement("div");
    empty.className = "asset-ac-empty";
    const all = listAssetNames(tok.type);
    if (all.length === 0) {
      empty.innerHTML = `尚未建立任何${labels[tok.type]}<br>請先到「👥 角色」彈窗的 <kbd>${tok.type === "bg" ? "場景 背景" : "CG 圖卡"}</kbd> 分頁新增`;
    } else {
      empty.innerHTML = `沒有符合「${escapeHtml(tok.query)}」的項目`;
    }
    popup.appendChild(empty);
  } else {
    items.forEach((it, idx) => {
      const el = document.createElement("div");
      el.className = "asset-ac-item" + (idx === 0 ? " selected" : "");
      el.dataset.idx = idx;
      el.innerHTML =
        `<span class="asset-ac-icon">${icons[tok.type]}</span>` +
        `<span>${highlightMatch(it.name, tok.query)}</span>` +
        (tok.type === "cg_full" ? `<span class="asset-ac-tag">full</span>` : "");
      el.addEventListener("mouseenter", () => { ac.selectedIdx = idx; updateAssetSelected(); });
      el.addEventListener("mousedown", (ev) => {
        ev.preventDefault();
        ac.selectedIdx = idx;
        acceptAssetAutoComplete();
      });
      popup.appendChild(el);
    });

    const hint = document.createElement("div");
    hint.className = "asset-ac-hint";
    hint.innerHTML = "<span><kbd>↑↓</kbd> 選</span><span><kbd>Tab</kbd>/<kbd>Enter</kbd> 補全</span><span><kbd>Esc</kbd> 關閉</span>";
    popup.appendChild(hint);
  }

  document.body.appendChild(popup);
  positionAssetAutoComplete();
  requestAnimationFrame(positionAssetAutoComplete);
}

function positionAssetAutoComplete() {
  if (!ac.popup) return;
  const ta = els.scriptArea;
  const taRect = ta.getBoundingClientRect();
  const caret = getTextareaCaretCoords(ta);
  const popupW = ac.popup.offsetWidth || 240;
  const popupH = ac.popup.offsetHeight || 180;
  const margin = 4;

  let top = caret.top + caret.lineHeight + margin;
  let left = caret.left;

  // flip up if no room below
  if (top + popupH > window.innerHeight - 12) {
    top = caret.top - popupH - margin;
  }
  if (top < 12) top = 12;

  if (left + popupW > window.innerWidth - 12) left = window.innerWidth - popupW - 12;
  if (left < taRect.left) left = taRect.left;
  if (left < 12) left = 12;

  ac.popup.style.top = top + "px";
  ac.popup.style.left = left + "px";
}

function updateAssetSelected() {
  if (!ac.popup) return;
  ac.popup.querySelectorAll(".asset-ac-item").forEach((el, i) => {
    el.classList.toggle("selected", i === ac.selectedIdx);
  });
  const sel = ac.popup.querySelector(".asset-ac-item.selected");
  if (sel) sel.scrollIntoView({ block: "nearest" });
}

function moveAssetAutoComplete(delta) {
  if (!ac.popup || ac.items.length === 0) return;
  ac.selectedIdx = (ac.selectedIdx + delta + ac.items.length) % ac.items.length;
  updateAssetSelected();
}

function acceptAssetAutoComplete() {
  if (!ac.popup || ac.items.length === 0) return;
  const chosen = ac.items[ac.selectedIdx];
  if (!chosen) return;
  const ta = els.scriptArea;
  const text = ta.value;
  const insertion = chosen.name;
  const before = text.slice(0, ac.start);
  const after = text.slice(ac.end);
  ta.value = before + insertion + after;
  state.script = ta.value;
  const newPos = ac.start + insertion.length;
  ta.focus();
  ta.setSelectionRange(newPos, newPos);
  closeAssetAutoComplete();
  reparseAndRender(false);
  saveToStorage();
}

function closeAssetAutoComplete() {
  if (ac.popup) {
    ac.popup.remove();
    ac.popup = null;
  }
  ac.items = [];
  ac.selectedIdx = 0;
  ac.type = null;
  ac.kind = null;
}

// ===== Char-name autocomplete (line start) =====================================

// Detects whether the cursor is on a "speaker line" being authored.
// Returns { name, tagsRaw, lineStart, lineStartAbs, hasPosition } or null.
function detectSpeakerLineContext() {
  const ta = els.scriptArea;
  const pos = ta.selectionStart || 0;
  const text = ta.value;
  const lineStartAbs = text.lastIndexOf("\n", pos - 1) + 1;
  const beforeCursor = text.slice(lineStartAbs, pos);
  // Skip if line already contains a colon (we're past the speaker portion now)
  if (/[:：]/.test(beforeCursor)) return null;
  // Skip command lines beginning with [ or - or * (but / is just dialogue '/' safe)
  if (/^\s*[\[\-*]/.test(beforeCursor)) return null;
  // Match: optional indent + name (no [, :, ：) + zero or more bracketed tags + cursor
  const m = beforeCursor.match(/^(\s*)([^\[\]:：\n]*?)((?:\[[^\]\n]*\])*)$/);
  if (!m) return null;
  const tagsRaw = m[3] || "";
  const tags = [...tagsRaw.matchAll(/\[([^\]]*)\]/g)].map(t => t[1].trim());
  const POS = ["左", "中", "右"];
  const hasPosition = tags.some(t => POS.includes(t));
  return {
    indent: m[1] || "",
    name: m[2] || "",
    tagsRaw,
    tags,
    hasPosition,
    lineStartAbs,
  };
}

function suggestCharNames(query) {
  const q = (query || "").trim().toLowerCase();
  const matches = [];
  for (const ch of state.characters) {
    if (!ch.name) continue;
    const lower = ch.name.toLowerCase();
    let score = -1;
    if (!q) score = 0;
    else if (lower === q) score = 0;
    else if (lower.startsWith(q)) score = 1;
    else if (lower.includes(q) || ch.name.includes(query.trim())) score = 2;
    if (score >= 0) matches.push({ ch, score });
  }
  matches.sort((a, b) => a.score - b.score || a.ch.name.localeCompare(b.ch.name, "zh"));
  // Build entries: bare name first, then one per emotion
  const entries = [];
  for (const { ch } of matches) {
    entries.push({
      label: `${ch.name}：`,
      insertName: ch.name,
      emotion: null,
      ch,
    });
    for (const emo of (ch.emotions || [])) {
      entries.push({
        label: `${ch.name}[${emo}]：`,
        insertName: ch.name,
        emotion: emo,
        ch,
      });
    }
  }
  return entries.slice(0, 12);
}

function showCharAutoComplete(ctx) {
  closeAssetAutoComplete();
  const items = suggestCharNames(ctx.name);
  if (items.length === 0) return;

  ac.kind = "char";
  ac.items = items;
  ac.selectedIdx = 0;
  // The portion to replace is from line-start (after indent) to the cursor
  ac.start = ctx.lineStartAbs + ctx.indent.length;
  ac.end = els.scriptArea.selectionStart || ac.start;
  ac.query = ctx.name;

  const popup = document.createElement("div");
  popup.className = "asset-ac-popup";
  ac.popup = popup;

  const header = document.createElement("div");
  header.className = "asset-ac-header";
  header.innerHTML = `角色 · <strong>${escapeHtml(ctx.name) || "（全部）"}</strong>`;
  popup.appendChild(header);

  items.forEach((it, idx) => {
    const el = document.createElement("div");
    el.className = "asset-ac-item" + (idx === 0 ? " selected" : "");
    el.dataset.idx = idx;
    const dot = `<span class="asset-ac-icon" style="color:${it.ch.color}">●</span>`;
    const labelHtml = highlightMatch(it.insertName, ctx.name) +
      (it.emotion ? `<span class="asset-ac-tag" style="margin-left:4px;color:var(--gold-bright);">[${escapeHtml(it.emotion)}]</span>` : "");
    el.innerHTML = `${dot}<span>${labelHtml}</span>`;
    el.addEventListener("mouseenter", () => { ac.selectedIdx = idx; updateAssetSelected(); });
    el.addEventListener("mousedown", (ev) => {
      ev.preventDefault();
      ac.selectedIdx = idx;
      acceptAutoComplete();
    });
    popup.appendChild(el);
  });

  const hint = document.createElement("div");
  hint.className = "asset-ac-hint";
  hint.innerHTML = "<span><kbd>↑↓</kbd> 選</span><span><kbd>Tab</kbd>/<kbd>Enter</kbd> 補全</span><span><kbd>Esc</kbd> 關閉</span>";
  popup.appendChild(hint);

  document.body.appendChild(popup);
  positionAssetAutoComplete();
  requestAnimationFrame(positionAssetAutoComplete);
}

// ===== Position picker (Tab triggered) =========================================

function showPositionPicker(ctx) {
  closeAssetAutoComplete();
  const POS = [
    { key: "左", label: "左", desc: "Left" },
    { key: "中", label: "中", desc: "Center" },
    { key: "右", label: "右", desc: "Right" },
  ];
  ac.kind = "position";
  ac.items = POS;
  ac.selectedIdx = 1; // default 中
  // Insert at end of tagsRaw (right after last `]`) — record cursor
  const ta = els.scriptArea;
  ac.start = ta.selectionStart || 0;
  ac.end = ac.start;
  ac.query = "";

  const popup = document.createElement("div");
  popup.className = "asset-ac-popup";
  ac.popup = popup;

  const header = document.createElement("div");
  header.className = "asset-ac-header";
  header.innerHTML = `位置 · <strong>選擇出場位置</strong>`;
  popup.appendChild(header);

  POS.forEach((p, idx) => {
    const el = document.createElement("div");
    el.className = "asset-ac-item" + (idx === ac.selectedIdx ? " selected" : "");
    el.dataset.idx = idx;
    el.innerHTML = `<span class="asset-ac-icon">▎</span><span>${escapeHtml(p.label)}</span><span class="asset-ac-tag">${p.desc}</span>`;
    el.addEventListener("mouseenter", () => { ac.selectedIdx = idx; updateAssetSelected(); });
    el.addEventListener("mousedown", (ev) => {
      ev.preventDefault();
      ac.selectedIdx = idx;
      acceptAutoComplete();
    });
    popup.appendChild(el);
  });

  const hint = document.createElement("div");
  hint.className = "asset-ac-hint";
  hint.innerHTML = "<span><kbd>1/2/3</kbd> 直接選</span><span><kbd>↑↓</kbd> 切換</span><span><kbd>Tab</kbd>/<kbd>Enter</kbd> 確認</span><span><kbd>Esc</kbd> 關閉</span>";
  popup.appendChild(hint);

  document.body.appendChild(popup);
  positionAssetAutoComplete();
  requestAnimationFrame(positionAssetAutoComplete);
}

// ===== Alias / hide-name picker (Tab triggered after position) =================

// Guards the Tab handler from re-opening the alias picker while the alias
// input prompt is awaiting user input (the line state still matches the
// trigger condition until the user actually submits a name).
let _pendingAliasPrompt = false;

function showAliasHidePicker(ctx) {
  closeAssetAutoComplete();
  closeSpeakerAutoComplete();
  const OPTIONS = [
    { key: "hide",  label: "[?]",        desc: "隱藏真名（顯示 ???）" },
    { key: "alias", label: "輸入別名…",  desc: "顯示自訂名（例如「神秘人」）" },
  ];
  ac.kind = "alias-hide";
  ac.items = OPTIONS;
  ac.selectedIdx = 0;
  const ta = els.scriptArea;
  ac.start = ta.selectionStart || 0;
  ac.end = ac.start;
  ac.query = "";

  const popup = document.createElement("div");
  popup.className = "asset-ac-popup";
  ac.popup = popup;

  const header = document.createElement("div");
  header.className = "asset-ac-header";
  header.innerHTML = `名稱顯示 · <strong>選擇 [?] 或輸入別名</strong>`;
  popup.appendChild(header);

  OPTIONS.forEach((opt, idx) => {
    const el = document.createElement("div");
    el.className = "asset-ac-item" + (idx === ac.selectedIdx ? " selected" : "");
    el.dataset.idx = idx;
    el.innerHTML = `<span class="asset-ac-icon">❔</span><span>${escapeHtml(opt.label)}</span><span class="asset-ac-tag">${escapeHtml(opt.desc)}</span>`;
    el.addEventListener("mouseenter", () => { ac.selectedIdx = idx; updateAssetSelected(); });
    el.addEventListener("mousedown", (ev) => {
      ev.preventDefault();
      ac.selectedIdx = idx;
      acceptAutoComplete();
    });
    popup.appendChild(el);
  });

  const hint = document.createElement("div");
  hint.className = "asset-ac-hint";
  hint.innerHTML = "<span><kbd>↑↓</kbd> 選</span><span><kbd>Tab</kbd>/<kbd>Enter</kbd> 確認</span><span><kbd>Esc</kbd> 跳過</span>";
  popup.appendChild(hint);

  document.body.appendChild(popup);
  positionAssetAutoComplete();
  requestAnimationFrame(positionAssetAutoComplete);
}

async function promptForAliasAndInsert(insertAt) {
  const ta = els.scriptArea;
  try {
    const name = await inlinePrompt({
      title: "顯示名稱",
      message: "對話框上要顯示成什麼？（不影響真正的角色名）",
      placeholder: "例如：神秘人 / 一個奇怪的人",
    });
    if (!name) {
      // user cancelled — leave the line as-is so they can decide manually
      ta.focus();
      return;
    }
    const text = ta.value;
    const insertion = `[?:${name}]：`;
    ta.value = text.slice(0, insertAt) + insertion + text.slice(insertAt);
    state.script = ta.value;
    const newPos = insertAt + insertion.length;
    ta.focus();
    ta.setSelectionRange(newPos, newPos);
    reparseAndRender(false);
    saveToStorage();
  } finally {
    _pendingAliasPrompt = false;
  }
}

// ===== Unified accept (handles all 3 kinds) ====================================

function acceptAutoComplete() {
  if (!ac.popup || ac.items.length === 0) return;
  const ta = els.scriptArea;
  const text = ta.value;
  const chosen = ac.items[ac.selectedIdx];

  if (ac.kind === "asset") {
    return acceptAssetAutoComplete();
  }
  if (ac.kind === "char") {
    // Bare name → close prefix with `：` (done in one Tab).
    // With emotion → leave open so Tab can chain into position / alias pickers.
    const before = text.slice(0, ac.start);
    const after = text.slice(ac.end);
    const insertion = chosen.emotion
      ? `${chosen.insertName}[${chosen.emotion}]`
      : `${chosen.insertName}：`;
    ta.value = before + insertion + after;
    state.script = ta.value;
    const newPos = ac.start + insertion.length;
    ta.focus();
    ta.setSelectionRange(newPos, newPos);
    closeAssetAutoComplete();
    reparseAndRender(false);
    saveToStorage();
    return;
  }
  if (ac.kind === "position") {
    // Insert [位置] at the end of the existing tag string of the speaker line.
    // Determine where: end of contiguous `]` chain before cursor on this line.
    const pos = ta.selectionStart || 0;
    const lineStartAbs = text.lastIndexOf("\n", pos - 1) + 1;
    const lineToCursor = text.slice(lineStartAbs, pos);
    // Find end-of-tag position: last `]` on the line (or right after the name if no tags yet)
    let insertAt = pos;
    const tagMatch = lineToCursor.match(/^(\s*[^\[\]:：\n]*(?:\[[^\]\n]*\])*)/);
    if (tagMatch) insertAt = lineStartAbs + tagMatch[0].length;
    const insertion = `[${chosen.key}]`;
    ta.value = text.slice(0, insertAt) + insertion + text.slice(insertAt);
    state.script = ta.value;
    const newPos = insertAt + insertion.length;
    ta.focus();
    ta.setSelectionRange(newPos, newPos);
    closeAssetAutoComplete();
    reparseAndRender(false);
    saveToStorage();
    return;
  }
  if (ac.kind === "alias-hide") {
    // Insert at the end of the tag chain on the current line.
    const pos = ta.selectionStart || 0;
    const lineStartAbs = text.lastIndexOf("\n", pos - 1) + 1;
    const lineToCursor = text.slice(lineStartAbs, pos);
    let insertAt = pos;
    const tagMatch = lineToCursor.match(/^(\s*[^\[\]:：\n]*(?:\[[^\]\n]*\])*)/);
    if (tagMatch) insertAt = lineStartAbs + tagMatch[0].length;

    if (chosen.key === "hide") {
      const insertion = `[?]：`;
      ta.value = text.slice(0, insertAt) + insertion + text.slice(insertAt);
      state.script = ta.value;
      const newPos = insertAt + insertion.length;
      ta.focus();
      ta.setSelectionRange(newPos, newPos);
      closeAssetAutoComplete();
      reparseAndRender(false);
      saveToStorage();
      return;
    }
    if (chosen.key === "alias") {
      _pendingAliasPrompt = true;
      closeAssetAutoComplete();
      promptForAliasAndInsert(insertAt);
      return;
    }
  }
}

// ===== Unified maybeShow (called on input/click) ===============================

function maybeShowAutoComplete() {
  // 1. Asset context wins — most specific
  const assetTok = detectAssetToken();
  if (assetTok) {
    const items = suggestAssets(assetTok.type, assetTok.query);
    showAssetAutoComplete(assetTok, items);
    return;
  }
  // 2. Speaker-line context — show char name suggestions if there's any text typed
  const speakerCtx = detectSpeakerLineContext();
  if (speakerCtx && speakerCtx.name.trim() && !speakerCtx.tagsRaw && state.characters.length > 0) {
    showCharAutoComplete(speakerCtx);
    return;
  }
  // Nothing matches — close any open popup
  if (ac.popup) closeAssetAutoComplete();
}

// ===== Wire up =================================================================

els.scriptArea.addEventListener("input", maybeShowAutoComplete);
els.scriptArea.addEventListener("click", maybeShowAutoComplete);
els.scriptArea.addEventListener("keyup", (e) => {
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(e.key) && !ac.popup) {
    maybeShowAutoComplete();
  }
});
els.scriptArea.addEventListener("blur", () => {
  // delay so a mousedown on an item still gets to fire
  setTimeout(closeAssetAutoComplete, 150);
});

// Async wrapper for the display-name prompt (uses inlinePrompt)
async function promptAndInsertDisplayName() {
  const ta = els.scriptArea;
  const pos = ta.selectionStart || 0;
  const name = await inlinePrompt({
    title: "顯示名稱（速寫）",
    message: "輸入要顯示在對話框上的名字（不影響真正的角色名）。\n等同於插入 [?:輸入內容]。",
    placeholder: "例如:神秘人 / 一個戴著狐耳的維埃拉族男子",
  });
  if (!name) {
    els.scriptArea.focus();
    els.scriptArea.setSelectionRange(pos, pos);
    return;
  }
  const text = els.scriptArea.value;
  const insertion = `[?:${name}]`;
  els.scriptArea.value = text.slice(0, pos) + insertion + text.slice(pos);
  state.script = els.scriptArea.value;
  const newPos = pos + insertion.length;
  els.scriptArea.focus();
  els.scriptArea.setSelectionRange(newPos, newPos);
  reparseAndRender(false);
  saveToStorage();
}

// ============================================================
//  Tab focus guard — Tab in the script editor never escapes focus.
//  Runs in capture phase so it fires before any other handler. Other handlers
//  can still react to Tab for their own actions (popups, position picker,
//  speaker repeat); this just guarantees the textarea keeps focus regardless.
// ============================================================
els.scriptArea.addEventListener("keydown", (e) => {
  if (e.key === "Tab" && !e.ctrlKey && !e.metaKey && !e.altKey) {
    e.preventDefault();
  }
}, true);

els.scriptArea.addEventListener("keydown", (e) => {
  // Popup-aware key handling
  if (ac.popup) {
    if (e.key === "ArrowDown") { e.preventDefault(); moveAssetAutoComplete(1); return; }
    if (e.key === "ArrowUp")   { e.preventDefault(); moveAssetAutoComplete(-1); return; }
    if (ac.kind === "position" && (e.key === "1" || e.key === "2" || e.key === "3")) {
      e.preventDefault();
      ac.selectedIdx = parseInt(e.key, 10) - 1;
      acceptAutoComplete();
      return;
    }
    if (e.key === "Tab" || e.key === "Enter") {
      if (ac.items.length > 0) {
        e.preventDefault();
        acceptAutoComplete();
        return;
      }
      closeAssetAutoComplete();
      return;
    }
    if (e.key === "Escape") { e.preventDefault(); closeAssetAutoComplete(); return; }
    // Continue typing — popup will refresh on next 'input' event
  }

  // No popup open: handle special triggers
  if (e.key === "Tab" && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
    const ctx = detectSpeakerLineContext();
    if (ctx && ctx.name.trim() && !ctx.hasPosition) {
      // Only meaningful if it matches a real character
      const knownChar = state.characters.some(c => c.name === ctx.name.trim());
      if (knownChar) {
        e.preventDefault();
        showPositionPicker(ctx);
        return;
      }
    }
  }
  if ((e.key === "?" || e.key === "?") && !e.ctrlKey && !e.metaKey && !e.altKey) {
    // Only intercept ? when on a speaker line, after a tag bracket, no colon yet
    const ta = els.scriptArea;
    const pos = ta.selectionStart || 0;
    if (pos !== (ta.selectionEnd || 0)) return;  // skip if a selection exists
    const text = ta.value;
    const lineStartAbs = text.lastIndexOf("\n", pos - 1) + 1;
    const beforeCursor = text.slice(lineStartAbs, pos);
    if (/[:：]/.test(beforeCursor)) return;
    // require: matches speaker pattern + at least one tag, cursor at end of `]`
    const m = beforeCursor.match(/^\s*[^\[\]:：\n]+(\[[^\]\n]*\])+$/);
    if (!m) return;
    const knownChar = state.characters.some(c => beforeCursor.includes(c.name));
    if (!knownChar) return;
    e.preventDefault();
    promptAndInsertDisplayName();
    return;
  }

  // ===== Bonus: auto-pair `[` and skip-over `]` =====
  if (e.key === "[" && !e.ctrlKey && !e.metaKey && !e.altKey) {
    const ta = els.scriptArea;
    const start = ta.selectionStart || 0;
    const end = ta.selectionEnd || 0;
    if (start !== end) return; // selection — let default handle
    e.preventDefault();
    const text = ta.value;
    ta.value = text.slice(0, start) + "[]" + text.slice(end);
    state.script = ta.value;
    ta.setSelectionRange(start + 1, start + 1);
    reparseAndRender(false);
    setTimeout(maybeShowAutoComplete, 0);
    return;
  }
  if (e.key === "]" && !e.ctrlKey && !e.metaKey && !e.altKey) {
    const ta = els.scriptArea;
    const start = ta.selectionStart || 0;
    const end = ta.selectionEnd || 0;
    if (start !== end) return;
    if (ta.value[start] === "]") {
      // Skip over the existing `]` instead of inserting another
      e.preventDefault();
      ta.setSelectionRange(start + 1, start + 1);
      return;
    }
  }

  // ===== Bonus: Tab at start of empty line repeats the last speaker =====
  if (e.key === "Tab" && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
    const ta = els.scriptArea;
    const pos = ta.selectionStart || 0;
    if (pos !== (ta.selectionEnd || 0)) return;
    const text = ta.value;
    const lineStartAbs = text.lastIndexOf("\n", pos - 1) + 1;
    const beforeCursor = text.slice(lineStartAbs, pos);
    if (beforeCursor.trim() !== "") return;  // only on empty lines
    // find the most recent speaker prefix in the lines above
    const above = text.slice(0, lineStartAbs).split("\n");
    let prefix = null;
    for (let i = above.length - 1; i >= 0; i--) {
      const m = above[i].match(/^(\s*[^\[\]:：\n]+(?:\[[^\]\n]*\])*[:：])/);
      if (m) { prefix = m[1]; break; }
    }
    if (!prefix) return;
    e.preventDefault();
    ta.value = text.slice(0, pos) + prefix + text.slice(pos);
    state.script = ta.value;
    const newPos = pos + prefix.length;
    ta.setSelectionRange(newPos, newPos);
    reparseAndRender(false);
    saveToStorage();
    return;
  }
});

window.addEventListener("scroll", () => { if (ac.popup) positionAssetAutoComplete(); }, true);
window.addEventListener("resize", () => { if (ac.popup) positionAssetAutoComplete(); });

// ============================================================
//  Speaker / character-line Autocomplete
// ============================================================
// Fires when the cursor is in the speaker portion of a character line
// (no ":" yet, line doesn't start with "[" or "-"). Three modes:
//   - "name"     : suggest 角色名 + 角色名[表情] variants
//   - "position" : Tab pops a 左/中/右 picker
//   - The "?" key opens an inline prompt for a display-override name.

const cac = {
  popup: null,
  items: [],
  selectedIdx: 0,
  mode: null,    // "name" | "position"
  start: -1,     // replacement range
  end: -1,
  ctx: null,
};

const POS_TAGS_SET = new Set(["左", "中", "右"]);
const isHideTag = (t) => t === "?" || t === "？" || t === "???" || /^[?？][:：]/.test(t);

function detectSpeakerContext() {
  const ta = els.scriptArea;
  const pos = ta.selectionStart || 0;
  const text = ta.value;
  const lineStart = text.lastIndexOf("\n", pos - 1) + 1;
  const beforeCursor = text.slice(lineStart, pos);

  // not in speaker portion if `:` appears before cursor on this line
  if (/[:：]/.test(beforeCursor)) return null;
  // skip command lines
  if (/^\s*\[/.test(beforeCursor)) return null;
  // skip choice items
  if (/^\s*[-－]/.test(beforeCursor)) return null;
  // skip comment lines
  if (/^\s*\/\//.test(beforeCursor)) return null;

  // shape: indent + name + [tag][tag]...   (cursor at end of this whole thing)
  const m = beforeCursor.match(/^(\s*)([^\[:：\n]*?)((?:\[[^\]\n]*\])*)$/);
  if (!m) return null;
  const indent = m[1];
  const name = m[2];
  const tagsRaw = m[3];

  // depth = unclosed brackets so far on this line; if >0 we're INSIDE a [...]
  let depth = 0;
  for (const c of beforeCursor) {
    if (c === "[") depth++;
    else if (c === "]") depth--;
  }

  const tags = [...tagsRaw.matchAll(/\[([^\]]*)\]/g)].map(t => t[1].trim());
  const matchedChar = state.characters.find(c => c.name === name.trim()) || null;
  const hasPosition = tags.some(t => POS_TAGS_SET.has(t));
  const hasNameOverride = tags.some(t => isHideTag(t));
  const hasEmotion = tags.some(t => !POS_TAGS_SET.has(t) && !isHideTag(t));

  return {
    indent, name, tagsRaw, tags,
    insideBracket: depth > 0,
    matchedChar,
    hasPosition, hasNameOverride, hasEmotion,
    speakerEnd: pos,
    lineStart,
  };
}

function suggestSpeakerNames(query) {
  const q = (query || "").trim();
  const qLower = q.toLowerCase();
  const items = [];
  for (const ch of state.characters) {
    const lower = ch.name.toLowerCase();
    let score = -1;
    if (!q) score = 0;
    else if (lower === qLower) score = 0;
    else if (lower.startsWith(qLower) || ch.name.startsWith(q)) score = 1;
    else if (lower.includes(qLower) || ch.name.includes(q)) score = 2;
    if (score < 0) continue;
    // bare name first
    items.push({ kind: "name", ch, score, sub: 0,
      insert: `${ch.name}：`,
      label: `${ch.name}：` });
    // emotions — no `：`, so Tab can chain into position / alias pickers
    (ch.emotions || []).forEach((emo, i) => {
      items.push({ kind: "emotion", ch, emo, score, sub: i + 1,
        insert: `${ch.name}[${emo}]`,
        label: `${ch.name}[${emo}]` });
    });
  }
  items.sort((a, b) => a.score - b.score || a.sub - b.sub);
  return items.slice(0, 14);
}

function showSpeakerAutoComplete(ctx) {
  closeSpeakerAutoComplete();
  closeAssetAutoComplete();

  const items = suggestSpeakerNames(ctx.name);
  if (items.length === 0) return;

  cac.mode = "name";
  cac.items = items;
  cac.selectedIdx = 0;
  // Replace from speaker name start to end of speaker portion (cursor)
  cac.start = ctx.lineStart + ctx.indent.length;
  cac.end = ctx.speakerEnd;
  cac.ctx = ctx;

  const popup = document.createElement("div");
  popup.className = "asset-ac-popup";
  cac.popup = popup;

  const header = document.createElement("div");
  header.className = "asset-ac-header";
  header.innerHTML = `提示 · <strong>說話者</strong>`;
  popup.appendChild(header);

  items.forEach((it, idx) => {
    const el = document.createElement("div");
    el.className = "asset-ac-item" + (idx === 0 ? " selected" : "");
    el.dataset.idx = idx;
    const cnHl = highlightMatch(it.ch.name, ctx.name.trim());
    const tag = it.emo ? `<span class="asset-ac-tag">${escapeHtml(it.emo)}</span>` : "";
    const dot = `<span class="asset-ac-icon" style="color:${it.ch.color}">●</span>`;
    el.innerHTML = dot + `<span>${cnHl}：</span>` + tag;
    el.addEventListener("mouseenter", () => { cac.selectedIdx = idx; updateSpeakerSelected(); });
    el.addEventListener("mousedown", (ev) => {
      ev.preventDefault();
      cac.selectedIdx = idx;
      acceptSpeakerAutoComplete();
    });
    popup.appendChild(el);
  });

  const hint = document.createElement("div");
  hint.className = "asset-ac-hint";
  hint.innerHTML = "<span><kbd>↑↓</kbd> 選</span><span><kbd>Tab</kbd>/<kbd>Enter</kbd> 補全</span><span><kbd>Esc</kbd> 關閉</span>";
  popup.appendChild(hint);

  document.body.appendChild(popup);
  positionSpeakerPopup();
  requestAnimationFrame(positionSpeakerPopup);
}

function showPositionPicker(ctx) {
  closeSpeakerAutoComplete();
  closeAssetAutoComplete();

  cac.mode = "position";
  cac.ctx = ctx;
  cac.start = ctx.speakerEnd;
  cac.end = ctx.speakerEnd;
  cac.selectedIdx = 0;
  cac.items = ["左", "中", "右"].map(p => ({ pos: p }));

  const popup = document.createElement("div");
  popup.className = "asset-ac-popup";
  cac.popup = popup;

  const header = document.createElement("div");
  header.className = "asset-ac-header";
  header.innerHTML = `提示 · <strong>位置</strong> · 選擇後會插入在游標處`;
  popup.appendChild(header);

  ["左", "中", "右"].forEach((p, idx) => {
    const el = document.createElement("div");
    el.className = "asset-ac-item" + (idx === 0 ? " selected" : "");
    el.dataset.idx = idx;
    const arrow = p === "左" ? "◀" : p === "右" ? "▶" : "●";
    el.innerHTML = `<span class="asset-ac-icon">${arrow}</span><span>[${p}]</span>`;
    el.addEventListener("mouseenter", () => { cac.selectedIdx = idx; updateSpeakerSelected(); });
    el.addEventListener("mousedown", (ev) => {
      ev.preventDefault();
      cac.selectedIdx = idx;
      acceptSpeakerAutoComplete();
    });
    popup.appendChild(el);
  });

  const hint = document.createElement("div");
  hint.className = "asset-ac-hint";
  hint.innerHTML = "<span><kbd>↑↓</kbd> 選</span><span><kbd>Tab</kbd>/<kbd>Enter</kbd> 確認</span><span><kbd>Esc</kbd> 取消</span>";
  popup.appendChild(hint);

  document.body.appendChild(popup);
  positionSpeakerPopup();
  requestAnimationFrame(positionSpeakerPopup);
}

function positionSpeakerPopup() {
  if (!cac.popup) return;
  const ta = els.scriptArea;
  const taRect = ta.getBoundingClientRect();
  const caret = getTextareaCaretCoords(ta);
  const popupW = cac.popup.offsetWidth || 240;
  const popupH = cac.popup.offsetHeight || 180;
  const margin = 4;
  let top = caret.top + caret.lineHeight + margin;
  let left = caret.left;
  if (top + popupH > window.innerHeight - 12) top = caret.top - popupH - margin;
  if (top < 12) top = 12;
  if (left + popupW > window.innerWidth - 12) left = window.innerWidth - popupW - 12;
  if (left < taRect.left) left = taRect.left;
  if (left < 12) left = 12;
  cac.popup.style.top = top + "px";
  cac.popup.style.left = left + "px";
}

function updateSpeakerSelected() {
  if (!cac.popup) return;
  cac.popup.querySelectorAll(".asset-ac-item").forEach((el, i) => {
    el.classList.toggle("selected", i === cac.selectedIdx);
  });
  const sel = cac.popup.querySelector(".asset-ac-item.selected");
  if (sel) sel.scrollIntoView({ block: "nearest" });
}

function moveSpeakerAutoComplete(delta) {
  if (!cac.popup || cac.items.length === 0) return;
  cac.selectedIdx = (cac.selectedIdx + delta + cac.items.length) % cac.items.length;
  updateSpeakerSelected();
}

function acceptSpeakerAutoComplete() {
  if (!cac.popup) return;
  const ta = els.scriptArea;
  const text = ta.value;
  const item = cac.items[cac.selectedIdx];
  if (!item) { closeSpeakerAutoComplete(); return; }

  let insertion = "";
  if (cac.mode === "name") insertion = item.insert;
  else if (cac.mode === "position") insertion = `[${item.pos}]`;

  const before = text.slice(0, cac.start);
  const after = text.slice(cac.end);
  ta.value = before + insertion + after;
  state.script = ta.value;
  const newPos = cac.start + insertion.length;
  ta.focus();
  ta.setSelectionRange(newPos, newPos);

  const wasMode = cac.mode;
  closeSpeakerAutoComplete();
  reparseAndRender(false);
  setSaveIndicator("saving");
  if (typeof scriptSaveTimer !== "undefined") {
    if (scriptSaveTimer) clearTimeout(scriptSaveTimer);
    scriptSaveTimer = setTimeout(saveToStorage, 500);
  }
  // After picking a name, immediately re-check if position picker would help (no auto-popup).
  if (wasMode === "name") {
    // do nothing — let user keep typing dialog
  }
}

function closeSpeakerAutoComplete() {
  if (cac.popup) { cac.popup.remove(); cac.popup = null; }
  cac.items = [];
  cac.selectedIdx = 0;
  cac.mode = null;
  cac.ctx = null;
}

function maybeShowSpeakerAutoComplete() {
  // Asset popup wins (more specific context)
  if (ac.popup) { closeSpeakerAutoComplete(); return; }
  // Don't reopen "name" while a "position" picker is showing — that's modal.
  if (cac.popup && cac.mode === "position") return;

  // === in-bracket detection (defined later in file; hoisted at runtime) ===
  if (typeof detectInBracketContext === "function") {
    const inb = detectInBracketContext();
    if (inb) {
      if (cac.mode === "name") closeSpeakerAutoComplete();
      if (inb.matchedChar) {
        showInBracketPicker(inb);
        return;
      }
      if (cac.mode === "in-bracket") closeSpeakerAutoComplete();
      return;
    }
    if (cac.mode === "in-bracket") closeSpeakerAutoComplete();
  }

  const ctx = detectSpeakerContext();
  if (!ctx || ctx.insideBracket) {
    if (cac.mode === "name") closeSpeakerAutoComplete();
    return;
  }
  // Only auto-show name suggestions when there's a name being typed AND no tags yet.
  if (!ctx.name.trim() || ctx.tagsRaw) {
    if (cac.mode === "name") closeSpeakerAutoComplete();
    return;
  }
  showSpeakerAutoComplete(ctx);
}

// Display-name override prompt (triggered by typing `?` at end of speaker portion).
async function promptDisplayName(ctx) {
  closeSpeakerAutoComplete();
  closeAssetAutoComplete();

  const name = await inlinePrompt({
    title: "顯示名稱",
    message: ctx.matchedChar
      ? `說話的是「${ctx.matchedChar.name}」，但對話框上要顯示成什麼？`
      : "對話框上要顯示成什麼？",
    placeholder: "例如：神秘人、戴著狐耳的維埃拉族男子",
  });
  if (!name) return;

  const ta = els.scriptArea;
  const text = ta.value;
  const insertion = `[?:${name}]`;
  const pos = ta.selectionStart;
  ta.value = text.slice(0, pos) + insertion + text.slice(pos);
  state.script = ta.value;
  const newPos = pos + insertion.length;
  ta.focus();
  ta.setSelectionRange(newPos, newPos);
  reparseAndRender(false);
  setSaveIndicator("saving");
  if (scriptSaveTimer) clearTimeout(scriptSaveTimer);
  scriptSaveTimer = setTimeout(saveToStorage, 500);
}

// Hook events
els.scriptArea.addEventListener("input", maybeShowSpeakerAutoComplete);
els.scriptArea.addEventListener("click", maybeShowSpeakerAutoComplete);
els.scriptArea.addEventListener("keyup", (e) => {
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(e.key)
      && !cac.popup && !ac.popup) {
    maybeShowSpeakerAutoComplete();
  }
});
els.scriptArea.addEventListener("blur", () => {
  setTimeout(closeSpeakerAutoComplete, 150);
});

// keydown — owns Tab / `?` / popup keys
els.scriptArea.addEventListener("keydown", (e) => {
  // Speaker popup keys
  if (cac.popup) {
    if (e.key === "ArrowDown") { e.preventDefault(); moveSpeakerAutoComplete(1); return; }
    if (e.key === "ArrowUp")   { e.preventDefault(); moveSpeakerAutoComplete(-1); return; }
    if (e.key === "Tab" || e.key === "Enter") {
      if (cac.items.length > 0) { e.preventDefault(); acceptSpeakerAutoComplete(); return; }
      closeSpeakerAutoComplete();
      return;
    }
    if (e.key === "Escape") { e.preventDefault(); closeSpeakerAutoComplete(); return; }
  }

  // Tab in speaker context (no popup) → position picker if name is recognized
  if (e.key === "Tab" && !e.shiftKey && !ac.popup && !cac.popup && !_pendingAliasPrompt) {
    const ctx = detectSpeakerContext();
    if (ctx && !ctx.insideBracket && ctx.matchedChar && !ctx.hasPosition) {
      e.preventDefault();
      showPositionPicker(ctx);
      return;
    }
    // Position already set, no alias yet → alias / [?] picker (final step, adds `：`)
    if (ctx && !ctx.insideBracket && ctx.matchedChar && ctx.hasPosition && !ctx.hasNameOverride) {
      const hasLongAlias = ctx.tags.some(t =>
        !POS_TAGS_SET.has(t) && !isHideTag(t) && t.length >= ALIAS_BRACKET_THRESHOLD);
      if (!hasLongAlias) {
        e.preventDefault();
        showAliasHidePicker(ctx);
        return;
      }
    }
  }

  // `?` in speaker context → display-name prompt
  // Fires only when the cursor is outside brackets AND on a line whose name
  // matches a known character. Inside `[...]` we let `?` through so users
  // can still type `[?]` or `[?:某人]` manually.
  if ((e.key === "?" || e.key === "？") && !ac.popup && !cac.popup) {
    const ctx = detectSpeakerContext();
    if (ctx && !ctx.insideBracket && ctx.matchedChar) {
      e.preventDefault();
      promptDisplayName(ctx);
      return;
    }
  }
});

window.addEventListener("scroll", () => { if (cac.popup) positionSpeakerPopup(); }, true);
window.addEventListener("resize", () => { if (cac.popup) positionSpeakerPopup(); });

// ============================================================
//  In-bracket Autocomplete (after speaker name)
// ============================================================
// Triggered when caret is INSIDE an open `[` on a speaker line. Suggests
// emotion (if not yet specified), then position (左/中/右), then a hint
// about typing a long descriptive alias.

// Detect "we are inside an open `[` on a speaker line".
function detectInBracketContext() {
  const ta = els.scriptArea;
  const pos = ta.selectionStart || 0;
  const text = ta.value;
  const lineStart = text.lastIndexOf("\n", pos - 1) + 1;
  const beforeCursor = text.slice(lineStart, pos);

  // skip non-speaker lines
  if (/^\s*\[(bg|cg|選項|choices?|離場|無人|退場)/i.test(beforeCursor)) return null;
  if (/^\s*[-－]/.test(beforeCursor)) return null;
  if (/^\s*(\/\/|#)/.test(beforeCursor)) return null;
  if (/[:：]/.test(beforeCursor)) return null;

  // find latest unclosed `[` before cursor
  let depth = 0, openIdx = -1;
  for (let i = beforeCursor.length - 1; i >= 0; i--) {
    const ch = beforeCursor[i];
    if (ch === "]") depth++;
    else if (ch === "[") {
      if (depth === 0) { openIdx = i; break; }
      depth--;
    }
  }
  if (openIdx < 0) return null;

  // head = everything before the open bracket
  const head = beforeCursor.slice(0, openIdx);
  const headMatch = head.match(/^(\s*)([^\[:：\n]*?)((?:\[[^\]]*\])*)\s*$/);
  if (!headMatch) return null;
  const indent = headMatch[1];
  const name = headMatch[2].trim();
  if (!name) return null;
  const completedTagsRaw = headMatch[3];
  const completedTags = [...completedTagsRaw.matchAll(/\[([^\]]*)\]/g)].map(t => t[1].trim());

  const matchedChar = state.characters.find(c => c.name === name) || null;
  const knownEmotions = (matchedChar && matchedChar.emotions) || [];

  const isPos = (t) => POS_TAGS_SET.has(t);
  const isHide = (t) => isHideTag(t);
  const isAlias = (t) => isHide(t) || t.length >= ALIAS_BRACKET_THRESHOLD;
  const isEmoTag = (t) => !isPos(t) && !isHide(t) &&
    (knownEmotions.includes(t) || t.length < ALIAS_BRACKET_THRESHOLD);

  const hasPosition = completedTags.some(isPos);
  const hasAlias = completedTags.some(isAlias);
  const hasEmotion = completedTags.some(isEmoTag);

  // The query the user has typed inside the current open bracket
  const query = beforeCursor.slice(openIdx + 1);

  // Determine the "next slot" we offer
  let slot;
  if (!hasEmotion) slot = "emotion";
  else if (!hasPosition) slot = "position";
  else slot = "alias";

  // `?` / `？` is a reserved hide-name marker — override the slot so the picker
  // can offer `[?]` (hide → ???) and `[?:某人]` (display alias) instead of
  // pretending the user is typing an emotion called "?".
  if (/^[?？]/.test(query)) slot = "hide";

  return {
    name, matchedChar, indent,
    completedTags, hasEmotion, hasPosition, hasAlias,
    bracketStart: lineStart + openIdx,
    queryStart: lineStart + openIdx + 1,
    queryEnd: pos,
    query,
    slot,
  };
}

function suggestInBracketItems(ctx) {
  const q = (ctx.query || "").trim();
  const qLower = q.toLowerCase();

  if (ctx.slot === "emotion") {
    const emotions = (ctx.matchedChar && ctx.matchedChar.emotions) || [];
    const items = [];
    for (const e of emotions) {
      const lower = e.toLowerCase();
      let score = -1;
      if (!q) score = 0;
      else if (lower === qLower || e === q) score = 0;
      else if (lower.startsWith(qLower) || e.startsWith(q)) score = 1;
      else if (lower.includes(qLower) || e.includes(q)) score = 2;
      if (score >= 0) items.push({ kind: "emotion", label: e, insert: e, score });
    }
    items.sort((a, b) => a.score - b.score);

    // When the typed query doesn't match any defined emotion exactly, surface
    // a one-keystroke "use as alias" conversion so the user no longer has to
    // remember the `[?:...]` syntax or the 8-char threshold rule. The plain
    // "use as new emotion" option just confirms the current text and closes.
    const exactMatch = emotions.some(e => e === q || e.toLowerCase() === qLower);
    if (q && !exactMatch && !ctx.hasAlias) {
      items.push({
        kind: "emotion-new",
        label: `用作新表情「${q}」`,
        insert: q,
        score: 90,
      });
      items.push({
        kind: "alias-convert",
        label: `用作別名顯示「${q}」(轉成 [?:${q}])`,
        insert: `?:${q}`,
        score: 91,
      });
    }
    return items;
  }
  if (ctx.slot === "position") {
    return ["左", "中", "右"]
      .filter(p => !q || p.includes(q))
      .map(p => ({ kind: "position", label: `[${p}]`, insert: p, score: 0 }));
  }
  if (ctx.slot === "hide") {
    // already in alias-input mode (`?:` / `？：` typed) — no picks, just let user type
    if (/^[?？][:：]/.test(q)) return [];
    return [
      { kind: "hide", label: "[?] 隱藏真名 (顯示 ???)", insert: "?", score: 0 },
      { kind: "hide", label: "[?:別名] 顯示替代名…", insert: "?:", keepInside: true, score: 1 },
    ];
  }
  // alias slot — offer hint as single non-acceptable item
  return [];
}

function showInBracketPicker(ctx) {
  closeAssetAutoComplete();
  closeSpeakerAutoComplete();

  const items = suggestInBracketItems(ctx);
  cac.mode = "in-bracket";
  cac.ctx = ctx;
  cac.start = ctx.queryStart;
  cac.end = ctx.queryEnd;
  cac.items = items;
  cac.selectedIdx = 0;

  const popup = document.createElement("div");
  popup.className = "asset-ac-popup";
  cac.popup = popup;

  const header = document.createElement("div");
  header.className = "asset-ac-header";
  const slotLabels = { emotion: "表情", position: "位置", alias: "別名", hide: "隱藏真名" };
  header.innerHTML = `提示 · <strong>${slotLabels[ctx.slot]}</strong> · 「${escapeHtml(ctx.name)}」`;
  popup.appendChild(header);

  if (ctx.slot === "alias") {
    const empty = document.createElement("div");
    empty.className = "asset-ac-empty";
    empty.innerHTML = `輸入要顯示的替代名後按 <kbd>]</kbd> 結束<br>` +
      `<small style="color:var(--text-faint)">這格的內容會取代真名顯示在對話框上</small>`;
    popup.appendChild(empty);
  } else if (ctx.slot === "hide" && items.length === 0) {
    // alias-input mode: user has typed `?:` and is filling the display name
    const empty = document.createElement("div");
    empty.className = "asset-ac-empty";
    empty.innerHTML = `輸入替代名後按 <kbd>]</kbd> 結束<br>` +
      `<small style="color:var(--text-faint)">例如 <code>?:神秘人</code> → 對話框顯示「神秘人」</small>`;
    popup.appendChild(empty);
  } else if (items.length === 0) {
    const empty = document.createElement("div");
    empty.className = "asset-ac-empty";
    if (ctx.slot === "emotion") {
      if (!ctx.matchedChar) {
        empty.innerHTML = `「${escapeHtml(ctx.name)}」尚未在角色清單中,<br>請先到「👥 角色」分頁新增`;
      } else if ((ctx.matchedChar.emotions || []).length === 0) {
        empty.innerHTML = `「${escapeHtml(ctx.name)}」尚未定義任何表情<br>可在角色設定加 +表情`;
      } else {
        empty.innerHTML = `沒有符合「${escapeHtml(ctx.query)}」的表情`;
      }
    } else {
      empty.innerHTML = `沒有符合「${escapeHtml(ctx.query)}」的位置`;
    }
    popup.appendChild(empty);
  } else {
    items.forEach((it, idx) => {
      const el = document.createElement("div");
      el.className = "asset-ac-item" + (idx === 0 ? " selected" : "");
      el.dataset.idx = idx;
      const icon = it.kind === "position"
        ? (it.insert === "左" ? "◀" : it.insert === "右" ? "▶" : "●")
        : (it.kind === "hide" || it.kind === "alias-convert") ? "❔"
        : it.kind === "emotion-new" ? "✚"
        : "✦";
      const labelHtml = ctx.slot === "emotion"
        ? highlightMatch(it.label, ctx.query)
        : escapeHtml(it.label);
      el.innerHTML = `<span class="asset-ac-icon">${icon}</span><span>${labelHtml}</span>`;
      el.addEventListener("mouseenter", () => { cac.selectedIdx = idx; updateSpeakerSelected(); });
      el.addEventListener("mousedown", (ev) => {
        ev.preventDefault();
        cac.selectedIdx = idx;
        acceptInBracketItem();
      });
      popup.appendChild(el);
    });

    const hint = document.createElement("div");
    hint.className = "asset-ac-hint";
    hint.innerHTML = "<span><kbd>↑↓</kbd> 選</span><span><kbd>Tab</kbd>/<kbd>Enter</kbd> 補全</span><span><kbd>Esc</kbd> 關閉</span>";
    popup.appendChild(hint);
  }

  document.body.appendChild(popup);
  positionSpeakerPopup();
  requestAnimationFrame(positionSpeakerPopup);
}

function acceptInBracketItem() {
  if (!cac.popup || cac.items.length === 0) return;
  const it = cac.items[cac.selectedIdx];
  if (!it) return;
  const ta = els.scriptArea;
  const text = ta.value;
  const insertion = it.insert;  // raw value like "微笑" or "左" — closing `]` already there
  const before = text.slice(0, cac.start);
  const after = text.slice(cac.end);
  ta.value = before + insertion + after;
  state.script = ta.value;
  // Move past the closing `]` (the next char) so user can continue typing the next bracket
  // — unless `keepInside` was set (e.g. `?:` waits for the user to type the alias).
  let newPos = cac.start + insertion.length;
  if (!it.keepInside && text[cac.end] === "]") newPos += 1;
  ta.focus();
  ta.setSelectionRange(newPos, newPos);
  closeSpeakerAutoComplete();
  reparseAndRender(false);
  setSaveIndicator("saving");
  if (typeof scriptSaveTimer !== "undefined") {
    if (scriptSaveTimer) clearTimeout(scriptSaveTimer);
    scriptSaveTimer = setTimeout(saveToStorage, 500);
  }
  // immediately try to show next slot — important for `keepInside` items
  // (e.g. accepting `?:` should re-open the popup so the alias hint appears).
  setTimeout(() => { maybeShowSpeakerAutoComplete(); }, 0);
}

// In-bracket popup keys (Tab/Enter accepts)
els.scriptArea.addEventListener("keydown", (e) => {
  if (cac.popup && cac.mode === "in-bracket") {
    if (e.key === "ArrowDown") { e.preventDefault(); moveSpeakerAutoComplete(1); return; }
    if (e.key === "ArrowUp")   { e.preventDefault(); moveSpeakerAutoComplete(-1); return; }
    if (e.key === "Tab" || e.key === "Enter") {
      if (cac.items.length > 0) { e.preventDefault(); acceptInBracketItem(); return; }
      closeSpeakerAutoComplete();
      return;
    }
    if (e.key === "Escape") { e.preventDefault(); closeSpeakerAutoComplete(); return; }
  }
}, true);  // capture so we run before the existing speaker handler

// ============================================================
//  Tab focus guard — Tab inside the script area should never move focus
//  away to other UI controls. Specific handlers above (popup picks, position
//  picker) already preventDefault when they handle; this catches the
//  remaining cases (empty line, comment line, no popup, etc.).
// ============================================================
els.scriptArea.addEventListener("keydown", (e) => {
  if (e.key === "Tab" && !e.ctrlKey && !e.metaKey && !e.altKey) {
    e.preventDefault();
  }
});

// ============================================================
//  Auto-pair `[` and smart `]` skip
// ============================================================
els.scriptArea.addEventListener("keydown", (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  // ignore when popup is owning the keys
  if ((ac.popup || cac.popup) && (e.key === "[" || e.key === "]")) return;

  const ta = els.scriptArea;

  // Auto-pair `[` — only on speaker lines (not in command/comment lines)
  if (e.key === "[") {
    const pos = ta.selectionStart;
    const sel = ta.selectionEnd;
    if (pos !== sel) return;  // user has selection; let default
    const next = ta.value[pos] || "";
    // only pair if next char is whitespace, end-of-line/string, `]`, or `[`
    if (next && next !== " " && next !== "\t" && next !== "\n" && next !== "]" && next !== "[") return;
    // skip on command lines
    const lineStart = ta.value.lastIndexOf("\n", pos - 1) + 1;
    const lineSoFar = ta.value.slice(lineStart, pos);
    if (/^\s*\[(bg|cg|選項|choices?|離場|無人|退場)/i.test(lineSoFar)) return;
    if (/^\s*(\/\/|#)/.test(lineSoFar)) return;

    e.preventDefault();
    const before = ta.value.slice(0, pos);
    const after = ta.value.slice(pos);
    ta.value = before + "[]" + after;
    state.script = ta.value;
    ta.setSelectionRange(pos + 1, pos + 1);
    reparseAndRender(false);
    setSaveIndicator("saving");
    if (typeof scriptSaveTimer !== "undefined") {
      if (scriptSaveTimer) clearTimeout(scriptSaveTimer);
      scriptSaveTimer = setTimeout(saveToStorage, 500);
    }
    // open the in-bracket picker
    setTimeout(() => maybeShowSpeakerAutoComplete(), 0);
    return;
  }

  // Smart `]` skip — when next char is `]`, just step over it
  if (e.key === "]") {
    const pos = ta.selectionStart;
    const sel = ta.selectionEnd;
    if (pos !== sel) return;
    if (ta.value[pos] !== "]") return;
    e.preventDefault();
    ta.setSelectionRange(pos + 1, pos + 1);
    closeSpeakerAutoComplete();
  }
});

// ============================================================
//  Tab on empty line → continue with last speaker
// ============================================================
els.scriptArea.addEventListener("keydown", (e) => {
  if (e.key !== "Tab" || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return;
  if (ac.popup || cac.popup) return;  // popup owns Tab
  const ta = els.scriptArea;
  const pos = ta.selectionStart;
  const sel = ta.selectionEnd;
  if (pos !== sel) return;
  const text = ta.value;
  const lineStart = text.lastIndexOf("\n", pos - 1) + 1;
  const lineEnd = (() => { const i = text.indexOf("\n", pos); return i < 0 ? text.length : i; })();
  const lineContent = text.slice(lineStart, lineEnd);
  if (lineContent.trim() !== "") return;  // not an empty line

  // walk backwards to find the last speaker name in script
  const before = text.slice(0, lineStart);
  const lines = before.split("\n");
  let lastName = null;
  for (let i = lines.length - 1; i >= 0; i--) {
    const m = lines[i].match(/^(\s*)([^\[:：\n]{1,24})(?:\[[^\]]*\])*\s*[:：]/);
    if (m) {
      const candidate = m[2].trim();
      // require it to match a known character (avoid odd matches like "嗯" being treated as a name)
      if (candidate && state.characters.some(c => c.name === candidate)) {
        lastName = candidate;
        break;
      }
    }
  }
  if (!lastName) return;

  e.preventDefault();
  const insertion = lastName + "：";
  ta.value = text.slice(0, pos) + insertion + text.slice(sel);
  state.script = ta.value;
  const newPos = pos + insertion.length;
  ta.setSelectionRange(newPos, newPos);
  reparseAndRender(false);
  setSaveIndicator("saving");
  if (typeof scriptSaveTimer !== "undefined") {
    if (scriptSaveTimer) clearTimeout(scriptSaveTimer);
    scriptSaveTimer = setTimeout(saveToStorage, 500);
  }
});
