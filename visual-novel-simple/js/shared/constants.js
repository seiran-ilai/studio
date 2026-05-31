// shared/constants.js — 由 index.js 搬出(階段 3-A),內容未改動

const SAMPLE_SCRIPT = `[bg: 黃昏]
放學後的圖書館,夕陽透過窗戶灑進來。

(好安靜,正適合一個人發呆。)

[學長][神秘][神祕旅人][右]:嗨,原來你也在這裡。
(這個聲音是?)
[我]:請問你是?
[學長][微笑][右]:是我啊。
[我][害羞]:學...學長!

[bg: 教室]
[學長][微笑][中]:要不要一起去買杯咖啡?

[辰宇落雁](怎麼辦,我該答應嗎?)

[選項]
- 好啊
- 改天吧
- * 我...我也喜歡你

[我][害羞][大]:我...我也喜歡你。

[cg: 告白]
這就是我們故事的開始。
[cg off]

[學長][微笑][右][粗]:以後也請多指教。

[離場]
(完)`;

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

const FONT_PRESETS = [
  {
    id: "default",
    name: "標準",
    stack: null,  // null = 使用 textarea 預設(var(--font-body))
    weight: null,
    preview: "預設字體,適合一般對話。",
  },
  {
    id: "luoyan",
    name: "辰宇落雁",
    stack: '"ChenYuluoyan", "Klee One", cursive',
    weight: null,
    preview: "夕陽透過窗戶灑進來。",
  },
  {
    id: "serif",
    name: "明體",
    stack: '"Noto Serif TC", "Noto Serif JP", serif',
    weight: null,
    preview: "夕陽透過窗戶灑進來。",
  },
  {
    id: "sans",
    name: "黑體",
    stack: '"GenYoGothic", "Noto Sans TC", "Noto Sans JP", sans-serif',
    weight: null,
    preview: "夕陽透過窗戶灑進來。",
  },
  {
    id: "round",
    name: "粉圓",
    stack: '"jf-openhuninn-2.1", "Zen Maru Gothic", sans-serif',
    weight: null,
    preview: "夕陽透過窗戶灑進來。",
  },
  {
    id: "iansui",
    name: "芫荽",
    stack: '"Iansui", "Klee One", serif',
    weight: null,
    preview: "夕陽透過窗戶灑進來。",
  },
  {
    id: "marker",
    name: "麥克黑",
    stack: '"Noto Sans TC", "Noto Sans JP", sans-serif',
    weight: 900,  // ★ 用 Noto Sans TC 900 字重替代
    preview: "夕陽透過窗戶灑進來。",
  },
  {
    id: "pixel",
    name: "點陣",
    stack: '"DotGothic16", monospace',
    weight: null,
    preview: "夕陽透過窗戶灑進來。",
  },
];

const FONT_BY_NAME = Object.fromEntries(FONT_PRESETS.map(f => [f.name, f]));

const FONT_BY_ID = Object.fromEntries(FONT_PRESETS.map(f => [f.id, f]));

const STYLE_TAG_ALIASES = {
  // 字體
  "辰宇落雁": { kind: "font", value: "luoyan" },
  "落雁": { kind: "font", value: "luoyan" },  // 短別名
  "明體": { kind: "font", value: "serif" },
  "黑體": { kind: "font", value: "sans" },
  "粉圓": { kind: "font", value: "round" },
  "芫荽": { kind: "font", value: "iansui" },
  "麥克黑": { kind: "font", value: "marker" },
  "點陣": { kind: "font", value: "pixel" },
  // 大小
  "大": { kind: "size", value: "large" },
  "小": { kind: "size", value: "small" },
  // 粗體
  "粗": { kind: "bold", value: true },
  "B": { kind: "bold", value: true },
  "b": { kind: "bold", value: true },
  // 斜體
  "斜": { kind: "italic", value: true },
  "I": { kind: "italic", value: true },
  "i": { kind: "italic", value: true },
};

const STYLE_TAG_NAMES = new Set(Object.keys(STYLE_TAG_ALIASES));

const FONT_TAG_NAMES = ["辰宇落雁", "明體", "黑體", "粉圓", "芫荽", "麥克黑", "點陣"];

const SIZE_TAG_NAMES = ["大", "小"];

const EMPHASIS_TAG_NAMES = ["粗", "斜"];

