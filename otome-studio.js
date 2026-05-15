"use strict";

// ============================================================
//  Data Model
// ============================================================

const SAMPLE_SCRIPT = `[bg: 黃昏]
放學後的圖書館，夕陽透過窗戶灑進來。

（好安靜，正適合一個人發呆。）

學長[神秘][?:神秘人][右]：嗨，原來你也在這裡。
（這個聲音是？）
我：請問你是？
學長[微笑][右]：是我啊。
我：學⋯學長！

[bg: 教室]
學長[微笑][中]：要不要一起去買杯咖啡？

（怎麼辦，我該答應嗎？）

[選項]
- 好啊
- 改天吧
- * 我⋯我也喜歡你

我：我⋯我也喜歡你。

[cg: 告白]
這就是我們故事的開始。
[cg off]

學長[微笑][右]：以後也請多指教。

[離場]
（完）`;

const SAMPLE_CHARACTERS = [
  {
    id: "protagonist_default",
    name: "我",
    kind: "protagonist",
    color: "#d4869a",
    emotions: [],
    portraits: {}
  },
  {
    id: "senpai",
    name: "學長",
    kind: "supporting",
    color: "#c4a265",
    emotions: ["微笑", "認真", "溫柔", "驚訝", "神秘"],
    portraits: {} // emotion -> dataUrl, empty = use placeholder
  },
  {
    id: "classmate",
    name: "同學",
    kind: "supporting",
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

// Per-line font presets ([字體: 名稱] tag). stack=null → fall back to default.
const FONT_PRESETS = [
  { id: "default",    name: "標準",   stack: null },
  { id: "handwrite",  name: "手寫",   stack: '"Caveat", "Ma Shan Zheng", cursive' },
  { id: "typewriter", name: "打字機", stack: '"Special Elite", "JetBrains Mono", monospace' },
  { id: "classical",  name: "古典",   stack: '"Cormorant Garamond", "Noto Serif TC", serif' },
  { id: "round",      name: "圓體",   stack: '"Nunito", "PingFang TC", sans-serif' },
  { id: "bold",       name: "黑體",   stack: '"Noto Sans TC", "PingFang TC", sans-serif' },
  { id: "brush",      name: "毛筆",   stack: '"Ma Shan Zheng", "Liu Jian Mao Cao", cursive' },
  { id: "gothic",     name: "哥德",   stack: '"UnifrakturCook", "Cinzel", serif' },
];
const FONT_BY_NAME = Object.fromEntries(FONT_PRESETS.map(f => [f.name, f]));
const FONT_BY_ID = Object.fromEntries(FONT_PRESETS.map(f => [f.id, f]));

const DEFAULT_DIALOG_STYLE = { shape: "classic", color: "#0d0716", opacity: 0.88 };

const DIALOG_SHAPES = [
  { id: "classic",   name: "經典金邊", desc: "直角金邊矩形" },
  { id: "soft",      name: "柔和圓角", desc: "大圓角、無邊框" },
  { id: "bubble",    name: "彈出泡泡", desc: "圓潤、含小尖角" },
  { id: "parchment", name: "羊皮紙",   desc: "紙質、不規則邊緣" },
  { id: "minimal",   name: "極簡無框", desc: "無框、底部漸層" },
  { id: "window",    name: "雙線窗格", desc: "上下雙線" },
];

function migrateDialogStyle(s) {
  return { ...DEFAULT_DIALOG_STYLE, ...(s || {}) };
}

const LIGHT_MODES = ["聚光", "同亮", "全暗"];
const DEFAULT_LIGHT_MODE = "聚光";

const DEFAULT_GAME_UI = {
  chapter:  { enabled: false, text: "第一章 — 序幕" },
  date:     { enabled: false, text: "Day 1 · 黃昏" },
  love:     { enabled: false, charId: null, value: 50 },
  autoSkip: { enabled: false },
};
function migrateGameUI(g) {
  const out = JSON.parse(JSON.stringify(DEFAULT_GAME_UI));
  for (const k of Object.keys(DEFAULT_GAME_UI)) {
    out[k] = { ...DEFAULT_GAME_UI[k], ...((g && g[k]) || {}) };
  }
  return out;
}

// Older saves have no `kind` — default to supporting.
function migrateCharacter(ch) {
  const c = { emotions: [], portraits: {}, ...ch };
  if (c.kind !== "protagonist" && c.kind !== "supporting") c.kind = "supporting";
  return c;
}
function ensureProtagonistExists() {
  if (!state.characters.some(c => c.kind === "protagonist")) {
    state.characters.unshift({
      id: "protagonist_default",
      name: "我",
      kind: "protagonist",
      color: "#d4869a",
      emotions: [],
      portraits: {},
    });
  }
}

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
  gameUI: JSON.parse(JSON.stringify(DEFAULT_GAME_UI)),
  lightMode: DEFAULT_LIGHT_MODE,   // 全域目前模式
  // live stage state
  stage: {
    bg: "default",
    slots: { 左: null, 中: null, 右: null },
    cg: null,         // { name, hideDialog } or null
    lightMode: DEFAULT_LIGHT_MODE, // 舞台當前生效模式（會被劇本指令改變）
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
const CMD_CG_RE = /^\[cg\s*(full|solo)?\s*:\s*(.+?)\]$/i;
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
    const variant = (cgMatch[1] || "").toLowerCase();
    return {
      type: "cg",
      idx, raw,
      cgName: cgMatch[2].trim(),
      hideDialog: variant === "full",                       // 只有 full 隱藏對話框
      hideGameUI: variant === "full" || variant === "solo", // solo / full 皆隱藏假 UI
    };
  }

  // light mode command
  const lightMatch = line.match(/^\[(聚光|同亮|全暗)\]$/);
  if (lightMatch) {
    return { type: "light", idx, raw, mode: lightMatch[1] };
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
    let fontId = null;
    // Look up speaker's known emotions so we can disambiguate brackets.
    const ch = (typeof state !== "undefined" && state.characters)
      ? state.characters.find(c => c.name === name)
      : null;
    const knownEmotions = ch && Array.isArray(ch.emotions) ? ch.emotions : null;
    for (const t of tags) {
      if (POS_TAGS.includes(t)) {
        position = t;
      } else if (/^字體\s*[:：]/.test(t)) {
        // [字體: 手寫] — per-line font override
        const fontName = t.replace(/^字體\s*[:：]\s*/, "").trim();
        fontId = (FONT_BY_NAME[fontName] && FONT_BY_NAME[fontName].id) || null;
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
      fontId,
      isProtagonist: !!(ch && ch.kind === "protagonist"),
    };
  }

  // choice item (`- text` or `- * text`)
  const ci = line.match(CHOICE_ITEM_RE);
  if (ci) return { type: "choice_item", idx, raw, isFinal: ci[1] === "*", text: ci[2].trim() };

  // narration — inner monologue wrapped in full/half-width parens auto-strips them
  const innerMatch = line.match(/^[（(]([^）)]*)[）)]$/);
  const narrationText = innerMatch ? innerMatch[1].trim() : line;
  return { type: "narration", idx, raw, text: narrationText };
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

// Third pass: merge scene commands (bg / cg / cg_off / exit) into the
// `sceneOps` array of the FIRST following content node (dialog / narration /
// choices), so they no longer cost a separate "empty" click. If there is no
// following content node (trailing scene commands at end of script), keep them
// as one stand-alone "scene_only" terminal beat so the preview can still show
// the final stage state.
const SCENE_CMD_TYPES = new Set(["bg", "cg", "cg_off", "exit", "light"]);
const CONTENT_TYPES = new Set(["dialog", "narration", "choices"]);

function collapseSceneCommands(lines) {
  const out = [];
  let pending = [];
  for (const ln of lines) {
    if (SCENE_CMD_TYPES.has(ln.type)) {
      pending.push(ln);
      continue;
    }
    if (CONTENT_TYPES.has(ln.type)) {
      if (pending.length > 0) {
        ln.sceneOps = pending;
        pending = [];
      }
      out.push(ln);
      continue;
    }
    out.push(ln);
  }
  if (pending.length > 0) {
    out.push({
      type: "scene_only",
      idx: pending[0].idx,
      raw: pending.map(p => p.raw).join("\n"),
      sceneOps: pending,
    });
  }
  return out;
}

function parseScript(text) {
  const raw = text.split("\n").map(parseLine).filter(l => l.type !== "blank");
  const collapsed = collapseChoices(raw);
  return collapseSceneCommands(collapsed);
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
  state.stage = { bg: "default", slots: { 左: null, 中: null, 右: null }, cg: null, lightMode: state.lightMode || DEFAULT_LIGHT_MODE };
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
  const lightMode = state.stage.lightMode || state.lightMode || DEFAULT_LIGHT_MODE;
  for (const pos of POS_TAGS) {
    const slot = document.createElement("div");
    slot.className = "char-slot";
    slot.dataset.pos = pos;

    const occupant = state.stage.slots[pos];
    if (occupant) {
      const ch = state.characters.find(c => c.id === occupant.charId);
      if (ch) {
        const isActiveChar = activeCharId === ch.id;
        let isDimmed = false;
        if (lightMode === "聚光") isDimmed = !isActiveChar;
        else if (lightMode === "全暗") isDimmed = true;
        // 同亮 → 全部不 dim
        const fig = document.createElement("div");
        fig.className = "char-figure"
          + (isDimmed ? " dimmed" : "")
          + (!isDimmed && isActiveChar ? " active" : "");

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

function applyDialogFont(fontId) {
  const el = els.dialogText;
  if (!el) return;
  const font = FONT_BY_ID[fontId];
  el.style.fontFamily = (font && font.stack) ? font.stack : "";
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
    applyDialogFont(null);
    typewrite(line.text);
  } else if (line.type === "dialog") {
    const ch = findCharacter(line.speaker);
    els.dialogSpeaker.style.display = "inline-block";

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
    applyDialogFont(line.fontId);
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
    els.stage.classList.remove("cg-active", "cg-hide-dialog", "cg-hide-ui");
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
  els.stage.classList.toggle("cg-hide-ui", !!cg.hideGameUI);
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
    // editor-only ★ marker on the correct answer — never while recording,
    // so the marker can't leak into exported video / screenshots.
    if (item.isFinal && !recState.active) {
      const star = document.createElement("span");
      star.className = "choice-star";
      star.setAttribute("aria-hidden", "true");
      star.textContent = "★";
      el.appendChild(star);
    }
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
  const total = state.parsed.filter(isVisibleType).length;
  const current = state.parsed.slice(0, state.currentIndex + 1).filter(isVisibleType).length;
  els.dialogProgress.textContent = total > 0 ? `${String(current).padStart(2, "0")} / ${String(total).padStart(2, "0")}` : "";
}

function renderLineCount() {
  const visible = state.parsed.filter(isVisibleType).length;
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
  updatePreviewCounter();
}

// ----- Preview position counter + jump-to-beat -----
function updatePreviewCounter() {
  const cur = document.getElementById("previewCounterCurrent");
  const tot = document.getElementById("previewCounterTotal");
  if (!cur || !tot) return;
  const total = state.parsed.length;
  cur.textContent = total > 0 ? Math.min(state.currentIndex + 1, total) : 0;
  tot.textContent = total;
}

function jumpToBeat(idx) {
  if (state.parsed.length === 0) return;
  renderAt(Math.max(0, Math.min(idx, state.parsed.length - 1)));
}

// ============================================================
//  Navigation
// ============================================================

function isVisibleType(ln) {
  return ln.type === "dialog" || ln.type === "narration"
      || ln.type === "choices" || ln.type === "scene_only";
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
  syncSyntaxHighlight();
  applyGameUI();
}

// ----- Editor syntax highlight overlay (G1) -----
function _shEsc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function highlightScript(text) {
  return text.split("\n").map((line) => {
    // comment
    if (/^\s*(\/\/|#)/.test(line)) {
      return `<span class="sh-comment">${_shEsc(line)}</span>`;
    }
    // full command line
    if (/^\s*\[(bg|cg\s+off|cg\s+full|cg|離場|退場|無人|選項|choices?)/i.test(line)) {
      return `<span class="sh-cmd">${_shEsc(line)}</span>`;
    }
    // choice item: leading - / －, optional *
    const ci = line.match(/^(\s*[-－]\s*)(\*\s*)?(.*)$/);
    if (ci && ci[1]) {
      let out = `<span class="sh-choice-marker">${_shEsc(ci[1])}</span>`;
      if (ci[2]) out += `<span class="sh-choice-marker">${_shEsc(ci[2])}</span>`;
      return out + _shEsc(ci[3] || "");
    }
    // dialog: name + [tag]* + ：/: + text
    const m = line.match(/^([^:：\[\n]{1,24})((?:\[[^\]\n]+\])*)\s*([:：])\s*(.*)$/);
    if (m) {
      const tagsHtml = m[2].replace(/\[([^\]]+)\]/g,
        '<span class="sh-bracket">[</span><span class="sh-tag">$1</span><span class="sh-bracket">]</span>');
      return `<span class="sh-speaker">${_shEsc(m[1])}</span>${tagsHtml}` +
        `<span class="sh-colon">${_shEsc(m[3])}</span>${_shEsc(m[4])}`;
    }
    // narration / plain
    return _shEsc(line);
  }).join("\n");
}

const _shEl = document.getElementById("scriptHighlight");
function syncSyntaxHighlight() {
  if (!_shEl) return;
  // trailing newline keeps overlay height matched with the textarea's
  _shEl.innerHTML = highlightScript(els.scriptArea.value) + "\n";
  _shEl.scrollTop = els.scriptArea.scrollTop;
  _shEl.scrollLeft = els.scriptArea.scrollLeft;
}
els.scriptArea.addEventListener("scroll", () => {
  if (!_shEl) return;
  _shEl.scrollTop = els.scriptArea.scrollTop;
  _shEl.scrollLeft = els.scriptArea.scrollLeft;
});

function setScript(text) {
  state.script = text;
  els.scriptArea.value = text;
  reparseAndRender(true);
}

const RATIO_KEY = "otome-ratio";
function setRatio(r) {
  if (r !== "16:9" && r !== "9:16") r = "16:9";
  state.ratio = r;
  els.stage.dataset.ratio = r;
  document.querySelectorAll(".ratio-toggle button").forEach(b => {
    b.classList.toggle("active", b.dataset.ratio === r);
  });
  try { localStorage.setItem(RATIO_KEY, r); } catch (e) {}
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
  cgsolo: `\n[cg solo: ]\n旁白文字…\n[cg off]\n`,
  cgfull: `\n[cg full: ]\n[cg off]\n`,
  choices: `\n[選項]\n- 選項一\n- 選項二\n- * 最終選擇（加 * 標記）\n`,
  light: `\n[聚光]\n`,
  unknown: `角色名[?]：他的聲音很陌生。\n`,
};

// Where (relative to inserted text end) the cursor should land for each snippet.
// negative = chars from end of insertion. null = stay at end.
const SNIPPET_CURSOR_OFFSET = {
  bg: -2,       // place inside `[bg: |]\n`
  cg: -("\n旁白文字…\n[cg off]\n".length + 1),  // inside `[cg: |]`
  cgsolo: -("\n旁白文字…\n[cg off]\n".length + 1),  // inside `[cg solo: |]`
  cgfull: -("\n[cg off]\n".length + 1),  // inside `[cg full: |]`
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
  if (snippetKey === "bg" || snippetKey === "cg" || snippetKey === "cgsolo" || snippetKey === "cgfull") {
    setTimeout(() => window.ScriptEditor && window.ScriptEditor.refresh(), 0);
  }
}

document.querySelectorAll(".snippet-btn").forEach(b => {
  b.addEventListener("click", () => insertSnippet(b.dataset.snippet));
});

// CG variant dropdown
const cgMoreBtn = document.getElementById("cgMoreBtn");
const cgMenu = document.getElementById("cgMenu");
if (cgMoreBtn && cgMenu) {
  cgMoreBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    cgMenu.toggleAttribute("hidden");
  });
  cgMenu.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", () => {
      insertSnippet(btn.dataset.snippet);
      cgMenu.setAttribute("hidden", "");
    });
  });
  document.addEventListener("click", (e) => {
    if (!cgMenu.contains(e.target) && e.target !== cgMoreBtn) {
      cgMenu.setAttribute("hidden", "");
    }
  });
}

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

// First-time "click to continue" hint (shown once, then remembered)
const HINT_SHOWN_KEY = "otome-stage-hint-shown";
if (!localStorage.getItem(HINT_SHOWN_KEY)) {
  const hint = document.getElementById("stageHint");
  if (hint) {
    hint.removeAttribute("hidden");
    setTimeout(() => hint.remove(), 3500);
    els.stage.addEventListener("click", () => {
      localStorage.setItem(HINT_SHOWN_KEY, "1");
    }, { once: true });
  }
}

// Counter → slider popup to jump to any beat
let _jumpPopupCloser = null;
function closeJumpPopup() {
  const p = document.getElementById("previewJumpPopup");
  if (p) p.remove();
  if (_jumpPopupCloser) {
    els.stage.removeEventListener("click", _jumpPopupCloser);
    _jumpPopupCloser = null;
  }
}
document.getElementById("previewCounter").addEventListener("click", (e) => {
  e.stopPropagation();
  if (document.getElementById("previewJumpPopup")) { closeJumpPopup(); return; }
  if (state.parsed.length === 0) return;
  const stage = els.stage;
  const popup = document.createElement("div");
  popup.id = "previewJumpPopup";
  popup.className = "preview-jump-popup";
  popup.innerHTML =
    `<div class="jump-label">跳到第 <strong id="jumpVal">1</strong> 拍 / <span id="jumpMax">1</span></div>` +
    `<input type="range" id="jumpRange" min="1" value="1">`;
  popup.addEventListener("click", (ev) => ev.stopPropagation());
  stage.appendChild(popup);
  const range = popup.querySelector("#jumpRange");
  range.max = state.parsed.length;
  range.value = state.currentIndex + 1;
  popup.querySelector("#jumpMax").textContent = state.parsed.length;
  popup.querySelector("#jumpVal").textContent = state.currentIndex + 1;
  range.addEventListener("input", (ev) => {
    popup.querySelector("#jumpVal").textContent = ev.target.value;
    jumpToBeat(parseInt(ev.target.value, 10) - 1);
  });
  // click anywhere else on the stage closes the popup
  setTimeout(() => {
    _jumpPopupCloser = (ev) => {
      if (!popup.contains(ev.target) && ev.target.id !== "previewCounter") closeJumpPopup();
    };
    stage.addEventListener("click", _jumpPopupCloser);
  }, 0);
});

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
  } else if (e.key === "Escape") {
    // if the choices overlay is showing, dismiss it
    const overlay = document.getElementById("choicesOverlay");
    if (overlay && overlay.classList.contains("show")) {
      e.preventDefault();
      overlay.classList.remove("show");
    }
  }
});

