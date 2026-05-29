// shared/state.js — 由 index.js 搬出(階段 3-B),內容未改動
// (拆檔需要:常數改以真正的 import 取得,確保 static import 下相依正確)
import {
  SAMPLE_CHARACTERS,
  SAMPLE_BACKGROUNDS,
  DEFAULT_DIALOG_STYLE,
  DEFAULT_GAME_UI,
  DEFAULT_LIGHT_MODE,
  DIALOG_SHAPE_IDS,
  STYLE_PRESETS,
} from "./constants.js";

function migrateDialogStyle(s) {
  const merged = { ...DEFAULT_DIALOG_STYLE, ...(s || {}) };
  if (!DIALOG_SHAPE_IDS.has(merged.shape)) merged.shape = "classic";
  return merged;
}

function getDefaultVariantId(styleId) {
  const style = STYLE_PRESETS[styleId];
  if (!style) return null;
  for (const [id, v] of Object.entries(style.variants)) {
    if (v.isDefault) return id;
  }
  return Object.keys(style.variants)[0];
}

function migrateStyle(s) {
  const out = { preset: "coffeeShop", variant: "latte", animationsEnabled: true, firstStyleSelected: false };
  if (s && typeof s === "object") {
    if (typeof s.preset === "string" && STYLE_PRESETS[s.preset]) out.preset = s.preset;
    if (typeof s.variant === "string"
        && (s.variant === "custom"
            || (STYLE_PRESETS[out.preset] && STYLE_PRESETS[out.preset].variants[s.variant]))) {
      out.variant = s.variant;
    } else {
      out.variant = getDefaultVariantId(out.preset);
    }
    if (typeof s.animationsEnabled === "boolean") out.animationsEnabled = s.animationsEnabled;
    if (typeof s.firstStyleSelected === "boolean") out.firstStyleSelected = s.firstStyleSelected;
  }
  return out;
}

function migrateCustomVariants(c) {
  const out = {};
  if (!c || typeof c !== "object") return out;
  for (const presetId of Object.keys(STYLE_PRESETS)) {
    const v = c[presetId];
    if (v && typeof v === "object"
        && typeof v.borderColor === "string"
        && typeof v.bgColor === "string"
        && typeof v.nameColor === "string"
        && typeof v.textColor === "string") {
      out[presetId] = {
        borderColor: v.borderColor,
        bgColor:     v.bgColor,
        bgOpacity:   typeof v.bgOpacity === "number"
                       ? Math.max(0, Math.min(1, v.bgOpacity))
                       : 0.9,
        nameColor:   v.nameColor,
        textColor:   v.textColor,
        basedOn:     (typeof v.basedOn === "string"
                       && STYLE_PRESETS[presetId].variants[v.basedOn])
                       ? v.basedOn
                       : getDefaultVariantId(presetId),
      };
    }
  }
  return out;
}

function migrateFontSizes(f) {
  // 四類獨立字級,範圍統一 12 ~ 32 pt
  const out = { dialog: 18, speaker: 16, narration: 16, inner: 15 };
  if (f && typeof f === "object") {
    const clamp = (v) => Math.max(12, Math.min(32, Math.round(v)));
    for (const k of Object.keys(out)) {
      const v = Number(f[k]);
      if (Number.isFinite(v)) out[k] = clamp(v);
    }
  }
  return out;
}

function migrateGameUI(g) {
  const out = JSON.parse(JSON.stringify(DEFAULT_GAME_UI));
  for (const k of Object.keys(DEFAULT_GAME_UI)) {
    out[k] = { ...DEFAULT_GAME_UI[k], ...((g && g[k]) || {}) };
  }
  return out;
}

function migrateCharacter(ch) {
  const c = { emotions: [], portraits: {}, ...ch };
  if (c.kind !== "protagonist" && c.kind !== "supporting") c.kind = "supporting";
  // 立繪取景設定(舊資料自動補預設 = 等同現況)
  c.portraitY = typeof c.portraitY === "number" ? c.portraitY : 0;
  c.portraitScale = typeof c.portraitScale === "number" ? c.portraitScale : 100;
  return c;
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
  // O5:全域預設樣式(沒寫樣式 tag 的行會自動套用)— 只剩字型,字級獨立到 fontSizes
  styleDefaults: {
    narration: { font: "" },
    inner:     { font: "luoyan" },
    dialog:    { font: "" },
  },
  // 四類獨立字級,單位 pt,範圍 12 ~ 32
  fontSizes: { dialog: 18, speaker: 16, narration: 16, inner: 15 },
  // Batch 2:風格組合(整套配色)
  style: { preset: "coffeeShop", variant: "latte", animationsEnabled: true, firstStyleSelected: false },
  // 6 個風格各一份自訂配色;空物件表示尚未初始化(第一次點該風格的「自訂」會以當下變體為起點建立)
  customVariants: {},
  // IndexedDB:當前編輯中的 project id。啟動時由 vnsEnsureDefaultProject 設定。
  currentProjectId: null,
  // 簡易模式 — 當前選中幕的 id(沒有就是 null,getCurrentSlide() 會自動取第一張)
  simpleCurrentSlideId: null,
  // Batch 3:好感度系統 — 每個角色獨立數值
  loveValues: {},     // { "學長": 50, ... } — runtime,由 computeStageStateAt 重算
  loveInitial: {},    // { "學長": 50, ... } — 角色卡設的初始值
  // Batch 4:模式 + 卡片資料
  mode: "simple",     // "simple" | "detail" — 細節版暫時隱藏入口,預設一律 simple
  simpleCards: [],    // [{ cgName, dialogs: [{ speaker, text }] }, ...]
  lightMode: DEFAULT_LIGHT_MODE,   // 全域目前模式
  // live stage state
  stage: {
    bg: "default",
    slots: { 左: null, 中: null, 右: null },
    cg: null,         // { name, hideDialog } or null
    lightMode: DEFAULT_LIGHT_MODE, // 舞台當前生效模式（會被劇本指令改變）
  }
};

function ensureProtagonistExists() {
  if (!state.characters.some(c => c.kind === "protagonist")) {
    state.characters.unshift({
      id: "protagonist_default",
      name: "我",
      kind: "protagonist",
      color: "#d4869a",
      emotions: [],
      portraits: {},
      portraitY: 0,
      portraitScale: 100,
    });
  }
}

function findCharacter(name) {
  return state.characters.find(c => c.name === name);
}

export {
  migrateDialogStyle,
  getDefaultVariantId,
  migrateStyle,
  migrateCustomVariants,
  migrateFontSizes,
  migrateGameUI,
  migrateCharacter,
  state,
  ensureProtagonistExists,
  findCharacter,
};
