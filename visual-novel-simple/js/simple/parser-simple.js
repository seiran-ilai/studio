// simple/parser-simple.js — 由 index.js 搬出(階段 3-G),內容未改動

const SIMPLE_UNSUPPORTED_PREFIXES = [
  /^\[bg\s*[:：]/i,
  /^\[cg\s*[:：]/i,
  /^\[cg\s+off\]/i,
  /^\[cg\s+(?:solo|full)\s*[:：]/i,
  /^\[選項\]/,
  /^\[好感度/,
  /^\[離場\]/,
  /^\[聚光\]/,
  /^\[同亮\]/,
  /^\[全暗\]/,
];

function _hasUnsupportedScript(line) {
  for (const re of SIMPLE_UNSUPPORTED_PREFIXES) if (re.test(line)) return true;
  return false;
}

function _parseSimpleParagraph(text) {
  const trimmed = text.trim();
  if (!trimmed) return null;

  // 整段被括號包住 → inner(無 speaker)
  const innerWhole = trimmed.match(/^[（(]([\s\S]*?)[）)]$/);
  if (innerWhole) {
    return { type: "inner", speaker: null, content: innerWhole[1].trim() };
  }

  // 嘗試 `名字:內容` / `名字:(內心話)`
  // 名字限制:不含 : 或 : 或 空白起頭;允許帶 [tag](因為樣式 tag 可能在名字後)
  // 簡化:取 \n 之前第一個 : 或 : 切兩段
  const colonMatch = trimmed.match(/^([^\s:：][^:：\n]*?)[:：]([\s\S]*)$/);
  if (colonMatch) {
    const speaker = colonMatch[1].trim();
    const rest = colonMatch[2].trim();
    // rest 整段被括號包住 → 帶 speaker 的 inner
    const innerWithSpeaker = rest.match(/^[（(]([\s\S]*?)[）)]$/);
    if (innerWithSpeaker) {
      return { type: "inner", speaker, content: innerWithSpeaker[1].trim() };
    }
    return { type: "dialog", speaker, content: rest };
  }

  // 其他 → narration
  return { type: "narration", speaker: null, content: trimmed };
}

function parseSimpleDialogText(text) {
  const out = { parsedLines: [], unsupported: [] };
  if (typeof text !== "string" || !text.trim()) return out;
  // 任務 1:每一行 = 一個 beat(獨立播放),不再把多行併成一段
  const paragraphs = text.split(/\n/);
  for (const p of paragraphs) {
    const t = p.trim();
    if (!t) continue;
    if (_hasUnsupportedScript(t)) {
      out.unsupported.push(t);
      // 仍當 narration 渲染,只是另外標記給 UI 用
      const ln = _parseSimpleParagraph(t);
      if (ln) out.parsedLines.push(ln);
      continue;
    }
    const ln = _parseSimpleParagraph(t);
    if (ln) out.parsedLines.push(ln);
  }
  return out;
}

export {
  SIMPLE_UNSUPPORTED_PREFIXES,
  _hasUnsupportedScript,
  _parseSimpleParagraph,
  parseSimpleDialogText,
};