document.querySelectorAll(".ratio-toggle button").forEach(b => {
  b.addEventListener("click", () => setRatio(b.dataset.ratio));
});

// ----- Reset actions: split into script-only / style-only / full -----
document.getElementById("btnResetScript").addEventListener("click", async () => {
  const ok = await inlineConfirm({
    title: "只重設劇本",
    message: "確定要清空劇本？角色、背景、CG、樣式都會保留。此動作不可復原。",
    okText: "清空劇本",
    danger: true,
  });
  if (!ok) return;
  setScript("");
  saveToStorage();
  showToast("✨ 劇本已清空", "success");
});

document.getElementById("btnResetStyle").addEventListener("click", async () => {
  const ok = await inlineConfirm({
    title: "只重設樣式",
    message: "確定要把對話框樣式回到預設？此動作不可復原。",
    okText: "重設樣式",
    danger: true,
  });
  if (!ok) return;
  state.dialogStyle = { ...DEFAULT_DIALOG_STYLE };
  applyDialogStyle();
  if (typeof renderStyleTab === "function") renderStyleTab();
  saveToStorage();
  showToast("✨ 對話框樣式已重設", "success");
});

document.getElementById("btnReset").addEventListener("click", async () => {
  const ok = await inlineConfirm({
    title: "⚠ 全部重設",
    message: "劇本、角色、背景、CG、樣式都會回到預設。此動作不可復原。",
    okText: "全部重設",
    danger: true,
  });
  if (!ok) return;
  localStorage.removeItem(STORAGE_KEY);
  location.reload();
});

const SHARE_PREFIX = "otome-studio:v1:";

// 匯出分享字串 — base64 編碼後複製到剪貼簿
document.getElementById("btnExportClip").addEventListener("click", async () => {
  try {
    const json = JSON.stringify(buildExportPayload());
    const sizeBytes = new Blob([json]).size;
    if (sizeBytes > 200 * 1024) {
      const proceed = await inlineConfirm({
        title: "資料量較大",
        message: `專案約 ${(sizeBytes / 1024).toFixed(0)} KB,分享字串會很長且可能貼不進部分聊天軟體。仍要複製嗎?\n（取消則改用檔案下載）`,
        okText: "仍要複製",
        cancelText: "改用檔案下載",
      });
      if (!proceed) { document.getElementById("btnShare").click(); return; }
    }
    const b64 = btoa(unescape(encodeURIComponent(json)));
    const payload = SHARE_PREFIX + b64;
    try {
      await navigator.clipboard.writeText(payload);
      showToast("📋 分享字串已複製,貼給朋友從「匯入」即可", "success", 3500);
    } catch (e) {
      // clipboard blocked → fall back to a manual-copy prompt
      await inlinePrompt({
        title: "複製分享字串",
        message: "自動複製失敗,請手動全選複製以下字串：",
        defaultValue: payload,
      });
    }
  } catch (e) {
    console.error(e);
    showToast("產生分享字串失敗:" + e.message, "warn", 4000);
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
      gameUI: state.gameUI,
      lightMode: state.lightMode,
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
  el.classList.remove("saving", "saved", "error", "dirty");
  el.classList.add(state);
  const text = el.querySelector(".save-text");
  if (state === "dirty") {
    if (text) text.textContent = "未儲存";
  } else if (state === "saving") {
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
    if (Array.isArray(payload.characters)) {
      state.characters = payload.characters.map(migrateCharacter);
      ensureProtagonistExists();
    }
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
      state.dialogStyle = migrateDialogStyle({
        shape: typeof payload.dialogStyle.shape === "string" ? payload.dialogStyle.shape : DEFAULT_DIALOG_STYLE.shape,
        color: typeof payload.dialogStyle.color === "string" ? payload.dialogStyle.color : DEFAULT_DIALOG_STYLE.color,
        opacity: typeof payload.dialogStyle.opacity === "number" ? payload.dialogStyle.opacity : DEFAULT_DIALOG_STYLE.opacity,
      });
    }
    state.gameUI = migrateGameUI(payload.gameUI);
    state.lightMode = LIGHT_MODES.includes(payload.lightMode) ? payload.lightMode : DEFAULT_LIGHT_MODE;
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

  // topbar dot — only surfaces once usage crosses 50% (otherwise hidden)
  const dot = document.getElementById("storageDot");
  if (dot) {
    dot.classList.remove("warn", "danger");
    const pct = used / (5 * 1024 * 1024);
    if (pct < 0.5) {
      dot.style.display = "none";
    } else {
      dot.style.display = "block";
      if (pct >= 0.8) dot.classList.add("danger");
      else dot.classList.add("warn");
    }
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

function showToast(msg, variant = "", duration = 2500) {
  const container = document.getElementById("toastContainer");
  if (!container) return;
  // keep at most 3 — drop the oldest still-visible one
  const live = container.querySelectorAll(".toast-item:not(.out)");
  if (live.length >= 3) live[0].remove();
  const item = document.createElement("div");
  item.className = "toast-item" + (variant ? " " + variant : "");
  item.textContent = msg;
  container.appendChild(item);
  setTimeout(() => {
    item.classList.add("out");
    setTimeout(() => item.remove(), 250);
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
  const titles = { chars: "角色 · 立繪", bgs: "場景 · 背景", cgs: "CG · 圖卡" };
  document.getElementById("modalTitle").textContent = titles[name] || "資產管理";
}

// ----- Dialog box style customization -----

function hexToRgb(hex) {
  const m = String(hex || "").match(/^#([0-9a-f]{6})$/i);
  if (!m) return { r: 13, g: 7, b: 22 };
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function applyGameUI() {
  const u = state.gameUI || DEFAULT_GAME_UI;
  const chap = document.getElementById("uiChapter");
  if (chap) {
    chap.hidden = !u.chapter.enabled || !u.chapter.text;
    chap.textContent = u.chapter.text || "";
  }
  const date = document.getElementById("uiDate");
  if (date) {
    date.hidden = !u.date.enabled || !u.date.text;
    date.textContent = u.date.text || "";
  }
  const love = document.getElementById("uiLove");
  const ch = state.characters.find(c => c.id === u.love.charId);
  if (love) {
    love.hidden = !u.love.enabled || !ch;
    if (ch) {
      const nm = document.getElementById("uiLoveName");
      const fill = document.getElementById("uiLoveFill");
      if (nm) nm.textContent = ch.name;
      if (fill) fill.style.width = u.love.value + "%";
    }
  }
  const as = document.getElementById("uiAutoSkip");
  if (as) as.hidden = !u.autoSkip.enabled;
}

function applyDialogStyle() {
  const { color, opacity } = state.dialogStyle;
  const dialogBox = document.getElementById("dialogBox");
  if (dialogBox) dialogBox.setAttribute("data-shape", state.dialogStyle.shape || "classic");
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
      state.dialogStyle = { ...state.dialogStyle, color: p.color, opacity: p.opacity };
      applyDialogStyle();
      saveToStorage();
      renderStyleTab();
    });
    presetsEl.appendChild(btn);
  }

  colorEl.value = state.dialogStyle.color;
  opEl.value = String(Math.round(state.dialogStyle.opacity * 100));
  opLabel.textContent = `${Math.round(state.dialogStyle.opacity * 100)}%`;

  renderShapeGrid();
  bindGameUISettings();
  renderLightModeButtons();
}

function renderLightModeButtons() {
  document.querySelectorAll(".light-mode-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.mode === state.lightMode);
    btn.onclick = () => {
      state.lightMode = btn.dataset.mode;
      state.stage.lightMode = btn.dataset.mode;
      reparseAndRender(false);
      saveToStorage();
      renderLightModeButtons();
    };
  });
}

function bindGameUISettings() {
  const u = state.gameUI;
  if (!u) return;

  const chapToggle = document.getElementById("uiChapterToggle");
  const chapText = document.getElementById("uiChapterText");
  if (chapToggle && chapText) {
    chapToggle.checked = u.chapter.enabled;
    chapText.value = u.chapter.text;
    chapToggle.onchange = () => { u.chapter.enabled = chapToggle.checked; applyGameUI(); saveToStorage(); };
    chapText.oninput = () => { u.chapter.text = chapText.value; applyGameUI(); saveToStorage(); };
  }

  const dateToggle = document.getElementById("uiDateToggle");
  const dateText = document.getElementById("uiDateText");
  if (dateToggle && dateText) {
    dateToggle.checked = u.date.enabled;
    dateText.value = u.date.text;
    dateToggle.onchange = () => { u.date.enabled = dateToggle.checked; applyGameUI(); saveToStorage(); };
    dateText.oninput = () => { u.date.text = dateText.value; applyGameUI(); saveToStorage(); };
  }

  const loveToggle = document.getElementById("uiLoveToggle");
  const loveSelect = document.getElementById("uiLoveCharSelect");
  const loveSlider = document.getElementById("uiLoveValue");
  const loveLabel = document.getElementById("uiLoveValueLabel");
  if (loveToggle && loveSelect && loveSlider && loveLabel) {
    loveSelect.innerHTML = state.characters.map(c =>
      `<option value="${c.id}" ${c.id === u.love.charId ? "selected" : ""}>${_shEsc(c.name)}</option>`
    ).join("");
    if (!u.love.charId && state.characters[0]) u.love.charId = state.characters[0].id;
    loveToggle.checked = u.love.enabled;
    loveSlider.value = u.love.value;
    loveLabel.textContent = u.love.value;
    loveToggle.onchange = () => { u.love.enabled = loveToggle.checked; applyGameUI(); saveToStorage(); };
    loveSelect.onchange = () => { u.love.charId = loveSelect.value; applyGameUI(); saveToStorage(); };
    loveSlider.oninput = () => {
      u.love.value = parseInt(loveSlider.value, 10);
      loveLabel.textContent = u.love.value;
      applyGameUI();
      saveToStorage();
    };
  }

  const asToggle = document.getElementById("uiAutoSkipToggle");
  if (asToggle) {
    asToggle.checked = u.autoSkip.enabled;
    asToggle.onchange = () => { u.autoSkip.enabled = asToggle.checked; applyGameUI(); saveToStorage(); };
  }
}

function renderShapeGrid() {
  const grid = document.getElementById("dialogShapeGrid");
  if (!grid) return;
  grid.innerHTML = "";
  DIALOG_SHAPES.forEach(s => {
    const card = document.createElement("button");
    card.className = "shape-card" + (s.id === state.dialogStyle.shape ? " active" : "");
    card.title = s.desc;
    card.innerHTML =
      `<div class="shape-preview" data-shape="${s.id}"></div>` +
      `<div class="shape-name">${s.name}</div>`;
    card.addEventListener("click", () => {
      state.dialogStyle.shape = s.id;
      applyDialogStyle();
      saveToStorage();
      renderShapeGrid();
    });
    grid.appendChild(card);
  });
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

// Close any open card menu when clicking outside one (registered once).
document.addEventListener("click", () => {
  document.querySelectorAll(".card-menu").forEach(m => { m.hidden = true; });
});

// Build a "⋯" dropdown menu. items: [{label, danger?, sep?, onClick}]
function buildCardMenu(items) {
  const wrap = document.createElement("div");
  wrap.className = "card-menu-wrap";
  const btn = document.createElement("button");
  btn.className = "card-menu-btn";
  btn.textContent = "⋯";
  btn.title = "更多";
  const menu = document.createElement("div");
  menu.className = "card-menu";
  menu.hidden = true;
  for (const it of items) {
    if (it.sep) {
      const s = document.createElement("div");
      s.className = "card-menu-sep";
      menu.appendChild(s);
      continue;
    }
    const b = document.createElement("button");
    b.className = "card-menu-item" + (it.danger ? " danger" : "");
    b.textContent = it.label;
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      menu.hidden = true;
      it.onClick();
    });
    menu.appendChild(b);
  }
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const wasHidden = menu.hidden;
    document.querySelectorAll(".card-menu").forEach(m => { m.hidden = true; });
    menu.hidden = !wasHidden;
  });
  wrap.appendChild(btn);
  wrap.appendChild(menu);
  return wrap;
}

// Count how many times `name` is used as a speaker (line head + [ or :).
function countScriptSpeakerUses(name) {
  if (!name) return 0;
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`^\\s*${esc}(?=[\\[：:])`, "gm");
  return (state.script.match(re) || []).length;
}