// textSpeed:全域文字速度 0~100,50 為中等(預設,接近原打字機速度)。見 getTextSpeedPerChar。
const DEFAULT_DIALOG_STYLE = { shape: "classic", color: "#0d0716", opacity: 0.88, textSpeed: 50 };

const DIALOG_SHAPES = [
  { id: "classic", name: "經典金邊", desc: "直角金邊矩形" },
  { id: "soft",    name: "柔和圓角", desc: "大圓角、無邊框" },
  { id: "window",  name: "雙線窗格", desc: "上下雙線" },
];

const DIALOG_SHAPE_IDS = new Set(DIALOG_SHAPES.map(s => s.id));

const STYLE_PRESETS = {
  coffeeShop: {
    name: "COFFEE SHOP",
    uiPreset: "cafeReceipt",
    animationId: "coffee",
    variants: {
      latte: {
        name: "Latte",
        isDefault: true,
        dialog: { shape: "soft", bgColor: "#f4e8d4", borderColor: "#a87850", borderWidth: 0.8, borderRadius: 20, opacity: 1 },
        speaker: { color: "#5d4030", fontStack: '"Noto Sans TC", sans-serif', fontSize: 16, weight: 500 },
        dialogText: { color: "#3a2818", fontStack: '"Noto Sans TC", sans-serif', fontSize: 14 },
        stageBg: { base: "linear-gradient(135deg,#3a2818,#2a1a0a)" },
      },
      espresso: {
        name: "Espresso",
        dialog: { shape: "soft", bgColor: "#2a1810", borderColor: "#8b5a2b", borderWidth: 0.8, borderRadius: 20, opacity: 1 },
        speaker: { color: "#d4a574", fontStack: '"Noto Sans TC", sans-serif', fontSize: 16, weight: 500 },
        dialogText: { color: "#f0e0c8", fontStack: '"Noto Sans TC", sans-serif', fontSize: 14 },
        stageBg: { base: "linear-gradient(135deg,#0f0805,#1a0d05)" },
      },
    },
  },
};

const UI_PRESETS = {
  cyberHud: {
    name: "Cyber HUD",
    elements: { chapter: true, love: true, autoskip: true },
    chapter: { color: "#ff00ff", fontStack: "monospace", fontSize: 12, letterSpacing: "2px", prefix: "> ", suffix: ".exe" },
    love: { iconColor: "#ff00ff", barFg: "linear-gradient(90deg,#ff00ff,#00fff0)", barBg: "#000", barBorder: "#00fff0", labelColor: "#00fff0", icon: "LV" },
    autoskip: { skipBg: "#000", skipBorder: "#ff00ff", skipColor: "#ff00ff", autoBg: "rgba(0,255,240,0.2)", autoBorder: "#00fff0", autoColor: "#00fff0", fontStack: "monospace" },
  },
  cafeReceipt: {
    name: "Cafe Receipt",
    elements: { chapter: true, love: true, autoskip: false },
    chapter: { color: "#f0e0c8", fontStack: "monospace", fontSize: 13, letterSpacing: "2px", prefix: "❀ ", suffix: " ❀" },
    love: { iconColor: "#d4a878", barFg: "#8b5a2b", barBg: "rgba(255,255,255,0.1)", labelColor: "#f0e0c8", icon: "♡" },
  },
  novel: {
    name: "Novel",
    elements: { chapter: true, love: true, autoskip: false },
    chapter: { color: "#f0e0c8", fontStack: '"Cormorant Garamond",serif', fontStyle: "italic", fontSize: 14, letterSpacing: "1px", prefix: "❀ ", suffix: " ❀" },
    love: { iconColor: "#f0a8c0", barFg: "linear-gradient(90deg,#a83246,#f0a8c0)", barBg: "rgba(255,255,255,0.2)", labelColor: "#f0a8c0", icon: "♡" },
  },
  phoneStatus: {
    name: "Phone Status",
    elements: { chapter: true, love: true, autoskip: false },
    chapter: { color: "#5a7090", fontStack: '"jf-openhuninn-2.1",sans-serif', fontSize: 13, weight: 500 },
    love: { iconColor: "#f09cb4", barFg: "#f09cb4", barBg: "rgba(90,112,144,0.2)", labelColor: "#5a7090", icon: "♡" },
  },
  rpgHud: {
    name: "RPG HUD",
    elements: { chapter: true, love: false, autoskip: true },
    chapter: { color: "#ffcc33", fontStack: '"Noto Sans TC",sans-serif', fontSize: 14, weight: 900, letterSpacing: "1px" },
    autoskip: { skipBg: "#0a1a0a", skipBorder: "#00ff7f", skipColor: "#00ff7f", autoBg: "#00ff7f", autoBorder: "#00ff7f", autoColor: "#0a1a0a", fontStack: "monospace", weight: 900 },
  },
  distortedHud: {
    name: "Distorted HUD",
    elements: { chapter: true, love: true, autoskip: false },
    chapter: { color: "#e8e8e0", shadowColor: "#a02030", fontStack: '"Noto Serif TC",serif', fontSize: 14, letterSpacing: "1px" },
    love: { iconColor: "#a02030", barFg: "#a02030", barBg: "rgba(255,255,255,0.1)", labelColor: "#a02030", icon: "♡" },
  },
};

