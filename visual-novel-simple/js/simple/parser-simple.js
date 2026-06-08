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
    // 排除明顯不是人名的情況(避免「6/19 21:30 …」這種時間冒號被當成 speaker 分隔):
    // 1. 含數字+斜線/連字號(日期,如 6/19)
    // 2. 含空格(人名通常不含空格)
    // 3. 超過 12 字(人名不會這麼長)
    // 4. 純數字 / 全是非文字符號
    const looksLikeName = speaker.length <= 12
      && !speaker.includes(" ")
      && !/\d[\/\-]\d/.test(speaker)   // 日期格式
      && !/^\d+$/.test(speaker)         // 純數字
      && !/^[\d\s\W]+$/.test(speaker);  // 全是非文字
    if (looksLikeName) {
      // rest 整段被括號包住 → 帶 speaker 的 inner
      const innerWithSpeaker = rest.match(/^[（(]([\s\S]*?)[）)]$/);
      if (innerWithSpeaker) {
        return { type: "inner", speaker, content: innerWithSpeaker[1].trim() };
      }
      return { type: "dialog", speaker, content: rest };
    }
  }

  // 不像人名 / 其他 → narration
  return { type: "narration", speaker: null, content: trimmed };
}

function parseSimpleDialogText(text) {
  const out = { parsedLines: [], unsupported: [] };
  if (typeof text !== "string" || !text.trim()) return out;
  // 空行分段:空行(trim 後為空)前後分成不同 parsedLine;
  // 空行內的連續非空行合併成同一個 parsedLine,content 用 \n 連接(canvas 端 _vnsDrawWrappedText 支援 \n)。
  const rawLines = text.split(/\n/);
  let group = [];   // 當前段落累積的「逐行解析結果」

  function flushGroup() {
    if (!group.length) return;
    // type / speaker 取第一行;content 是各行 content 用 \n 連接
    const first = group[0];
    const content = group.map(g => g.content).join("\n");
    out.parsedLines.push({ type: first.type, speaker: first.speaker, content });
    group = [];
  }

  for (const raw of rawLines) {
    const t = raw.trim();
    if (!t) { flushGroup(); continue; }   // 空行 = 段落分隔
    // unsupported tag 偵測逐行不變
    if (_hasUnsupportedScript(t)) out.unsupported.push(t);
    const ln = _parseSimpleParagraph(t);
    if (ln) group.push(ln);
  }
  flushGroup();
  return out;
}

export {
  SIMPLE_UNSUPPORTED_PREFIXES,
  _hasUnsupportedScript,
  _parseSimpleParagraph,
  parseSimpleDialogText,
};