// Batch-upload portraits: each picked file's base name = emotion.
function batchUploadPortraits(ch) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/jpeg,image/png,image/webp";
  input.multiple = true;
  input.style.display = "none";
  document.body.appendChild(input);
  input.addEventListener("change", async () => {
    const files = Array.from(input.files || []);
    input.remove();
    if (!files.length) return;
    let added = 0, replaced = 0, failed = 0;
    for (const file of files) {
      const emo = file.name.replace(/\.[^.]+$/, "").trim();
      if (!emo || file.size > MAX_FILE_BYTES) { failed++; continue; }
      try {
        const raw = await readFileAsDataURL(file);
        const result = await downscaleImage(raw, 1200);
        const hadImg = !!ch.portraits[emo];
        if (!ch.emotions.includes(emo)) ch.emotions.push(emo);
        ch.portraits[emo] = result.dataUrl;
        if (hadImg) replaced++; else added++;
      } catch (e) { failed++; }
    }
    saveToStorage();
    renderCharList();
    updateStorageMeter();
    showToast(`✨ 批次上傳：新增 ${added}、覆蓋 ${replaced}${failed ? `、失敗 ${failed}` : ""}`, "success", 3500);
  });
  input.click();
}

// ----- Rename → optionally sync the script -----
function makeRenamePattern(name, kind) {
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (kind === "char") return new RegExp(`^(\\s*)${esc}(?=[\\[：:])`, "gm");
  if (kind === "bg")   return new RegExp(`(\\[bg\\s*:\\s*)${esc}(\\s*\\])`, "gi");
  if (kind === "cg")   return new RegExp(`(\\[cg(?:\\s+full)?\\s*:\\s*)${esc}(\\s*\\])`, "gi");
  return null;
}

function applyScriptRename(oldName, newName, kind) {
  const re = makeRenamePattern(oldName, kind);
  if (!re) return;
  state.script = (kind === "char")
    ? state.script.replace(re, (m, sp) => sp + newName)
    : state.script.replace(re, (m, a, b) => a + newName + b);
  els.scriptArea.value = state.script;
  reparseAndRender(false);
}

// applyData(): commit the rename to data. revert(): undo UI on cancel.
async function handleRename({ oldName, newName, kind, applyData, revert }) {
  if (!newName || oldName === newName) { revert(); return; }
  const re = makeRenamePattern(oldName, kind);
  const matches = re ? (state.script.match(re) || []).length : 0;
  if (matches === 0) { applyData(); saveToStorage(); return; }
  const choice = await inlineChoose({
    title: "同步劇本?",
    message: `劇本中有 ${matches} 處提到「${oldName}」,要一起改名為「${newName}」嗎?`,
    options: [
      { key: "syncAll",  label: "全部同步",  desc: `資料與劇本中 ${matches} 處一起改` },
      { key: "dataOnly", label: "只改資料",  desc: "劇本維持舊名稱不動" },
    ],
  });
  if (!choice) { revert(); return; }
  applyData();
  if (choice === "syncAll") applyScriptRename(oldName, newName, kind);
  saveToStorage();
}

function duplicateCharacter(ch, idx) {
  let newId = ch.id + "_copy";
  while (state.characters.some(c => c.id === newId)) newId += "_";
  const copy = {
    id: newId,
    name: ch.name + " 副本",
    color: ch.color,
    emotions: [...(ch.emotions || [])],
    portraits: { ...(ch.portraits || {}) },
  };
  state.characters.splice(idx + 1, 0, copy);
  saveToStorage();
  renderCharList();
  updateStorageMeter();
  showToast(`✨ 已複製為「${copy.name}」`, "success");
}

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
  card.dataset.kind = ch.kind || "supporting";

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
  nameIn.addEventListener("focus", (e) => { e.target._oldName = ch.name; });
  nameIn.addEventListener("input", (e) => {
    ch.name = e.target.value;
    saveToStorage();
  });
  nameIn.addEventListener("change", (e) => {
    const oldName = e.target._oldName != null ? e.target._oldName : ch.name;
    const newName = e.target.value.trim();
    e.target._oldName = newName;
    handleRename({
      oldName, newName, kind: "char",
      applyData: () => { ch.name = newName; e.target.value = newName; },
      revert: () => {
        ch.name = oldName;
        e.target.value = oldName;
        saveToStorage();
        renderCharList();
      },
    });
  });
  head.appendChild(nameIn);

  const menu = buildCardMenu([
    { label: "📁 整批上傳立繪", onClick: () => batchUploadPortraits(ch) },
    { label: "🗑 清空所有立繪", onClick: async () => {
        const ok = await inlineConfirm({
          title: `清空「${ch.name}」所有立繪?`,
          message: "角色設定與表情清單會保留,只刪除已上傳的圖片。此動作無法復原。",
          okText: "清空立繪", danger: true,
        });
        if (!ok) return;
        ch.portraits = {};
        saveToStorage();
        renderCharList();
        updateStorageMeter();
        showToast(`✨ 已清空「${ch.name}」的立繪`, "success");
      } },
    { label: "📋 複製此角色", onClick: () => duplicateCharacter(ch, idx) },
    { sep: true },
    { label: "✕ 刪除角色", danger: true, onClick: async () => {
        const uses = countScriptSpeakerUses(ch.name);
        const ok = await inlineConfirm({
          title: `刪除角色「${ch.name}」?`,
          message: (uses > 0
            ? `劇本中有 ${uses} 處使用此角色,刪除後相關對話將失效。\n`
            : "") + "所有上傳的立繪會一起刪除,此動作無法復原。",
          okText: "刪除", danger: true,
        });
        if (!ok) return;
        state.characters.splice(idx, 1);
        saveToStorage();
        renderCharList();
        updateStorageMeter();
      } },
  ]);
  head.appendChild(menu);

  card.appendChild(head);

  // quick colour swatches
  const PRESET_COLORS = [
    { c: "#d4869a", t: "玫瑰" }, { c: "#c4a265", t: "金" },
    { c: "#8b9fd4", t: "藍" },   { c: "#8fb88f", t: "綠" },
    { c: "#8b5fb8", t: "紫" },   { c: "#d4a08f", t: "珊瑚" },
    { c: "#a0a0a0", t: "灰" },
  ];
  const colorRow = document.createElement("div");
  colorRow.className = "char-color-row";
  const swatches = document.createElement("div");
  swatches.className = "char-color-swatches";
  PRESET_COLORS.forEach(({ c, t }) => {
    const sw = document.createElement("button");
    sw.type = "button";
    sw.className = "color-swatch" + (c.toLowerCase() === (ch.color || "").toLowerCase() ? " active" : "");
    sw.style.background = c;
    sw.dataset.color = c;
    sw.title = t;
    sw.addEventListener("click", () => {
      ch.color = c;
      dot.style.background = c;
      colorIn.value = c;
      swatches.querySelectorAll(".color-swatch").forEach(s =>
        s.classList.toggle("active", s.dataset.color.toLowerCase() === c.toLowerCase()));
      saveToStorage();
    });
    swatches.appendChild(sw);
  });
  colorRow.appendChild(swatches);
  card.appendChild(colorRow);

  // kind switch: 配角 / 主角
  const kindRow = document.createElement("div");
  kindRow.className = "char-kind-row";
  const isProtag = ch.kind === "protagonist";
  kindRow.innerHTML =
    `<label><input type="radio" name="kind-${ch.id}" value="supporting" ${!isProtag ? "checked" : ""}> 配角</label>` +
    `<label><input type="radio" name="kind-${ch.id}" value="protagonist" ${isProtag ? "checked" : ""}> 主角</label>` +
    `<span class="char-kind-hint">${isProtag ? "不出立繪、無表情" : "有立繪、有表情"}</span>`;
  kindRow.querySelectorAll('input[name^="kind-"]').forEach(radio => {
    radio.addEventListener("change", () => {
      if (!radio.checked) return;
      ch.kind = radio.value;
      saveToStorage();
      reparseAndRender(false);
      renderCharList();
    });
  });
  card.appendChild(kindRow);

  if (isProtag) {
    // protagonist: no emotion / portrait area
    const notice = document.createElement("div");
    notice.className = "protagonist-notice";
    notice.innerHTML =
      `💡 主角不出立繪、沒有表情。<br>` +
      `劇本中寫 <code>${_shEsc(ch.name)}：你好</code> = 開口說話<br>` +
      `寫 <code>（這該怎麼辦？）</code> = 內心獨白`;
    card.appendChild(notice);
    return card;
  }

  // emotions grid (supporting only)
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
    handleRename({
      oldName: key, newName: newKey, kind: "bg",
      applyData: () => {
        state.backgrounds[newKey] = state.backgrounds[key];
        delete state.backgrounds[key];
        state.bgOrder = state.bgOrder.map(k => k === key ? newKey : k);
      },
      revert: () => { e.target.value = key; },
    }).then(() => renderBgList());
  });
  card.appendChild(nameIn);

  // tag
  const tag = document.createElement("div");
  tag.className = "bg-tag";
  tag.textContent = bg.type === "preset" ? "預設" : "自訂";
  card.appendChild(tag);

  const bgMenuItems = [
    { label: "📁 換圖", onClick: () => triggerBgImageUpload(key) },
    { label: "🗑 清空圖（回到預設色塊）", onClick: async () => {
        const ok = await inlineConfirm({
          title: `清空背景「${key}」的圖?`,
          message: "會回到預設色塊,名稱保留。此動作無法復原。",
          okText: "清空", danger: true,
        });
        if (!ok) return;
        state.backgrounds[key] = { type: "preset", className: "stage-bg-default" };
        saveToStorage();
        renderBgList();
        updateStorageMeter();
        showToast(`✨ 已清空背景「${key}」的圖`, "success");
      } },
  ];
  // preset backgrounds cannot be deleted (per spec)
  if (bg.type !== "preset") {
    bgMenuItems.push({ sep: true });
    bgMenuItems.push({ label: "✕ 刪除背景", danger: true, onClick: async () => {
      const ok = await inlineConfirm({
        title: `刪除背景「${key}」?`,
        message: "上傳的圖片也會一起刪除。此動作無法復原。",
        okText: "刪除", danger: true,
      });
      if (!ok) return;
      delete state.backgrounds[key];
      state.bgOrder = state.bgOrder.filter(k => k !== key);
      saveToStorage();
      renderBgList();
      updateStorageMeter();
    } });
  }
  card.appendChild(buildCardMenu(bgMenuItems));

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
  const kind = await inlineChoose({
    title: "新增角色類型",
    message: "要新增什麼類型的角色?",
    options: [
      { key: "supporting", label: "配角", desc: "有立繪、有表情" },
      { key: "protagonist", label: "主角", desc: "無立繪、可寫內心話" },
    ],
  });
  if (!kind) return;
  const isProtag = kind === "protagonist";
  const name = await inlinePrompt({
    title: isProtag ? "新增主角" : "新增配角",
    message: "輸入角色名稱（可在劇本中作為說話者）",
    placeholder: isProtag ? "例如:我、菖莉亞" : "例如:學長、同學、神秘人",
    validate: (v) => {
      if (!v) return "請輸入角色名";
      if (state.characters.find(c => c.name === v)) return "已有同名角色";
      return null;
    },
  });
  if (!name) return;
  const colors = ["#c4a265", "#d4869a", "#8b9fd4", "#a8d486", "#b888d4", "#d4b886"];
  const used = state.characters.map(c => c.color);
  const color = isProtag
    ? "#d4869a"
    : (colors.find(c => !used.includes(c)) || colors[Math.floor(Math.random() * colors.length)]);
  state.characters.push({
    id: (isProtag ? "protagonist_" : "char_") + Date.now(),
    name,
    kind,
    color,
    emotions: isProtag ? [] : ["普通"],
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
    handleRename({
      oldName: key, newName: newKey, kind: "cg",
      applyData: () => {
        state.cgs[newKey] = state.cgs[key];
        delete state.cgs[key];
        state.cgOrder = state.cgOrder.map(k => k === key ? newKey : k);
      },
      revert: () => { e.target.value = key; },
    }).then(() => renderCgList());
  });
  card.appendChild(nameIn);

  const actions = document.createElement("div");
  actions.className = "cg-card-actions";
  const tag = document.createElement("div");
  tag.className = "bg-tag";
  tag.textContent = cg && cg.dataUrl ? "已上傳" : "未上傳";
  actions.appendChild(tag);

  card.appendChild(actions);

  card.appendChild(buildCardMenu([
    { label: "📁 換圖", onClick: () => triggerCgImageUpload(key) },
    { sep: true },
    { label: "✕ 刪除 CG", danger: true, onClick: async () => {
        const ok = await inlineConfirm({
          title: `刪除 CG「${key}」?`,
          message: "上傳的圖卡也會一起刪除。此動作無法復原。",
          okText: "刪除", danger: true,
        });
        if (!ok) return;
        delete state.cgs[key];
        state.cgOrder = state.cgOrder.filter(k => k !== key);
        saveToStorage();
        renderCgList();
        updateStorageMeter();
      } },
  ]));
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

