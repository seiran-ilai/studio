// shared/regex.js — 由 index.js 搬出(階段 3-A),內容未改動

const LINE_RE = /^([^:：\[]{1,24})((?:\[[^\]]+\])*)\s*[:：]\s*(.+)$/;
const NEW_LINE_RE = /^\[([^\]]+)\]((?:\s*\[[^\]]+\])*)\s*[:：]\s*(.+)$/;
const CMD_BG_RE = /^\[bg\s*:\s*(.+?)\]$/i;
const CMD_EXIT_RE = /^\[(離場|無人|退場)\]$/;
const CMD_CG_RE = /^\[cg\s*(full|solo)?\s*:\s*(.+?)\]$/i;
const CMD_CG_OFF_RE = /^\[cg\s+off\]$/i;
const CMD_CHOICES_RE = /^\[(選項|choices?)\]$/i;
const CHOICE_ITEM_RE = /^[-－]\s*(\*?)\s*(.+)$/;
const POS_TAGS = ["左", "中", "右"];
const ALIAS_BRACKET_THRESHOLD = 8;
const SCENE_CMD_TYPES = new Set(["bg", "cg", "cg_off", "exit", "light"]);
const CONTENT_TYPES = new Set(["dialog", "narration", "choices"]);

export {
  LINE_RE,
  NEW_LINE_RE,
  CMD_BG_RE,
  CMD_EXIT_RE,
  CMD_CG_RE,
  CMD_CG_OFF_RE,
  CMD_CHOICES_RE,
  CHOICE_ITEM_RE,
  POS_TAGS,
  ALIAS_BRACKET_THRESHOLD,
  SCENE_CMD_TYPES,
  CONTENT_TYPES,
};
