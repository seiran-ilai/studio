// detail/parser.js — 由 index.js 搬出(階段 3-D),內容未改動
// 相依:regex/constants、findCharacter、state 皆經全域(window)取得。

function buildDialogNode(name, tags, text, idx, raw, ch) {
  let position = null, emotion = null;
  let nameHidden = false;
  let nameOverride = null;
  let fontId = null;
  // 樣式相關狀態
  let styleFont = null;       // 字體 id
  let styleSize = null;       // "large" | "small" | null
  let styleBold = false;
  let styleItalic = false;
  // Look up speaker's known emotions so we can disambiguate brackets.
  const knownEmotions = ch && Array.isArray(ch.emotions) ? ch.emotions : null;
  for (const t of tags) {
    // ★ 樣式 tag 優先判斷(撞名時樣式優先)
    if (STYLE_TAG_NAMES.has(t)) {
      const styleInfo = STYLE_TAG_ALIASES[t];
      if (styleInfo.kind === "font") styleFont = styleInfo.value;
      else if (styleInfo.kind === "size") styleSize = styleInfo.value;
      else if (styleInfo.kind === "bold") styleBold = true;
      else if (styleInfo.kind === "italic") styleItalic = true;
      continue;
    }
    if (POS_TAGS.includes(t)) {
      position = t;
    } else if (/^字體\s*[:：]/.test(t)) {
      // [字體: 明體] — per-line font override
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
    // ★ 樣式(styleFont 與舊 [字體:X] 的 fontId 統一,新 tag 優先)
    styleFont: styleFont || fontId,
    styleSize,
    styleBold,
    styleItalic,
  };
}

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

  // 好感度命令:[好感度: +5]、[好感度: -10]、[好感度: =80]
  //              [好感度 學長: +5]、[好感度 學長: =50]
  const loveMatch = line.match(/^\[好感度(?:\s+([^\s:：]+))?\s*[:：]\s*([+\-=])\s*(\d+)\]$/);
  if (loveMatch) {
    return {
      type: "love",
      idx, raw,
      targetName: loveMatch[1] ? loveMatch[1].trim() : null,
      operator: loveMatch[2],
      value: parseInt(loveMatch[3], 10),
    };
  }

  // choices start marker
  if (CMD_CHOICES_RE.test(line)) return { type: "choices_start", idx, raw };

  // 新格式對話:[角色名][tag]...:台詞 — 第一個 tag 須為已知角色名
  const nm = line.match(NEW_LINE_RE);
  if (nm) {
    const speaker = nm[1].trim();
    const ch = (typeof state !== "undefined" && state.characters)
      ? state.characters.find(c => c.name === speaker)
      : null;
    if (ch) {
      const tags = [...(nm[2] || "").matchAll(/\[([^\]]+)\]/g)].map(t => t[1].trim());
      return buildDialogNode(speaker, tags, nm[3].trim(), idx, raw, ch);
    }
    // 第一個 tag 不是角色名 → 不是新格式對話,往下交給樣式旁白處理
  }

  // 舊格式對話:角色名[tag]...:台詞(向下相容)
  const m = line.match(LINE_RE);
  if (m) {
    const name = m[1].trim();
    const tags = [...(m[2] || "").matchAll(/\[([^\]]+)\]/g)].map(t => t[1].trim());
    const ch = (typeof state !== "undefined" && state.characters)
      ? state.characters.find(c => c.name === name)
      : null;
    return buildDialogNode(name, tags, m[3].trim(), idx, raw, ch);
  }

  // choice item (`- text` or `- * text`)
  const ci = line.match(CHOICE_ITEM_RE);
  if (ci) return { type: "choice_item", idx, raw, isFinal: ci[1] === "*", text: ci[2].trim() };

  // narration — inner monologue wrapped in full/half-width parens auto-strips them
  // 先嘗試從行首抓出樣式 tag 區塊
  const styleTagsMatch = line.match(/^((?:\[[^\]]+\])+)\s*(.*)$/);
  let nStyleFont = null;
  let nStyleSize = null;
  let nStyleBold = false;
  let nStyleItalic = false;
  let remainingLine = line;

  if (styleTagsMatch) {
    const tagBlock = styleTagsMatch[1];
    const rest = styleTagsMatch[2];
    const styleTags = [...tagBlock.matchAll(/\[([^\]]+)\]/g)].map(mm => mm[1].trim());
    // 只接受全部都是樣式 tag 才視為樣式區塊
    const allStyleTags = styleTags.every(t => STYLE_TAG_NAMES.has(t));
    if (allStyleTags && styleTags.length > 0) {
      for (const t of styleTags) {
        const info = STYLE_TAG_ALIASES[t];
        if (info.kind === "font") nStyleFont = info.value;
        else if (info.kind === "size") nStyleSize = info.value;
        else if (info.kind === "bold") nStyleBold = true;
        else if (info.kind === "italic") nStyleItalic = true;
      }
      remainingLine = rest;
    }
  }

  const innerMatch = remainingLine.match(/^[（(]([^）)]*)[）)]$/);
  const narrationText = innerMatch ? innerMatch[1].trim() : remainingLine;
  return {
    type: "narration",
    subtype: innerMatch ? "inner" : "scene",
    idx, raw,
    text: narrationText,
    styleFont: nStyleFont,
    styleSize: nStyleSize,
    styleBold: nStyleBold,
    styleItalic: nStyleItalic,
  };
}

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

export {
  buildDialogNode,
  parseLine,
  collapseChoices,
  collapseSceneCommands,
  parseScript,
};