// ----- Style modal (extracted from assets modal) -----
const styleModalEl = document.getElementById("styleModal");
function openStyleModal() {
  styleModalEl.classList.add("show");
  renderStyleTab();
}
function closeStyleModal() {
  styleModalEl.classList.remove("show");
  reparseAndRender(false);
}
document.getElementById("btnStyle").addEventListener("click", openStyleModal);
document.getElementById("styleModalClose").addEventListener("click", closeStyleModal);
document.getElementById("styleModalDone").addEventListener("click", closeStyleModal);
styleModalEl.addEventListener("click", (e) => {
  if (e.target === styleModalEl) closeStyleModal();
});

// ----- Interface theme (G2) -----
const THEME_KEY = "otome-theme";
function applyTheme(t) {
  const theme = (t === "daylight" || t === "rose") ? t : "violet";
  document.documentElement.setAttribute("data-theme", theme);
  try { localStorage.setItem(THEME_KEY, theme); } catch (e) {}
  document.querySelectorAll(".theme-btn").forEach(b => {
    b.classList.toggle("active", b.dataset.theme === theme);
  });
}
applyTheme(localStorage.getItem(THEME_KEY) || "violet");
document.querySelectorAll(".theme-btn").forEach(b => {
  b.addEventListener("click", () => applyTheme(b.dataset.theme));
});

// ----- Syntax help modal -----
const syntaxModalEl = document.getElementById("syntaxModal");
document.getElementById("btnSyntaxHelp").addEventListener("click", () => {
  syntaxModalEl.classList.add("show");
});
document.getElementById("syntaxModalClose").addEventListener("click", () => {
  syntaxModalEl.classList.remove("show");
});
syntaxModalEl.addEventListener("click", (e) => {
  if (e.target === syntaxModalEl) syntaxModalEl.classList.remove("show");
});

// ----- Topbar "more" menu (匯入 / 匯出 / 重設) -----
const topbarMenuEl = document.getElementById("topbarMenu");
const btnMoreEl = document.getElementById("btnMore");
function closeTopbarMenu() { topbarMenuEl.hidden = true; }
btnMoreEl.addEventListener("click", (e) => {
  e.stopPropagation();
  topbarMenuEl.hidden = !topbarMenuEl.hidden;
  if (!topbarMenuEl.hidden) renderRecentList();
});

// ----- Recent projects (G7) -----
const RECENT_KEY = "otome-recent";
function extractProjectName(payload) {
  const firstLine = ((payload && payload.script) || "").split("\n").find(l => l.trim());
  return firstLine ? firstLine.trim().slice(0, 30) : "未命名專案";
}
function pushRecent(payload) {
  let list;
  try { list = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); }
  catch (e) { list = []; }
  if (!Array.isArray(list)) list = [];
  list.unshift({ name: extractProjectName(payload), timestamp: Date.now(), data: payload });
  list = list.slice(0, 5);
  while (list.length > 0) {
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(list)); break; }
    catch (e) { list.pop(); }   // quota — drop the oldest and retry
  }
}
function renderRecentList() {
  const container = document.getElementById("recentList");
  if (!container) return;
  let list;
  try { list = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); }
  catch (e) { list = []; }
  if (!Array.isArray(list)) list = [];
  container.innerHTML = "";
  if (list.length === 0) {
    const empty = document.createElement("div");
    empty.className = "topbar-menu-item";
    empty.style.color = "var(--text-faint)";
    empty.style.pointerEvents = "none";
    empty.textContent = "（尚無）";
    container.appendChild(empty);
    return;
  }
  list.forEach((entry) => {
    const btn = document.createElement("button");
    btn.className = "topbar-menu-item";
    btn.textContent = `📂 ${entry.name}`;
    btn.title = new Date(entry.timestamp).toLocaleString();
    btn.addEventListener("click", async () => {
      closeTopbarMenu();
      try {
        await applyImportedPayload(entry.data);
      } catch (err) {
        console.error(err);
        showToast("載入失敗:" + err.message, "warn", 4000);
      }
    });
    container.appendChild(btn);
  });
}
document.addEventListener("click", (e) => {
  if (topbarMenuEl.hidden) return;
  if (!topbarMenuEl.contains(e.target) && e.target !== btnMoreEl) closeTopbarMenu();
});
// menu items keep their original ids (#btnImport / #btnShare / #btnReset),
// so existing handlers still fire — just close the menu after clicking.
topbarMenuEl.querySelectorAll(".topbar-menu-item").forEach(item => {
  item.addEventListener("click", closeTopbarMenu);
});