const ANIMATION_PRESETS = {
  cyberpunk: { name: "Cyberpunk", enterClass: "anim-cyber-enter", persistClass: "anim-cyber-persist", cursorBlink: true },
  coffee:    { name: "Coffee",    enterClass: "anim-coffee-enter", persistClass: null },
  love:      { name: "Love",      enterClass: "anim-love-enter",   persistClass: null },
  daily:     { name: "Daily",     enterClass: "anim-daily-enter",  persistClass: null },
  gamer:     { name: "Gamer",     enterClass: "anim-gamer-enter",  persistClass: "anim-gamer-persist" },
  horror:    { name: "Horror",    enterClass: null,                persistClass: "anim-horror-persist", nameDisplace: true },
};

const LOVE_EXTREME_EFFECTS = {
  cyberpunk:    { full: { type: "screenFlash", color: "#00fff0", overlayText: "OVERLOAD",        textColor: "#ff00ff" }, empty: { type: "noiseStatic", duration: 2000, overlayText: "CONNECTION LOST", textColor: "#ff4080" } },
  coffeeShop:   { full: { type: "steam",       overlayText: "正好溫熱",   textColor: "#f0e0c8" },                         empty: { type: "emptyCup",   overlayText: "冷掉了...",         textColor: "#888888" } },
  loveLetter:   { full: { type: "petalsFall",  color: "#f0a8c0", count: 30 },                                              empty: { type: "inkBurn",     color: "#3a1a1a" } },
  dailyMessage: { full: { type: "heartsBurst", count: 8 },                                                                  empty: { type: "blockedText", overlayText: "對方已封鎖你" } },
  gamer:        { full: { type: "levelUp",     overlayText: "LEVEL UP!",   textColor: "#ffcc33" },                          empty: { type: "gameOver",    overlayText: "GAME OVER",         textColor: "#cc2244" } },
  horrorMovie:  { full: { type: "heartbeatFast", duration: 2000 },                                                         empty: { type: "flatline",    overlayText: "FLATLINE",          textColor: "#a02030" } },
};

const LIGHT_MODES = ["聚光", "同亮", "全暗"];

const DEFAULT_LIGHT_MODE = "聚光";

const DEFAULT_GAME_UI = {
  chapter:  { enabled: false, text: "第一章 — 序幕" },
  love:     { enabled: false, charId: null, value: 50 },
  autoSkip: { enabled: false },
};

export {
  SAMPLE_SCRIPT,
  SAMPLE_CHARACTERS,
  SAMPLE_BACKGROUNDS,
  FONT_PRESETS,
  FONT_BY_NAME,
  FONT_BY_ID,
  STYLE_TAG_ALIASES,
  STYLE_TAG_NAMES,
  FONT_TAG_NAMES,
  SIZE_TAG_NAMES,
  EMPHASIS_TAG_NAMES,
  DEFAULT_DIALOG_STYLE,
  DIALOG_SHAPES,
  DIALOG_SHAPE_IDS,
  STYLE_PRESETS,
  UI_PRESETS,
  ANIMATION_PRESETS,
  LOVE_EXTREME_EFFECTS,
  LIGHT_MODES,
  DEFAULT_LIGHT_MODE,
  DEFAULT_GAME_UI,
};