// ----- Mobile pane switch tabs -----
document.querySelectorAll(".mobile-pane-tab").forEach(tab => {
  tab.addEventListener("click", () => {
    const target = tab.dataset.pane;
    document.querySelectorAll(".mobile-pane-tab").forEach(t =>
      t.classList.toggle("active", t === tab));
    document.querySelector(".pane-script")
      .classList.toggle("mobile-active", target === "script");
    document.querySelector(".pane-preview")
      .classList.toggle("mobile-active", target === "preview");
  });
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
  const base = RENDER_SIZES[ratio];
  // Optional super-sampling for crisp screenshots (set by #btnScreenshot).
  // Recording leaves it unset → scale 1 → unchanged behaviour. All drawing
  // below is expressed as fractions of w/h, so it auto-scales.
  const scale = Math.max(1, parseFloat(canvas.dataset.renderScale) || 1);
  const w = base.w * scale;
  const h = base.h * scale;
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

    // light mode → is this character dimmed?
    const lm = (frame.lightMode) || state.stage.lightMode || state.lightMode || "聚光";
    let isDimmed = false;
    if (lm === "聚光") isDimmed = !isActive;
    else if (lm === "全暗") isDimmed = true;

    const slotCx = padX + slotW * (i + 0.5);
    const charW = slotW * 0.98;
    const charX = slotCx - charW / 2;

    const portraitSrc = ch.portraits[slot.emotion] || ch.portraits["__default__"];
    if (portraitSrc) {
      const img = await preloadImage(portraitSrc);
      if (img.complete && img.naturalWidth > 0) {
        // fit contain, bottom-aligned
        const iw = img.naturalWidth, ih = img.naturalHeight;
        const sc = Math.min(charW / iw, charH / ih);
        const dw = iw * sc, dh = ih * sc;
        const dx = slotCx - dw / 2;
        const dy = charY + charH - dh;
        if (isDimmed) {
          // Offscreen so the dark overlay only follows the portrait's
          // own silhouette (source-atop) and never touches the background.
          const oc = document.createElement("canvas");
          oc.width = Math.max(1, Math.ceil(dw));
          oc.height = Math.max(1, Math.ceil(dh));
          const octx = oc.getContext("2d");
          octx.drawImage(img, 0, 0, oc.width, oc.height);
          octx.globalCompositeOperation = "source-atop";
          octx.fillStyle = "rgba(0, 0, 0, 0.6)";
          octx.fillRect(0, 0, oc.width, oc.height);
          ctx.drawImage(oc, dx, dy, dw, dh);
        } else {
          ctx.drawImage(img, dx, dy, dw, dh);
        }
      }
    } else {
      // placeholder — render to offscreen then optionally darken its shape
      const oc = document.createElement("canvas");
      oc.width = Math.max(1, Math.ceil(charW));
      oc.height = Math.max(1, Math.ceil(charH));
      const octx = oc.getContext("2d");
      drawPlaceholderPortrait(octx, 0, 0, oc.width, oc.height, ch.color, ch.name);
      if (isDimmed) {
        octx.globalCompositeOperation = "source-atop";
        octx.fillStyle = "rgba(0, 0, 0, 0.6)";
        octx.fillRect(0, 0, oc.width, oc.height);
      }
      ctx.drawImage(oc, charX, charY, charW, charH);
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

    // backdrop — shape-aware, mirrors the DOM [data-shape] styles
    drawDialogShape(ctx, boxX, boxY, boxW, boxH,
      (state.dialogStyle && state.dialogStyle.shape) || "classic", scale);

    const contentPad = w * 0.028;
    const contentX = boxX + contentPad;
    const contentW = boxW - contentPad * 2;

    if (frame.dialog.isNarration) {
      ctx.save();
      ctx.fillStyle = "#9a8aa8";
      const fontSize = Math.round(h * 0.035);
      ctx.font = `400 ${fontSize}px ${frame.dialog.fontStack || '"Noto Serif TC", "PingFang TC", serif'}`;
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
      // short gold gradient line after name (matches DOM ::after)
      const nameWidth = ctx.measureText(frame.dialog.speaker).width;
      const lineStart = contentX + nameWidth + 8 * scale;
      const lineY = nameY + nameSize / 2;
      const lineW = 60 * scale;
      const lineGrad = ctx.createLinearGradient(lineStart, lineY, lineStart + lineW, lineY);
      lineGrad.addColorStop(0, "rgba(230, 201, 137, 1)");
      lineGrad.addColorStop(0.6, "rgba(196, 162, 101, 0.4)");
      lineGrad.addColorStop(1, "rgba(196, 162, 101, 0)");
      ctx.fillStyle = lineGrad;
      ctx.fillRect(lineStart, lineY, lineW, 1 * scale);
      ctx.restore();

      // text
      ctx.save();
      ctx.fillStyle = "#f3e9d8";
      const textSize = Math.round(h * 0.036);
      ctx.font = `400 ${textSize}px ${frame.dialog.fontStack || '"PingFang TC", "Noto Sans TC", sans-serif'}`;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      const lines = wrapText(ctx, frame.dialog.text, contentW);
      const lineH = textSize * 1.7;
      const startY = boxY + contentPad * 0.8 + nameSize + h * 0.012 + 16 * scale;
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

  // Anti-dedup pixel: 在右下角畫一個近乎透明、每幀微變的色塊,
  // 確保任兩幀像素都不完全相同,防止 Threads / Instagram 重編碼合併相鄰幀。
  // fake game UI overlay (H4) — drawn on top of everything,
  // 但 cg solo / full（hideGameUI）時跳過（J5）
  if (!frame.cg || !frame.cg.hideGameUI) {
    drawGameUI(ctx, w, h, scale);
  }

  // 截圖時 window.__recAntiDedup 設為 false 以略過(R6)。
  if (window.__recAntiDedup !== false) {
    window.__recFrameCounter = ((window.__recFrameCounter || 0) + 1) % 256;
    ctx.fillStyle = `rgba(${window.__recFrameCounter}, 0, 0, 0.015)`;
    ctx.fillRect(canvas.width - 2, canvas.height - 2, 2, 2);
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

// Canvas counterpart of the DOM .dialog-box[data-shape] styles (H3.5).
function drawDialogShape(ctx, x, y, w, h, shape, scale) {
  const ds = state.dialogStyle || DEFAULT_DIALOG_STYLE;
  const c = hexToRgb(ds.color);
  const a = (ds.opacity == null) ? 0.88 : ds.opacity;
  const bg = `rgba(${c.r}, ${c.g}, ${c.b}, ${a})`;
  const c2 = { r: Math.min(255, c.r + 10), g: Math.min(255, c.g + 6), b: Math.min(255, c.b + 14) };
  const GOLD = "#c4a265";

  switch (shape) {
    case "soft":
      roundRect(ctx, x, y, w, h, 18 * scale);
      ctx.fillStyle = bg; ctx.fill();
      break;

    case "bubble": {
      roundRect(ctx, x, y, w, h, 20 * scale);
      ctx.fillStyle = bg; ctx.fill();
      ctx.strokeStyle = GOLD; ctx.lineWidth = 1.5 * scale; ctx.stroke();
      const tipX = x + w / 2, tipY = y - 10 * scale;
      ctx.beginPath();
      ctx.moveTo(tipX - 9 * scale, y);
      ctx.lineTo(tipX, tipY);
      ctx.lineTo(tipX + 9 * scale, y);
      ctx.closePath();
      ctx.fillStyle = bg; ctx.fill();
      ctx.beginPath();
      ctx.moveTo(tipX - 9 * scale, y);
      ctx.lineTo(tipX, tipY);
      ctx.lineTo(tipX + 9 * scale, y);
      ctx.strokeStyle = GOLD; ctx.lineWidth = 1.5 * scale; ctx.stroke();
      break;
    }

    case "parchment": {
      roundRect(ctx, x, y, w, h, 4 * scale);
      ctx.fillStyle = bg; ctx.fill();
      ctx.strokeStyle = "rgba(196, 162, 101, 0.35)";
      ctx.lineWidth = 1 * scale; ctx.stroke();
      ctx.save();
      roundRect(ctx, x, y, w, h, 4 * scale); ctx.clip();
      const ig = ctx.createRadialGradient(
        x + w / 2, y + h / 2, h * 0.3,
        x + w / 2, y + h / 2, h);
      ig.addColorStop(0, "transparent");
      ig.addColorStop(1, "rgba(0, 0, 0, 0.25)");
      ctx.fillStyle = ig; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
      for (let dx = 0; dx < w; dx += 7 * scale) {
        ctx.fillRect(x + dx, y - 1, 1 * scale, 4 * scale);
        ctx.fillRect(x + dx, y + h - 3 * scale, 1 * scale, 4 * scale);
      }
      ctx.restore();
      break;
    }

    case "minimal": {
      const mg = ctx.createLinearGradient(x, y, x, y + h);
      mg.addColorStop(0, "transparent");
      mg.addColorStop(0.3, `rgba(${c.r}, ${c.g}, ${c.b}, ${a * 0.5})`);
      mg.addColorStop(1, bg);
      ctx.fillStyle = mg; ctx.fillRect(x, y, w, h);
      break;
    }

    case "window":
      ctx.fillStyle = bg; ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = GOLD; ctx.lineWidth = 1 * scale;
      ctx.beginPath();
      ctx.moveTo(x, y); ctx.lineTo(x + w, y);
      ctx.moveTo(x, y + h); ctx.lineTo(x + w, y + h);
      ctx.stroke();
      ctx.strokeStyle = "rgba(196, 162, 101, 0.35)";
      ctx.beginPath();
      ctx.moveTo(x + 8 * scale, y + 4 * scale);
      ctx.lineTo(x + w - 8 * scale, y + 4 * scale);
      ctx.moveTo(x + 8 * scale, y + h - 4 * scale);
      ctx.lineTo(x + w - 8 * scale, y + h - 4 * scale);
      ctx.stroke();
      break;

    case "classic":
    default: {
      const grad = ctx.createLinearGradient(0, y, 0, y + h);
      grad.addColorStop(0, `rgba(${c.r}, ${c.g}, ${c.b}, ${Math.max(0, a - 0.03)})`);
      grad.addColorStop(1, `rgba(${c2.r}, ${c2.g}, ${c2.b}, ${Math.min(1, a + 0.04)})`);
      ctx.fillStyle = grad;
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = GOLD; ctx.lineWidth = 1 * scale;
      ctx.strokeRect(x, y, w, h);
      drawCornerBrackets(ctx, x, y, w, h, h * 0.025);
      break;
    }
  }
}

// Canvas counterpart of the DOM fake game UI (H4.7).
function drawGameUI(ctx, w, h, scale) {
  const u = state.gameUI;
  if (!u) return;
  const displayFont = '"Cormorant Garamond", "Noto Serif TC", serif';
  const baseFont = '"PingFang TC", "Microsoft JhengHei", sans-serif';

  if (u.chapter.enabled && u.chapter.text) {
    ctx.save();
    ctx.font = `italic ${18 * scale}px ${displayFont}`;
    ctx.fillStyle = "#e6c989";
    ctx.shadowColor = "rgba(0,0,0,0.7)";
    ctx.shadowBlur = 8 * scale;
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    ctx.fillText("❀ " + u.chapter.text, 22 * scale, 18 * scale);
    ctx.restore();
  }

  if (u.date.enabled && u.date.text) {
    ctx.save();
    ctx.font = `${14 * scale}px ${baseFont}`;
    ctx.textBaseline = "middle";
    const padX = 12 * scale;
    const text = u.date.text;
    const textW = ctx.measureText(text).width;
    const boxW = textW + padX * 2;
    const boxH = 26 * scale;
    const boxX = w - 22 * scale - boxW;
    const boxY = 18 * scale;
    ctx.fillStyle = "rgba(13, 7, 22, 0.4)";
    roundRect(ctx, boxX, boxY, boxW, boxH, boxH / 2); ctx.fill();
    ctx.strokeStyle = "rgba(196, 162, 101, 0.18)";
    ctx.lineWidth = 1 * scale;
    roundRect(ctx, boxX, boxY, boxW, boxH, boxH / 2); ctx.stroke();
    ctx.fillStyle = "#f3e9d8";
    ctx.textAlign = "right";
    ctx.fillText(text, w - 22 * scale - padX, boxY + boxH / 2);
    ctx.restore();
  }

  if (u.love.enabled) {
    const ch = state.characters.find(c => c.id === u.love.charId);
    if (ch) {
      ctx.save();
      const boxW = 180 * scale, boxH = 38 * scale;
      const boxX = w - 22 * scale - boxW;
      const boxY = 56 * scale;
      ctx.fillStyle = "rgba(13, 7, 22, 0.5)";
      roundRect(ctx, boxX, boxY, boxW, boxH, boxH / 2); ctx.fill();
      ctx.strokeStyle = "rgba(196, 162, 101, 0.18)";
      ctx.lineWidth = 1 * scale;
      roundRect(ctx, boxX, boxY, boxW, boxH, boxH / 2); ctx.stroke();
      ctx.fillStyle = "#d4869a";
      ctx.shadowColor = "#d4869a";
      ctx.shadowBlur = 6 * scale;
      ctx.font = `${20 * scale}px sans-serif`;
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";
      ctx.fillText("♥", boxX + 14 * scale, boxY + boxH / 2);
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#9a8aa8";
      ctx.font = `italic ${10 * scale}px ${displayFont}`;
      ctx.textBaseline = "top";
      ctx.fillText(ch.name, boxX + 40 * scale, boxY + 12 * scale);
      const barX = boxX + 40 * scale;
      const barY = boxY + 22 * scale;
      const barW = 120 * scale, barH = 4 * scale;
      ctx.fillStyle = "rgba(255,255,255,0.1)";
      roundRect(ctx, barX, barY, barW, barH, 2 * scale); ctx.fill();
      const fillW = barW * (Math.max(0, Math.min(100, u.love.value)) / 100);
      if (fillW > 0) {
        const grad = ctx.createLinearGradient(barX, barY, barX + barW, barY);
        grad.addColorStop(0, "#d4869a");
        grad.addColorStop(1, "#e6c989");
        ctx.fillStyle = grad;
        roundRect(ctx, barX, barY, fillW, barH, 2 * scale); ctx.fill();
      }
      ctx.restore();
    }
  }

  if (u.autoSkip.enabled) {
    ctx.save();
    ctx.font = `italic ${12 * scale}px ${displayFont}`;
    ctx.textBaseline = "middle";
    const labels = [
      { text: "SKIP", active: false },
      { text: "AUTO", active: true },
    ];
    let cursorX = w - 22 * scale;
    const btnY = h - 14 * scale - 11 * scale;
    for (let i = labels.length - 1; i >= 0; i--) {
      const lab = labels[i];
      const tw = ctx.measureText(lab.text).width;
      const padX = 12 * scale;
      const btnW = tw + padX * 2;
      const btnH = 22 * scale;
      const btnX = cursorX - btnW;
      ctx.fillStyle = lab.active ? "rgba(196, 162, 101, 0.1)" : "rgba(13, 7, 22, 0.6)";
      roundRect(ctx, btnX, btnY - btnH / 2, btnW, btnH, btnH / 2); ctx.fill();
      ctx.strokeStyle = lab.active ? "#e6c989" : "rgba(196, 162, 101, 0.18)";
      ctx.lineWidth = 1 * scale;
      roundRect(ctx, btnX, btnY - btnH / 2, btnW, btnH, btnH / 2); ctx.stroke();
      ctx.fillStyle = lab.active ? "#e6c989" : "#9a8aa8";
      ctx.textAlign = "center";
      ctx.fillText(lab.text, btnX + btnW / 2, btnY);
      cursorX = btnX - 6 * scale;
    }
    ctx.restore();
  }
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
        fontStack: cur.fontId ? (FONT_BY_ID[cur.fontId] && FONT_BY_ID[cur.fontId].stack) : null,
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
    lightMode: state.stage.lightMode,
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
  const beatNo = state.currentIndex + 1;
  const total = state.parsed.length;
  showToast(`📸 正在繪製第 ${beatNo} / ${total} 拍...`, "", 1500);
  // 截圖不要 anti-dedup pixel（R3）
  window.__recAntiDedup = false;
  try {
    await preloadAllAssets();
    const canvas = document.createElement("canvas");
    canvas.dataset.renderScale = "2"; // 2x 解析度提升截圖品質（影片維持原解析度）
    const frame = buildFrameAt(state.currentIndex);
    await renderFrameToCanvas(canvas, frame);
    const dim = `${canvas.width}×${canvas.height}`;
    canvas.toBlob((blob) => {
      if (!blob) { showToast("截圖失敗", "warn"); window.__recAntiDedup = true; return; }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `otome-${timestamp()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast(`✨ 已截取第 ${beatNo} 拍 (${dim})`, "success");
      window.__recAntiDedup = true;
    }, "image/png");
  } catch (e) {
    console.error(e);
    showToast("截圖失敗:" + e.message, "warn", 4000);
    window.__recAntiDedup = true;
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

function buildExportPayload() {
  return {
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
    dialogStyle: state.dialogStyle,
    gameUI: state.gameUI,
    lightMode: state.lightMode,
  };
}

document.getElementById("btnShare").addEventListener("click", () => {
  try {
    const project = buildExportPayload();
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

document.getElementById("btnImport").addEventListener("click", async () => {
  const useString = await inlineConfirm({
    title: "從哪裡匯入?",
    message: "可以貼入朋友給的分享字串,或選擇 .json 專案檔。",
    okText: "貼入分享字串",
    cancelText: "選擇檔案",
  });
  if (useString) {
    const input = await inlinePrompt({
      title: "貼入分享字串",
      message: `格式為 ${SHARE_PREFIX}…`,
      placeholder: SHARE_PREFIX + "…",
    });
    if (!input) return;
    const trimmed = input.trim();
    if (!trimmed.startsWith(SHARE_PREFIX)) {
      showToast("字串格式錯誤", "warn", 3000);
      return;
    }
    try {
      const b64 = trimmed.slice(SHARE_PREFIX.length);
      const json = decodeURIComponent(escape(atob(b64)));
      await applyImportedPayload(JSON.parse(json));
    } catch (e) {
      console.error(e);
      showToast("分享字串格式錯誤或損毀", "warn", 3500);
    }
  } else {
    const fileInput = document.getElementById("projectInput");
    fileInput.value = "";
    fileInput.click();
  }
});

async function applyImportedPayload(data) {
  try {
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
      state.characters = (Array.isArray(data.characters) ? data.characters : []).map(migrateCharacter);
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
      if (data.dialogStyle && typeof data.dialogStyle === "object") {
        state.dialogStyle = migrateDialogStyle(data.dialogStyle);
      }
      state.gameUI = migrateGameUI(data.gameUI);
      state.lightMode = LIGHT_MODES.includes(data.lightMode) ? data.lightMode : DEFAULT_LIGHT_MODE;
      // 防禦性：舊版 export 無 hideGameUI 欄位（state.stage.cg 通常由
      // computeStageStateAt 重算，這裡僅保險）
      if (state.stage.cg && state.stage.cg.hideGameUI === undefined) {
        state.stage.cg.hideGameUI = state.stage.cg.hideDialog || false;
      }
    } else {
      // speed-draft: just script + characters (preserve existing portraits if name matches)
      const existingByName = new Map(state.characters.map(c => [c.name, c]));
      state.script = data.script || "";
      state.characters = data.characters.map((c, idx) => {
        const existing = existingByName.get(c.name);
        return migrateCharacter({
          id: existing ? existing.id : ("ch_imp_" + Date.now() + "_" + idx),
          name: c.name,
          kind: c.kind,
          color: c.color || "#c4a265",
          emotions: Array.isArray(c.emotions) ? c.emotions : ["普通"],
          portraits: existing ? existing.portraits : {},
        });
      });
    }
    ensureProtagonistExists();

    // re-render everything
    els.scriptArea.value = state.script;
    setRatio(state.ratio);
    applyDialogStyle();
    applyGameUI();
    state.currentIndex = 0;
    reparseAndRender(true);
    saveToStorage();
    showToast(isOtome ? "✨ 專案已匯入" : "✨ 劇本速寫已匯入", "success", 3000);
    if (typeof pushRecent === "function") pushRecent(data);
  } catch (err) {
    console.error(err);
    showToast("匯入失敗:" + err.message, "warn", 4000);
  }
}

document.getElementById("projectInput").addEventListener("change", async (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    await applyImportedPayload(JSON.parse(text));
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
  active: false,      // true while a recording is in progress
  startBeat: 0,       // first beat index to record (inclusive)
  endBeat: Infinity,  // last beat index to record (inclusive)
};

// 60fps 下，每字至少佔 4 幀 ≈ 66ms，遠大於平台 frame-dedup 閾值（防跳字）
const REC_MIN_FRAMES_PER_CHAR = 4;
// 結尾保險時間：持續繪製最後一幀，確保 MediaRecorder 收到完整 tail
const REC_TAIL_PAD_MS = 1000;

// Read the start/end radio + number selections → beat index range.
function getRecordRange() {
  const last = Math.max(0, state.parsed.length - 1);
  const startSel = document.querySelector('input[name="recStart"]:checked');
  const endSel = document.querySelector('input[name="recEnd"]:checked');
  let startBeat = (startSel && startSel.value === "current")
    ? Math.min(state.currentIndex, last) : 0;
  let endBeat = last;
  if (endSel && endSel.value === "custom") {
    const n = parseInt(document.getElementById("recEndBeat").value, 10);
    endBeat = isNaN(n) ? last : Math.max(1, Math.min(n, state.parsed.length)) - 1;
  }
  if (endBeat < startBeat) endBeat = startBeat;
  return { startBeat, endBeat };
}

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
function estimateRecordingDuration(range) {
  const r = range || { startBeat: 0, endBeat: state.parsed.length - 1 };
  let total = 0;
  let visibleCount = 0;
  for (let i = r.startBeat; i <= r.endBeat && i < state.parsed.length; i++) {
    const ln = state.parsed[i];
    let dt = 0;
    // scene ops merged into this beat each cost a transition hold
    if (ln.sceneOps && ln.sceneOps.length) {
      for (const op of ln.sceneOps) {
        if (op.type === "light") continue;  // instant, no hold
        dt += op.type === "cg" ? recState.bgHold * 1.5 : recState.bgHold;
      }
    }
    if (ln.type === "dialog" || ln.type === "narration") {
      const charCount = (ln.text || "").length;
      // 每字最少 REC_MIN_FRAMES_PER_CHAR / 60 秒,與 typeSpeed 取較大者（R2 後的真實節奏）
      const perCharTime = Math.max(
        recState.typeSpeed / 1000,
        REC_MIN_FRAMES_PER_CHAR / 60
      );
      dt += charCount * perCharTime + recState.holdTime;
    } else if (ln.type === "bg" || ln.type === "exit" || ln.type === "cg_off") {
      dt += recState.bgHold;
    } else if (ln.type === "cg") {
      dt += recState.bgHold * 1.5;
    } else if (ln.type === "scene_only") {
      dt += recState.bgHold;
    } else if (ln.type === "choices") {
      dt += (ln.items.length * 0.6) + 0.3 + 1.2;
    }
    total += dt;
    if (isVisibleType(ln)) {
      visibleCount++;
    }
  }
  // 加上結尾保險時間（R4 的 tail padding）
  total += REC_TAIL_PAD_MS / 1000;
  return { total, totalVisible: visibleCount };
}

function fmtDuration(secs) {
  const m = Math.floor(secs / 60);
  const s = secs - m * 60;
  if (m === 0) return `${s.toFixed(1)} 秒`;
  return `${m} 分 ${s.toFixed(0)} 秒`;
}

function updateEstimate() {
  const info = estimateRecordingDuration(getRecordRange());
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
  // seed range controls
  const total = state.parsed.length;
  document.getElementById("recCurrentBeat").textContent = String(state.currentIndex + 1);
  const endBeatInput = document.getElementById("recEndBeat");
  endBeatInput.max = String(total);
  endBeatInput.value = String(total);
  const headRadio = document.querySelector('input[name="recStart"][value="head"]');
  const lastRadio = document.querySelector('input[name="recEnd"][value="last"]');
  if (headRadio) headRadio.checked = true;
  if (lastRadio) lastRadio.checked = true;
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
// start/end range controls → live re-estimate
document.querySelectorAll('input[name="recStart"], input[name="recEnd"]').forEach(r => {
  r.addEventListener("change", updateEstimate);
});
document.getElementById("recEndBeat").addEventListener("input", () => {
  const custom = document.querySelector('input[name="recEnd"][value="custom"]');
  if (custom) custom.checked = true;
  updateEstimate();
});

// ----- Start recording -----

document.getElementById("recordStartBtn").addEventListener("click", async () => {
  const range = getRecordRange();
  recState.startBeat = range.startBeat;
  recState.endBeat = range.endBeat;
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
  document.getElementById("previewCounter").classList.add("hidden");
  recState.active = true;
  document.getElementById("recTimer").innerHTML = "<strong>00:00</strong>";

  // set up MediaRecorder on canvas stream
  const stream = canvas.captureStream(60); // 60fps 給 Threads 等平台壓 fps 後仍有足夠幀
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
      document.getElementById("previewCounter").classList.remove("hidden");
      recState.active = false;
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
  let lastFrameState = { dialog: null, activeCharId: null };
  try {
    lastFrameState = await runRecordingAnimation(canvas);
  } catch (e) {
    console.error("Animation error:", e);
  }
  document.removeEventListener("visibilitychange", visHandler);
  if (_wasHidden) {
    showToast("⚠ 錄影過程中曾切換分頁,影片可能不順", "warn", 4000);
  }

  // 結尾保險時間：持續繪製最後一幀,確保 MediaRecorder 收到完整 tail
  // （修正最後一句被平台重編碼截斷的問題）
  const tailStart = performance.now();
  while (performance.now() - tailStart < REC_TAIL_PAD_MS) {
    if (recState.stopRequested) break;
    await drawCurrentFrameDuringRec(canvas, lastFrameState.dialog, lastFrameState.activeCharId);
    await new Promise(r => requestAnimationFrame(r));
  }
  // 強制觸發最後一個 chunk,再等一下讓它進 ondataavailable
  if (recorder.state === "recording") {
    try { recorder.requestData(); } catch (e) {}
  }
  await new Promise(r => setTimeout(r, 200));

  // stop recorder
  if (recorder.state !== "inactive") recorder.stop();
  const blob = await recordingPromise;

  // close overlay
  document.getElementById("recordingOverlay").classList.remove("show");
  document.getElementById("previewCounter").classList.remove("hidden");
  recState.active = false;

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
  let lastFrameState = { dialog: null, activeCharId: null };

  // reset stage at start (include cg + lightMode fields)
  state.stage = { bg: "default", slots: { 左: null, 中: null, 右: null }, cg: null, lightMode: state.lightMode || DEFAULT_LIGHT_MODE };

  const startBeat = Number.isFinite(recState.startBeat) ? recState.startBeat : 0;
  const endBeat = Number.isFinite(recState.endBeat)
    ? recState.endBeat : state.parsed.length - 1;
  // If starting mid-script, fast-forward the stage (bg / characters / cg)
  // to just before the start beat — without animating those earlier beats.
  if (startBeat > 0) {
    computeStageStateAt(state.parsed, startBeat - 1);
  }

  // No hard time limit — recording continues until script ends or user clicks Stop.
  // We keep the totalDurationMs param threaded through helpers (now Infinity) so the
  // existing signatures stay intact.
  const totalDurationMs = Infinity;
  const startMs = performance.now();

  // walk through parsed
  for (let i = startBeat; i <= endBeat && i < state.parsed.length; i++) {
    if (recState.stopRequested) break;
    const elapsed = performance.now() - startMs;
    if (elapsed >= totalDurationMs) break;

    const ln = state.parsed[i];

    // Apply scene ops merged into this beat first: each gets a transition
    // draw + bgHold so the background/CG/exit change is visible before the
    // beat's dialog types out.
    if (ln.sceneOps && ln.sceneOps.length) {
      for (const op of ln.sceneOps) {
        if (recState.stopRequested) break;
        if (op.type === "light") {
          // instant — no transition hold
          state.stage.lightMode = op.mode;
          continue;
        }
        if (op.type === "bg") state.stage.bg = op.bgName;
        else if (op.type === "exit") state.stage.slots = { 左: null, 中: null, 右: null };
        else if (op.type === "cg") state.stage.cg = { name: op.cgName, hideDialog: op.hideDialog, hideGameUI: op.hideGameUI };
        else if (op.type === "cg_off") state.stage.cg = null;
        await drawCurrentFrameDuringRec(canvas, null, null);
        await sleepWithTimer(recState.bgHold * 1000 * (op.type === "cg" ? 1.5 : 1), startMs, totalDurationMs);
      }
    }

    if (ln.type === "scene_only") {
      // trailing scene state already applied above; just hold the final frame
      await drawCurrentFrameDuringRec(canvas, null, null);
      await sleepWithTimer(recState.bgHold * 1000, startMs, totalDurationMs);
      lastFrameState = { dialog: null, activeCharId: null };
    } else if (ln.type === "bg") {
      state.stage.bg = ln.bgName;
      await drawCurrentFrameDuringRec(canvas, null, null);
      await sleepWithTimer(recState.bgHold * 1000, startMs, totalDurationMs);
      lastFrameState = { dialog: null, activeCharId: null };
    } else if (ln.type === "exit") {
      state.stage.slots = { 左: null, 中: null, 右: null };
      await drawCurrentFrameDuringRec(canvas, null, null);
      await sleepWithTimer(recState.bgHold * 1000, startMs, totalDurationMs);
      lastFrameState = { dialog: null, activeCharId: null };
    } else if (ln.type === "cg") {
      state.stage.cg = { name: ln.cgName, hideDialog: ln.hideDialog, hideGameUI: ln.hideGameUI };
      await drawCurrentFrameDuringRec(canvas, null, null);
      await sleepWithTimer(recState.bgHold * 1000 * 1.5, startMs, totalDurationMs);
      lastFrameState = { dialog: null, activeCharId: null };
    } else if (ln.type === "cg_off") {
      state.stage.cg = null;
      await drawCurrentFrameDuringRec(canvas, null, null);
      await sleepWithTimer(recState.bgHold * 1000, startMs, totalDurationMs);
      lastFrameState = { dialog: null, activeCharId: null };
    } else if (ln.type === "choices") {
      await animateChoices(canvas, ln, startMs, totalDurationMs);
      lastFrameState = { dialog: null, activeCharId: null };
    } else if (ln.type === "dialog") {
      const ch = findCharacter(ln.speaker);
      let activeCharId = null;
      if (ch && !ln.isProtagonist) {
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
      const fontStack = ln.fontId ? (FONT_BY_ID[ln.fontId] && FONT_BY_ID[ln.fontId].stack) : null;
      const text = ln.text || "";
      let charsShown = 0;
      let framesSinceLastChar = REC_MIN_FRAMES_PER_CHAR; // 允許立刻顯示第一字
      const typeStart = performance.now();
      while (charsShown < text.length) {
        if (recState.stopRequested) break;
        framesSinceLastChar++;
        const elapsedType = performance.now() - typeStart;
        const timeBasedTarget = Math.floor(elapsedType / recState.typeSpeed);
        // 時間到了 且 上個字已存在足夠幀數，才前進「一個」字（嚴格不跳字）
        if (timeBasedTarget > charsShown && framesSinceLastChar >= REC_MIN_FRAMES_PER_CHAR) {
          charsShown++;
          framesSinceLastChar = 0;
        }
        // 每幀都重繪（即使字數沒變），避免編碼器 dedup
        await drawCurrentFrameDuringRec(canvas, {
          speaker: displayName,
          text: text.slice(0, charsShown),
          color: dialogColor,
          isNarration: false,
          fontStack,
        }, activeCharId);
        if (performance.now() - startMs >= totalDurationMs) break;
        await new Promise(r => requestAnimationFrame(r));
        updateRecTimer(startMs);
      }
      await drawCurrentFrameDuringRec(canvas, {
        speaker: displayName,
        text,
        color: dialogColor,
        isNarration: false,
        fontStack,
      }, activeCharId);
      lastFrameState = {
        dialog: { speaker: displayName, text, color: dialogColor, isNarration: false, fontStack },
        activeCharId,
      };
      await sleepWithTimer(recState.holdTime * 1000, startMs, totalDurationMs);
    } else if (ln.type === "narration") {
      const text = ln.text || "";
      const activeCharId = null;
      let charsShown = 0;
      let framesSinceLastChar = REC_MIN_FRAMES_PER_CHAR;
      const typeStart = performance.now();
      while (charsShown < text.length) {
        if (recState.stopRequested) break;
        framesSinceLastChar++;
        const elapsedType = performance.now() - typeStart;
        const timeBasedTarget = Math.floor(elapsedType / recState.typeSpeed);
        if (timeBasedTarget > charsShown && framesSinceLastChar >= REC_MIN_FRAMES_PER_CHAR) {
          charsShown++;
          framesSinceLastChar = 0;
        }
        await drawCurrentFrameDuringRec(canvas, {
          speaker: "",
          text: text.slice(0, charsShown),
          color: "#9a8aa8",
          isNarration: true,
        }, activeCharId);
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
      lastFrameState = {
        dialog: { speaker: "", text, color: "#9a8aa8", isNarration: true },
        activeCharId,
      };
      await sleepWithTimer(recState.holdTime * 1000, startMs, totalDurationMs);
    }
  }
  return lastFrameState;
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
    lightMode: state.stage.lightMode,
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
    lightMode: state.stage.lightMode,
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
  setSaveIndicator("dirty");
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

// apply ratio — prefer the explicitly remembered toggle, else restored/default
setRatio(localStorage.getItem(RATIO_KEY) || state.ratio || "16:9");
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
//  Script Editor — Unified Autocomplete & Keyboard Shortcuts
// ============================================================
// Single source of truth for the script editor's keyboard UX.
// Public surface:
//   ScriptEditor.refresh()  — re-detect popup context (used after
//                             external textarea mutations e.g. snippets)
//   ScriptEditor.isOpen()   — whether the popup is currently visible

window.ScriptEditor = (() => {
  const ta = els.scriptArea;

  // ---- shared constants ----
  const POS_SET = new Set(["左", "中", "右"]);
  const ALIAS_LEN = 8;
  const COMMAND_HEAD = /^\s*\[(bg|cg|選項|choices?|離場|無人|退場)/i;
  const isHide = (t) => t === "?" || t === "？" || t === "???" || /^[?？][:：]/.test(t);
  const isPos = (t) => POS_SET.has(t);

  // ---- HTML helpers ----
  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function highlightMatch(name, query) {
    if (!query) return escapeHtml(name);
    const idx = name.toLowerCase().indexOf(query.toLowerCase());
    if (idx < 0) return escapeHtml(name);
    return escapeHtml(name.slice(0, idx))
      + `<span class="se-ac-match">${escapeHtml(name.slice(idx, idx + query.length))}</span>`
      + escapeHtml(name.slice(idx + query.length));
  }

  // ---- module state ----
  const S = {
    popup: null,
    items: [],
    selectedIdx: 0,
    context: null,
    autoInserted: null,   // { start, end } — what an Esc would undo
  };

  // ---- line helpers ----
  function getLine(pos) {
    pos = pos == null ? ta.selectionStart : pos;
    const t = ta.value;
    const ls = t.lastIndexOf("\n", pos - 1) + 1;
    const i = t.indexOf("\n", pos);
    const le = i < 0 ? t.length : i;
    return { ls, le, content: t.slice(ls, le), pos };
  }

  // ============================================================
  //  Keyword expansion (line-head shortcuts)
  // ============================================================
  // cursor: integer = absolute index within insertion; null = end of insertion.
  const EXPANSIONS = [
    { match: /^(bg|BG|Bg|bG)$/,                          expand: "[bg: ]",          cursor: 5  },
    { match: /^(cg|CG|Cg|cG)$/,                          expand: "[cg: ]",          cursor: 5  },
    { match: /^(cgf|CGF|cgfull|cgFull|CGFull|CGFULL)$/,  expand: "[cg full: ]",     cursor: 10 },
    { match: /^(cgs|CGS|cgsolo|cgSolo|CGSolo|CGSOLO)$/,  expand: "[cg solo: ]",     cursor: 10 },
    { match: /^(cgoff|CGOFF|CGoff|cgOff)$/,              expand: "[cg off]",        cursor: null },
    { match: /^(離場|退場|無人|退|離|exit|EXIT)$/,         expand: "[離場]",          cursor: null },
    { match: /^(選項|opt|OPT|Opt|choice)$/,              expand: "[選項]\n- \n- \n- * ", cursor: 9 },
    { match: /^(聚光|spot|SPOT|Spot)$/,                   expand: "[聚光]",          cursor: null },
    { match: /^(同亮|all|ALL|allon|alllit)$/i,            expand: "[同亮]",          cursor: null },
    { match: /^(全暗|dim|DIM|alldim)$/i,                  expand: "[全暗]",          cursor: null },
    { match: /^[?？]$/,                                    expand: "[?]",             cursor: null },
  ];

  function tryExpandKeyword() {
    const { ls, le, content, pos } = getLine();
    if (pos !== le) return false;
    const trimmed = content.trim();
    for (const rule of EXPANSIONS) {
      if (!rule.match.test(trimmed)) continue;
      const insertion = rule.expand;
      ta.value = ta.value.slice(0, ls) + insertion + ta.value.slice(le);
      state.script = ta.value;
      const cursorPos = rule.cursor == null ? ls + insertion.length : ls + rule.cursor;
      ta.focus();
      ta.setSelectionRange(cursorPos, cursorPos);
      reparseAndRender(false);
      saveToStorage();
      refresh();
      return true;
    }
    return false;
  }

  // ============================================================
  //  Context detection (what should the popup show, if anything)
  // ============================================================
  function detectContext() {
    const pos = ta.selectionStart;
    if (pos !== ta.selectionEnd) return null;
    const text = ta.value;
    const ls = text.lastIndexOf("\n", pos - 1) + 1;
    const i = text.indexOf("\n", pos);
    const le = i < 0 ? text.length : i;
    const beforeCursor = text.slice(ls, pos);
    const afterCursor = text.slice(pos, le);

    // 1) Inside [bg: …] / [cg: …] / [cg full: …] — asset picker
    const assetMatch = beforeCursor.match(/\[(bg|cg(?:\s+full)?)\s*:\s*([^\]\n]*)$/i);
    if (assetMatch) {
      const tag = assetMatch[1].toLowerCase().replace(/\s+/g, " ");
      const type = tag === "bg" ? "bg" : "cg";
      const query = assetMatch[2];
      const closing = afterCursor.match(/^([^\]\n]*)/);
      const queryEnd = pos + (closing ? closing[1].length : 0);
      return {
        kind: "asset",
        type,
        query,
        replaceStart: pos - query.length,
        replaceEnd: queryEnd,
      };
    }

    // 1b) Inside [字體: …] — font picker
    const fontMatch = beforeCursor.match(/\[字體\s*[:：]\s*([^\]\n]*)$/);
    if (fontMatch) {
      const query = fontMatch[1];
      const closing = afterCursor.match(/^([^\]\n]*)/);
      const queryEnd = pos + (closing ? closing[1].length : 0);
      return {
        kind: "font",
        query,
        replaceStart: pos - query.length,
        replaceEnd: queryEnd,
      };
    }

    // 2) Inside `[…]` on a speaker line
    const inBracket = detectInBracket(ls, beforeCursor, afterCursor, pos);
    if (inBracket) return inBracket;

    // 3) Typing a name at line head (no `[`, no `:`)
    if (!/[\[\]:：]/.test(beforeCursor) && !COMMAND_HEAD.test(beforeCursor)
        && !/^\s*[-－]/.test(beforeCursor) && !/^\s*\/\//.test(beforeCursor)) {
      const nameMatch = beforeCursor.match(/^(\s*)([^\s][^\[\]:：\n]*?)$/);
      if (nameMatch) {
        return {
          kind: "char",
          query: nameMatch[2].trim(),
          replaceStart: ls + nameMatch[1].length,
          replaceEnd: pos,
        };
      }
    }

    return null;
  }

  function detectInBracket(ls, beforeCursor, afterCursor, pos) {
    let depth = 0, openIdx = -1;
    for (let i = beforeCursor.length - 1; i >= 0; i--) {
      const ch = beforeCursor[i];
      if (ch === "]") depth++;
      else if (ch === "[") { if (depth === 0) { openIdx = i; break; } depth--; }
    }
    if (openIdx < 0) return null;

    if (COMMAND_HEAD.test(beforeCursor)) return null;
    if (/^\s*[-－]/.test(beforeCursor)) return null;
    if (/^\s*\/\//.test(beforeCursor)) return null;

    const head = beforeCursor.slice(0, openIdx);
    if (/[:：]/.test(head)) return null;

    const headMatch = head.match(/^(\s*)([^\[\]:：\n]*?)((?:\[[^\]]*\])*)\s*$/);
    if (!headMatch) return null;
    const name = headMatch[2].trim();
    if (!name) return null;

    const completedTags = [...(headMatch[3] || "").matchAll(/\[([^\]]*)\]/g)].map(t => t[1].trim());
    const matchedChar = state.characters.find(c => c.name === name) || null;
    const knownEmotions = (matchedChar && matchedChar.emotions) || [];

    const hasEmotion = completedTags.some(t => !isPos(t) && !isHide(t));
    const hasPosition = completedTags.some(isPos);

    const query = beforeCursor.slice(openIdx + 1);
    const closing = afterCursor.match(/^([^\]\n]*)/);
    const queryEnd = pos + (closing ? closing[1].length : 0);

    if (/^[?？][:：]/.test(query)) {
      return {
        kind: "alias-input",
        name, matchedChar, knownEmotions, completedTags,
        query: query.slice(2),
        replaceStart: ls + openIdx + 1,
        replaceEnd: queryEnd,
        bracketStart: ls + openIdx,
      };
    }

    let slot;
    if (/^[?？]/.test(query)) slot = "hide";
    else if (!hasEmotion) slot = "emotion";
    else if (!hasPosition) slot = "position";
    else slot = "alias-hide";

    return {
      kind: "in-bracket",
      slot,
      name, matchedChar, knownEmotions, completedTags,
      hasEmotion, hasPosition,
      query,
      replaceStart: ls + openIdx + 1,
      replaceEnd: queryEnd,
      bracketStart: ls + openIdx,
    };
  }

  // ============================================================
  //  Suggestion builders
  // ============================================================
  function buildSuggestions(ctx) {
    if (ctx.kind === "char") return suggestChars(ctx.query);
    if (ctx.kind === "asset") return suggestAssets(ctx.type, ctx.query);
    if (ctx.kind === "font") return suggestFonts(ctx.query);
    if (ctx.kind === "in-bracket") return suggestInBracket(ctx);
    if (ctx.kind === "alias-input") return suggestAliasInput(ctx);
    return [];
  }

  function fuzzyScore(name, q) {
    if (!q) return 0;
    const a = name.toLowerCase(), b = q.toLowerCase();
    if (a === b || name === q) return 0;
    if (a.startsWith(b) || name.startsWith(q)) return 1;
    if (a.includes(b) || name.includes(q)) return 2;
    return -1;
  }

  function suggestChars(query) {
    const out = [];
    for (const ch of state.characters) {
      if (!ch.name) continue;
      const score = fuzzyScore(ch.name, query);
      if (score < 0) continue;
      const dotHtml = ch.color ? `<span class="se-ac-dot" style="color:${ch.color}">●</span>` : "";
      out.push({
        kind: "char",
        label: ch.name,
        sub: dotHtml + (ch.kind === "protagonist" ? ' <span class="se-ac-tag">主角</span>' : ""),
        insert: ch.name,
        score,
        ch,
      });
    }
    out.sort((a, b) => a.score - b.score || a.label.localeCompare(b.label, "zh"));
    return out.slice(0, 12);
  }

  function listAssets(type) {
    if (type === "bg") return Object.keys(state.backgrounds || {}).filter(k => k !== "default");
    return Object.keys(state.cgs || {});
  }
  function suggestAssets(type, query) {
    const out = [];
    for (const name of listAssets(type)) {
      const score = fuzzyScore(name, query);
      if (score < 0) continue;
      out.push({ kind: "asset", label: name, insert: name, score });
    }
    out.sort((a, b) => a.score - b.score || a.label.localeCompare(b.label, "zh"));
    return out.slice(0, 12);
  }

  function suggestFonts(query) {
    const q = (query || "").trim().toLowerCase();
    const out = [];
    for (const f of FONT_PRESETS) {
      if (f.id === "default") continue;  // 不列「標準」
      if (q && !(f.name.includes(query.trim()) || f.id.includes(q))) continue;
      out.push({ kind: "font", label: f.name, sub: f.id, insert: f.name, score: 0 });
    }
    return out;
  }

  function suggestInBracket(ctx) {
    const items = [];
    const q = ctx.query.trim();
    const used = new Set(ctx.completedTags);

    if (ctx.slot === "emotion") {
      if (ctx.matchedChar) {
        for (const emo of ctx.knownEmotions) {
          if (used.has(emo)) continue;
          const score = fuzzyScore(emo, q);
          if (score < 0) continue;
          items.push({ kind: "emotion", label: emo, insert: emo, score });
        }
        items.sort((a, b) => a.score - b.score);
        if (q && !ctx.knownEmotions.some(e => e === q || e.toLowerCase() === q.toLowerCase())) {
          items.push({ kind: "emotion-new", label: `新表情「${q}」`, sub: "建立新表情", insert: q, score: 90 });
        }
      } else if (q) {
        items.push({ kind: "emotion-new", label: `表情「${q}」`, insert: q });
      }
      items.push({ kind: "hide", label: "[?] 隱藏真名", sub: "顯示 ???", insert: "?", score: 95 });
      items.push({ kind: "alias-prompt", label: "[?:] 輸入別名", sub: "顯示替代名", insert: "?:", keepInside: true, score: 96 });
      items.push({ kind: "font-open", label: "[字體:] 指定字體", sub: "選字體", insert: "字體:", keepInside: true, score: 97 });
    } else if (ctx.slot === "position") {
      for (const p of ["左", "中", "右"]) {
        if (used.has(p)) continue;
        if (!q || p === q || p.includes(q)) items.push({ kind: "position", label: p, insert: p });
      }
      items.push({ kind: "hide", label: "[?] 隱藏真名", sub: "顯示 ???", insert: "?", score: 95 });
      items.push({ kind: "alias-prompt", label: "[?:] 輸入別名", sub: "顯示替代名", insert: "?:", keepInside: true, score: 96 });
      items.push({ kind: "font-open", label: "[字體:] 指定字體", sub: "選字體", insert: "字體:", keepInside: true, score: 97 });
    } else if (ctx.slot === "alias-hide" || ctx.slot === "hide") {
      items.push({ kind: "hide", label: "[?]", sub: "隱藏真名（顯示 ???）", insert: "?" });
      items.push({ kind: "alias-prompt", label: "[?:]", sub: "輸入別名", insert: "?:", keepInside: true });
      items.push({ kind: "font-open", label: "[字體:]", sub: "指定字體", insert: "字體:", keepInside: true });
    }
    return items;
  }

  function suggestAliasInput(ctx) {
    const q = ctx.query;
    if (!q.trim()) {
      return [{ kind: "alias-hint", label: "輸入要顯示的替代名…", sub: "按 ] 結束", insert: null, nonAcceptable: true }];
    }
    return [{
      kind: "alias-preview",
      label: `「${q}」`,
      sub: "對話框顯示為此",
      insert: q.trim(),
    }];
  }

  // ============================================================
  //  Popup UI
  // ============================================================
  function show(ctx) {
    hide();
    const items = buildSuggestions(ctx);
    if (items.length === 0) return;
    S.items = items;
    S.context = ctx;
    S.selectedIdx = items.findIndex(it => !it.nonAcceptable);
    if (S.selectedIdx < 0) S.selectedIdx = 0;

    const popup = document.createElement("div");
    popup.className = "se-ac-popup";
    S.popup = popup;

    items.forEach((it, idx) => {
      const el = document.createElement("div");
      el.className = "se-ac-item" + (idx === S.selectedIdx ? " selected" : "");
      if (it.nonAcceptable) el.classList.add("non-acceptable");
      el.dataset.idx = idx;
      const labelHtml = ctx.query
        ? highlightMatch(it.label, ctx.query)
        : escapeHtml(it.label);
      const subHtml = it.sub ? `<span class="se-ac-sub">${it.sub}</span>` : "";
      el.innerHTML = `<span class="se-ac-label">${labelHtml}</span>${subHtml}`;
      el.addEventListener("mouseenter", () => {
        if (it.nonAcceptable) return;
        S.selectedIdx = idx;
        refreshSelected();
      });
      el.addEventListener("mousedown", (ev) => {
        if (it.nonAcceptable) return;
        ev.preventDefault();
        S.selectedIdx = idx;
        accept(true);
      });
      popup.appendChild(el);
    });

    document.body.appendChild(popup);
    positionPopup();
    requestAnimationFrame(positionPopup);
  }

  function refreshSelected() {
    if (!S.popup) return;
    S.popup.querySelectorAll(".se-ac-item").forEach((el, i) => {
      el.classList.toggle("selected", i === S.selectedIdx);
    });
  }

  function move(delta) {
    if (!S.popup) return;
    const n = S.items.length;
    if (n === 0) return;
    let idx = S.selectedIdx;
    for (let k = 0; k < n; k++) {
      idx = (idx + delta + n) % n;
      if (!S.items[idx].nonAcceptable) {
        S.selectedIdx = idx;
        refreshSelected();
        return;
      }
    }
  }

  function hide() {
    if (S.popup) { S.popup.remove(); S.popup = null; }
    S.items = []; S.selectedIdx = 0; S.context = null;
  }

  function isOpen() { return S.popup != null; }

  function caretCoords() {
    const cs = window.getComputedStyle(ta);
    const div = document.createElement("div");
    const props = [
      "boxSizing","width","height","overflowX","overflowY",
      "borderTopWidth","borderRightWidth","borderBottomWidth","borderLeftWidth","borderStyle",
      "paddingTop","paddingRight","paddingBottom","paddingLeft",
      "fontStyle","fontVariant","fontWeight","fontStretch","fontSize",
      "lineHeight","fontFamily","textAlign","textTransform","textIndent",
      "letterSpacing","wordSpacing","tabSize","MozTabSize","whiteSpace","wordWrap",
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
    const lineHeight = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.4;
    document.body.removeChild(div);
    return {
      top: taRect.top + offsetTop - ta.scrollTop,
      left: taRect.left + offsetLeft - ta.scrollLeft,
      lineHeight,
    };
  }

  function positionPopup() {
    if (!S.popup) return;
    const c = caretCoords();
    const popupRect = S.popup.getBoundingClientRect();
    let top = c.top + c.lineHeight + 4;
    let left = c.left;
    if (top + popupRect.height > window.innerHeight - 8) top = c.top - popupRect.height - 4;
    if (left + popupRect.width > window.innerWidth - 8) left = window.innerWidth - popupRect.width - 8;
    S.popup.style.top = Math.max(8, top) + "px";
    S.popup.style.left = Math.max(8, left) + "px";
  }

  // ============================================================
  //  Accept
  //   stayInField = true  → Enter / mouse-click: accept and stop
  //   stayInField = false → Tab: accept and try to advance to next field
  // ============================================================
  function accept(stayInField) {
    if (!S.popup) return false;
    const item = S.items[S.selectedIdx];
    const ctx = S.context;
    if (!item || item.nonAcceptable || !ctx) { hide(); return false; }

    if (ctx.kind === "char") {
      const text = ta.value;
      const before = text.slice(0, ctx.replaceStart);
      const after = text.slice(ctx.replaceEnd);
      const insertion = item.insert + "[]";
      ta.value = before + insertion + after;
      state.script = ta.value;
      const inside = ctx.replaceStart + item.insert.length + 1;
      ta.focus();
      ta.setSelectionRange(inside, inside);
      hide();
      reparseAndRender(false);
      saveToStorage();
      refresh();
      return true;
    }

    if (ctx.kind === "asset" || ctx.kind === "font") {
      const text = ta.value;
      ta.value = text.slice(0, ctx.replaceStart) + item.insert + text.slice(ctx.replaceEnd);
      state.script = ta.value;
      let newPos = ctx.replaceStart + item.insert.length;
      if (ta.value[newPos] === "]") newPos += 1;  // step past closing bracket
      ta.focus();
      ta.setSelectionRange(newPos, newPos);
      hide();
      reparseAndRender(false);
      saveToStorage();
      return true;
    }

    if (ctx.kind === "in-bracket") {
      const text = ta.value;
      ta.value = text.slice(0, ctx.replaceStart) + item.insert + text.slice(ctx.replaceEnd);
      state.script = ta.value;
      let newPos = ctx.replaceStart + item.insert.length;
      const closeChar = ta.value[newPos] === "]";
      const isHideFinal = item.kind === "hide";

      if (!item.keepInside && closeChar) {
        newPos += 1;
        if (!stayInField && !isHideFinal) {
          const nextSlot = afterPlacement(ctx, item);
          if (nextSlot) {
            ta.value = ta.value.slice(0, newPos) + "[]" + ta.value.slice(newPos);
            state.script = ta.value;
            newPos += 1;
          }
        }
      }
      ta.focus();
      ta.setSelectionRange(newPos, newPos);
      hide();
      reparseAndRender(false);
      saveToStorage();
      refresh();
      return true;
    }

    if (ctx.kind === "alias-input") {
      const text = ta.value;
      const closeIdx = text.indexOf("]", ctx.replaceEnd);
      const closeAt = closeIdx === -1 ? text.length : closeIdx;
      const aliasText = item.insert == null ? "" : item.insert;
      const headEnd = ctx.bracketStart + 3;
      ta.value = text.slice(0, headEnd) + aliasText + text.slice(closeAt);
      state.script = ta.value;
      let newPos = headEnd + aliasText.length;
      if (ta.value[newPos] === "]") newPos += 1;
      ta.focus();
      ta.setSelectionRange(newPos, newPos);
      hide();
      reparseAndRender(false);
      saveToStorage();
      refresh();
      return true;
    }
    return false;
  }

  function afterPlacement(ctx, item) {
    if (item.kind === "emotion" || item.kind === "emotion-new") return "position";
    return null;
  }

  // ============================================================
  //  Tab logic
  // ============================================================
  function handleTab(e) {
    if (isOpen()) {
      e.preventDefault();
      accept(false);
      return;
    }
    if (tryExpandKeyword()) { e.preventDefault(); return; }
    if (tryAppendColon()) { e.preventDefault(); return; }
    if (tryRepeatPrefix()) { e.preventDefault(); return; }
    e.preventDefault();
  }

  function tryAppendColon() {
    const { ls, le, content, pos } = getLine();
    if (pos !== le) return false;
    if (/[:：]/.test(content)) return false;
    if (COMMAND_HEAD.test(content)) return false;
    if (!/^\s*[^\[\]:：\n]+(?:\[[^\]\n]*\])+\s*$/.test(content)) return false;
    ta.value = ta.value.slice(0, le) + "：" + ta.value.slice(le);
    state.script = ta.value;
    ta.setSelectionRange(le + 1, le + 1);
    reparseAndRender(false);
    saveToStorage();
    return true;
  }

  function tryRepeatPrefix() {
    const { ls, content, pos } = getLine();
    if (content.trim() !== "") return false;
    const above = ta.value.slice(0, ls).split("\n");
    let prefix = null;
    for (let i = above.length - 1; i >= 0; i--) {
      const m = above[i].match(/^(\s*[^\[\]:：\n]+(?:\[[^\]\n]*\])+)\s*[:：]/);
      if (m) { prefix = m[1]; break; }
    }
    if (!prefix) return false;
    const insertion = prefix + "：";
    ta.value = ta.value.slice(0, pos) + insertion + ta.value.slice(pos);
    state.script = ta.value;
    const np = pos + insertion.length;
    ta.setSelectionRange(np, np);
    S.autoInserted = { start: pos, end: np };
    reparseAndRender(false);
    saveToStorage();
    return true;
  }

  // ============================================================
  //  Enter logic
  // ============================================================
  function handleEnter(e) {
    if (isOpen()) {
      e.preventDefault();
      accept(true);
      return;
    }
    const { ls, le, content, pos } = getLine();
    if (pos !== le) return;

    if (/^\s*\[選項\]\s*$/.test(content)) {
      e.preventDefault();
      insertAndTrack("\n- ");
      return;
    }

    const choiceFull = content.match(/^(\s*)([-－])\s+(\*\s+)?(\S.*)$/);
    if (choiceFull) {
      e.preventDefault();
      insertAndTrack(`\n${choiceFull[1]}- `);
      return;
    }

    const emptyChoice = content.match(/^(\s*)([-－])\s*$/);
    if (emptyChoice) {
      const indent = emptyChoice[1];
      e.preventDefault();
      ta.value = ta.value.slice(0, ls) + indent + "\n" + ta.value.slice(le);
      state.script = ta.value;
      const np = ls + indent.length + 1;
      ta.setSelectionRange(np, np);
      reparseAndRender(false);
      saveToStorage();
      return;
    }

    // Current line is dialog → carry prefix onto the new line.
    // (The spec's "上一行也是對話" condition: viewed from the new line, the
    // previous line is the line we're pressing Enter on — so the test is
    // simply "current line is dialog".)
    const dialogMatch = content.match(/^(\s*[^\[\]:：\n]+(?:\[[^\]\n]*\])+)\s*[:：]/);
    if (dialogMatch) {
      const prefix = dialogMatch[1];
      e.preventDefault();
      const insertion = `\n${prefix}：`;
      ta.value = ta.value.slice(0, pos) + insertion + ta.value.slice(pos);
      state.script = ta.value;
      const np = pos + insertion.length;
      ta.setSelectionRange(np, np);
      S.autoInserted = { start: pos, end: np };
      reparseAndRender(false);
      saveToStorage();
      return;
    }
  }

  function insertAndTrack(text) {
    const pos = ta.selectionStart;
    ta.value = ta.value.slice(0, pos) + text + ta.value.slice(pos);
    state.script = ta.value;
    const np = pos + text.length;
    ta.setSelectionRange(np, np);
    S.autoInserted = { start: pos, end: np };
    reparseAndRender(false);
    saveToStorage();
  }

  // ============================================================
  //  Esc logic
  // ============================================================
  function handleEsc(e) {
    if (isOpen()) { e.preventDefault(); hide(); return; }
    if (S.autoInserted) {
      const { start, end } = S.autoInserted;
      const cur = ta.selectionStart;
      if (cur === end) {
        e.preventDefault();
        ta.value = ta.value.slice(0, start) + ta.value.slice(end);
        state.script = ta.value;
        ta.setSelectionRange(start, start);
        S.autoInserted = null;
        reparseAndRender(false);
        saveToStorage();
      }
    }
  }

  // ============================================================
  //  Ctrl/Cmd + Backspace
  // ============================================================
  function handleCtrlBackspace(e) {
    const pos = ta.selectionStart;
    if (pos === 0) return;
    const text = ta.value;

    if (text[pos - 1] === "]") {
      let depth = 1, openAt = -1;
      for (let i = pos - 2; i >= 0; i--) {
        const ch = text[i];
        if (ch === "\n") break;
        if (ch === "]") depth++;
        else if (ch === "[") { depth--; if (depth === 0) { openAt = i; break; } }
      }
      if (openAt < 0) return;
      let trimAt = openAt;
      while (trimAt > 0 && text[trimAt - 1] !== "\n" && /\s/.test(text[trimAt - 1])) trimAt--;
      e.preventDefault();
      ta.value = text.slice(0, trimAt) + text.slice(pos);
      state.script = ta.value;
      ta.setSelectionRange(trimAt, trimAt);
      reparseAndRender(false);
      saveToStorage();
      return;
    }

    const lineStart = text.lastIndexOf("\n", pos - 1) + 1;
    let depth = 0, openAt = -1;
    for (let i = pos - 1; i >= lineStart; i--) {
      const ch = text[i];
      if (ch === "]") depth++;
      else if (ch === "[") { if (depth === 0) { openAt = i; break; } depth--; }
    }
    if (openAt < 0) return;
    let d2 = 1, closeAt = -1;
    for (let i = pos; i < text.length; i++) {
      const ch = text[i];
      if (ch === "\n") break;
      if (ch === "[") d2++;
      else if (ch === "]") { d2--; if (d2 === 0) { closeAt = i; break; } }
    }
    if (closeAt < 0) return;
    let trimAt = openAt;
    while (trimAt > 0 && text[trimAt - 1] !== "\n" && /\s/.test(text[trimAt - 1])) trimAt--;
    e.preventDefault();
    ta.value = text.slice(0, trimAt) + text.slice(closeAt + 1);
    state.script = ta.value;
    ta.setSelectionRange(trimAt, trimAt);
    reparseAndRender(false);
    saveToStorage();
  }

  // ============================================================
  //  `[` auto-pair / `]` smart skip
  // ============================================================
  function handleOpenBracket(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return false;
    const pos = ta.selectionStart;
    if (pos !== ta.selectionEnd) return false;
    const { content } = getLine();
    if (COMMAND_HEAD.test(content)) return false;
    if (/^\s*\/\//.test(content)) return false;
    e.preventDefault();
    const text = ta.value;
    ta.value = text.slice(0, pos) + "[]" + text.slice(pos);
    state.script = ta.value;
    ta.setSelectionRange(pos + 1, pos + 1);
    reparseAndRender(false);
    saveToStorage();
    refresh();
    return true;
  }

  function handleCloseBracket(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return false;
    const pos = ta.selectionStart;
    if (pos !== ta.selectionEnd) return false;
    if (ta.value[pos] !== "]") return false;
    e.preventDefault();
    ta.setSelectionRange(pos + 1, pos + 1);
    return true;
  }

  // ============================================================
  //  Public refresh
  // ============================================================
  function refresh() {
    const ctx = detectContext();
    if (!ctx) { hide(); return; }
    show(ctx);
  }

  // ============================================================
  //  Wire up
  // ============================================================
  function init() {
    ta.addEventListener("input", () => {
      S.autoInserted = null;
      refresh();
    });
    ta.addEventListener("click", refresh);
    ta.addEventListener("keyup", (e) => {
      // Cursor moves (L/R/Home/End) always refresh — even while popup is open,
      // so it can close or re-anchor as the caret moves out of context.
      // Up/Down are popup nav while open; only refresh when no popup.
      if (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "Home" || e.key === "End") {
        refresh();
      } else if ((e.key === "ArrowUp" || e.key === "ArrowDown") && !isOpen()) {
        refresh();
      }
    });
    ta.addEventListener("blur", () => setTimeout(hide, 150));

    ta.addEventListener("keydown", (e) => {
      if (e.key === "Backspace" && (e.ctrlKey || e.metaKey) && !e.altKey) {
        handleCtrlBackspace(e);
        return;
      }
      if (isOpen() && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
        e.preventDefault();
        move(e.key === "ArrowDown" ? 1 : -1);
        return;
      }
      if (e.key === "Tab" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (e.shiftKey) { e.preventDefault(); return; }
        handleTab(e);
        return;
      }
      if (e.key === "Enter" && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
        handleEnter(e);
        return;
      }
      if (e.key === "Escape") {
        handleEsc(e);
        return;
      }
      if (e.key === "[") { handleOpenBracket(e); return; }
      if (e.key === "]") { handleCloseBracket(e); return; }
    });

    window.addEventListener("scroll", () => { if (isOpen()) positionPopup(); }, true);
    window.addEventListener("resize", () => { if (isOpen()) positionPopup(); });
  }

  init();

  return { refresh, isOpen, hide };
})();
