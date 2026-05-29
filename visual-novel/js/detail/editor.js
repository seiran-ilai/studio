// detail/editor.js — 由 index.js 搬出(階段 3-D),內容未改動
// 相依:_shEsc / ensureCaretVisible / parser/preview / state / els 皆經全域(window)取得。
// (autocomplete 大區與 closeJumpPopup 待後續併入或保留)

function _shTagsHtml(raw) {
  return String(raw || "").replace(/\[([^\]\n]+)\]/g, (_, inner) => {
    const cls = STYLE_TAG_NAMES.has(inner.trim()) ? "sh-style-tag" : "sh-tag";
    return `<span class="sh-bracket">[</span><span class="${cls}">${_shEsc(inner)}</span><span class="sh-bracket">]</span>`;
  });
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
      const tagsHtml = _shTagsHtml(m[2]);
      return `<span class="sh-speaker">${_shEsc(m[1])}</span>${tagsHtml}` +
        `<span class="sh-colon">${_shEsc(m[3])}</span>${_shEsc(m[4])}`;
    }
    // narration with leading style-tag block: [辰宇落雁](他在看我嗎?)
    const nm = line.match(/^((?:\[[^\]\n]+\])+)\s*(.*)$/);
    if (nm) {
      const styleTags = [...nm[1].matchAll(/\[([^\]]+)\]/g)].map(t => t[1].trim());
      if (styleTags.length > 0 && styleTags.every(t => STYLE_TAG_NAMES.has(t))) {
        return _shTagsHtml(nm[1]) + (nm[2] ? _shEsc(line.slice(nm[1].length)) : "");
      }
    }
    // narration / plain
    return _shEsc(line);
  }).join("\n");
}

function syncSyntaxHighlight() {
  if (!_shEl) return;
  // trailing newline keeps overlay height matched with the textarea's
  _shEl.innerHTML = highlightScript(els.scriptArea.value) + "\n";
  _shEl.scrollTop = els.scriptArea.scrollTop;
  _shEl.scrollLeft = els.scriptArea.scrollLeft;
}

function setScript(text) {
  state.script = text;
  els.scriptArea.value = text;
  reparseAndRender(true);
}

function setRatio(r) {
  if (r !== "16:9" && r !== "9:16") r = "16:9";
  state.ratio = r;
  els.stage.dataset.ratio = r;
  document.querySelectorAll(".ratio-toggle button").forEach(b => {
    b.classList.toggle("active", b.dataset.ratio === r);
  });
  try { localStorage.setItem(RATIO_KEY, r); } catch (e) {}
}

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
  // 確保游標保持在視野中(L3)— 多行 snippet 置中以看到完整範本
  const _multiLine = snippetKey === "cg" || snippetKey === "cgsolo"
    || snippetKey === "cgfull" || snippetKey === "choices";
  ensureCaretVisible(ta, cursorPos, _multiLine ? "center" : "nearest");
  // immediately offer autocomplete if cursor is now inside [bg:/cg:
  if (snippetKey === "bg" || snippetKey === "cg" || snippetKey === "cgsolo" || snippetKey === "cgfull") {
    setTimeout(() => window.ScriptEditor && window.ScriptEditor.refresh(), 0);
  }
}

// detail 版劇本編輯器 autocomplete(由 index.js 搬入,IIFE 包成 init 由 index.js 於掛載後呼叫)
function initScriptEditor() {
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
      enterPhase: 0,        // O3:0=正常 / 1=已接續 / 2=已清空(三段循環)
      lastPrefix: "",       // O3:上次接續/清空的對話前綴(用於恢復)
    };
  
    // O3:對話前綴擷取 — 同時相容舊格式 `名[tag]:` 與新格式 `[名][tag]:`
    const DIALOG_PREFIX_RE = /^(\s*(?:[^\[\]:：\n]+)?(?:\[[^\]\n]*\])+)\s*[:：]/;
    function extractDialogPrefix(content) {
      const m = content.match(DIALOG_PREFIX_RE);
      return m ? m[1].trim() : "";
    }
  
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
        ensureCaretVisible(ta, cursorPos, "nearest"); // L3 — Tab 展開單行,nearest
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
  
    // M10:樣式 tag 候選(字體 + 大小/粗/斜),用標準名、避免 B/I/b/i 重複
    const STYLE_CANDIDATES = [
      { label: "[辰宇落雁]", insert: "辰宇落雁", sub: "字體" },
      { label: "[明體]", insert: "明體", sub: "字體" },
      { label: "[黑體]", insert: "黑體", sub: "字體" },
      { label: "[粉圓]", insert: "粉圓", sub: "字體" },
      { label: "[打字機]", insert: "打字機", sub: "字體" },
      { label: "[大]", insert: "大", sub: "放大" },
      { label: "[小]", insert: "小", sub: "縮小" },
      { label: "[粗]", insert: "粗", sub: "粗體" },
      { label: "[斜]", insert: "斜", sub: "斜體" },
    ];
    function pushStyleCandidates(items, used, q) {
      let s = 100;
      for (const c of STYLE_CANDIDATES) {
        if (used.has(c.insert)) continue;
        if (q && !(c.insert.includes(q) || c.label.includes(q))) continue;
        items.push({ kind: "style", label: c.label, sub: c.sub, insert: c.insert, score: s++ });
      }
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
        items.push({ kind: "font-open", label: "[字體:] 指定字體", sub: "選字體", insert: "字體:", keepInside: true, score: 97 });
        pushStyleCandidates(items, used, q);
      } else if (ctx.slot === "position") {
        for (const p of ["左", "中", "右"]) {
          if (used.has(p)) continue;
          if (!q || p === q || p.includes(q)) items.push({ kind: "position", label: p, insert: p });
        }
        items.push({ kind: "hide", label: "[?] 隱藏真名", sub: "顯示 ???", insert: "?", score: 95 });
        items.push({ kind: "font-open", label: "[字體:] 指定字體", sub: "選字體", insert: "字體:", keepInside: true, score: 97 });
        pushStyleCandidates(items, used, q);
      } else if (ctx.slot === "alias-hide" || ctx.slot === "hide") {
        items.push({ kind: "hide", label: "[?]", sub: "隱藏真名（顯示 ???）", insert: "?" });
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
        if (accept(false)) ensureCaretVisible(ta, undefined, "nearest"); // L3 — popup 接受候選
        return;
      }
      // 任何 Tab 動作都會打斷 Enter 三段循環
      S.enterPhase = 0;
  
      const { ls, le, content, pos } = getLine();
      const cursorOnLine = pos - ls;
      const trimmed = content.trim();
      const isCommand = COMMAND_HEAD.test(content);
  
      // 情境 A:空行 → 角色 + 指令候選清單(O4 實作 popup;此處保留 fallback)
      if (trimmed === "") {
        e.preventDefault();
        if (typeof window.showCharacterAndCommandPopup === "function") {
          e.stopImmediatePropagation();
          window.showCharacterAndCommandPopup();
          return;
        }
        tryRepeatPrefix(); // fallback:沿用既有「重複上一個前綴」
        return;
      }
  
      // 關鍵字展開(bg/cg/離場…)優先,不可破壞(全局規則 1)
      if (tryExpandKeyword()) { e.preventDefault(); return; }
  
      // 情境 B:整行皆 tag、無冒號、游標在行尾 → 可選欄位 popup(O4)
      if (!isCommand && /^(?:\[[^\]\n]+\])+$/.test(trimmed) && pos === le) {
        e.preventDefault();
        if (typeof window.showOptionalFieldPopup === "function") {
          e.stopImmediatePropagation();
          window.showOptionalFieldPopup();
          return;
        }
        tryAppendColon(); // fallback:補上冒號
        return;
      }
  
      // 情境 C:對話行,游標在最後一個 ] 之後、冒號之前 → 可選欄位 popup(O4)
      if (!isCommand) {
        const a = content.indexOf("："), b = content.indexOf(":");
        const colonIdx = a === -1 ? b : (b === -1 ? a : Math.min(a, b));
        const tagEndMatch = content.match(/^\s*(?:[^\[\]:：\n]+)?(?:\[[^\]\n]+\])+/);
        if (colonIdx !== -1 && tagEndMatch) {
          const tagEnd = tagEndMatch[0].length;
          if (cursorOnLine >= tagEnd && cursorOnLine <= colonIdx) {
            e.preventDefault();
            if (typeof window.showOptionalFieldPopupBeforeColon === "function") {
              e.stopImmediatePropagation();
              window.showOptionalFieldPopupBeforeColon(colonIdx);
            }
            return;
          }
        }
      }
  
      // 其他情境:沿用既有鏈
      if (tryAppendColon()) { e.preventDefault(); return; }
      if (tryRepeatPrefix()) { e.preventDefault(); return; }
      e.preventDefault();
    }
  
    function tryAppendColon() {
      const { ls, le, content, pos } = getLine();
      if (pos !== le) return false;
      if (/[:：]/.test(content)) return false;
      if (COMMAND_HEAD.test(content)) return false;
      if (!/^\s*(?:[^\[\]:：\n]+)?(?:\[[^\]\n]*\])+\s*$/.test(content)) return false;
      ta.value = ta.value.slice(0, le) + "：" + ta.value.slice(le);
      state.script = ta.value;
      ta.setSelectionRange(le + 1, le + 1);
      reparseAndRender(false);
      saveToStorage();
      ensureCaretVisible(ta, le + 1, "nearest"); // L3
      return true;
    }
  
    function tryRepeatPrefix() {
      const { ls, content, pos } = getLine();
      if (content.trim() !== "") return false;
      const above = ta.value.slice(0, ls).split("\n");
      let prefix = null;
      for (let i = above.length - 1; i >= 0; i--) {
        const m = above[i].match(/^(\s*(?:[^\[\]:：\n]+)?(?:\[[^\]\n]*\])+)\s*[:：]/);
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
      ensureCaretVisible(ta, np, "nearest"); // L3
      return true;
    }
  
    // ============================================================
    //  Enter logic
    // ============================================================
    function handleEnter(e) {
      if (isOpen()) {
        e.preventDefault();
        if (accept(true)) ensureCaretVisible(ta, undefined, "nearest"); // L3 — popup 接受候選(Enter)
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
        ensureCaretVisible(ta, np, "nearest"); // L3
        return;
      }
  
      // ── O3:Enter 三段循環(接續 → 清空 → 恢復) ──
      const trimmed = content.trim();
      const prefix = extractDialogPrefix(trimmed);
      const isJustPrefix = prefix &&
        (trimmed === prefix + "：" || trimmed === prefix + ":");
  
      // 階段 1 → 2:只有前綴的行,沒打字再按 Enter → 清空該行
      if (isJustPrefix && S.enterPhase === 1) {
        e.preventDefault();
        ta.value = ta.value.slice(0, ls) + ta.value.slice(le);
        state.script = ta.value;
        ta.setSelectionRange(ls, ls);
        S.enterPhase = 2;
        S.lastPrefix = prefix;
        S.autoInserted = null;
        reparseAndRender(false);
        saveToStorage();
        ensureCaretVisible(ta, ls, "nearest");
        return;
      }
  
      // 階段 2 → 1:空行且上次有清空 → 恢復前綴
      if (trimmed === "" && S.enterPhase === 2 && S.lastPrefix) {
        e.preventDefault();
        const restored = S.lastPrefix + "：";
        ta.value = ta.value.slice(0, pos) + restored + ta.value.slice(pos);
        state.script = ta.value;
        const np = pos + restored.length;
        ta.setSelectionRange(np, np);
        S.enterPhase = 1;
        S.autoInserted = { start: pos, end: np };
        reparseAndRender(false);
        saveToStorage();
        ensureCaretVisible(ta, np, "nearest");
        return;
      }
  
      // 階段 C:對話行尾 → 自動接續同前綴到新行
      if (prefix) {
        e.preventDefault();
        const insertion = `\n${prefix}：`;
        ta.value = ta.value.slice(0, pos) + insertion + ta.value.slice(pos);
        state.script = ta.value;
        const np = pos + insertion.length;
        ta.setSelectionRange(np, np);
        S.autoInserted = { start: pos, end: np };
        S.enterPhase = 1;
        S.lastPrefix = prefix;
        reparseAndRender(false);
        saveToStorage();
        ensureCaretVisible(ta, np, "nearest"); // L3
        return;
      }
  
      // 其他:正常換行,重置循環狀態
      S.enterPhase = 0;
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
      ensureCaretVisible(ta, np, "nearest"); // L3 — 清單延續(- / [選項])
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
      ensureCaretVisible(ta, pos + 1, "nearest"); // L3 — `[` 自動成對
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
        S.enterPhase = 0; // O3:使用者打字 → 跳出 Enter 三段循環
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
        // O4:分類 popup 開啟時,本模組完全讓位給 popup 自己的鍵盤處理
        if (window.__catPopupOpen) return;
        if (e.key === "Backspace" && (e.ctrlKey || e.metaKey) && !e.altKey) {
          handleCtrlBackspace(e);
          return;
        }
        if (isOpen() && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
          e.preventDefault();
          move(e.key === "ArrowDown" ? 1 : -1);
          return;
        }
        // O3:IME 組字中,Enter/Tab 交給輸入法處理(全局規則 3)
        if ((e.key === "Enter" || e.key === "Tab") &&
            (e.isComposing || ta.dataset.composing === "true")) {
          return;
        }
        if (e.key === "Tab" && !e.ctrlKey && !e.metaKey && !e.altKey) {
          if (e.shiftKey) { e.preventDefault(); return; }
          handleTab(e);
          return;
        }
        // O3:Shift+Enter → 純空行(parser 會忽略,且不觸發接續/循環)
        if (e.key === "Enter" && e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
          if (isOpen()) return;
          e.preventDefault();
          const p = ta.selectionStart;
          ta.value = ta.value.slice(0, p) + "\n\n" + ta.value.slice(p);
          state.script = ta.value;
          const np = p + 2;
          ta.setSelectionRange(np, np);
          S.enterPhase = 0;
          S.autoInserted = null;
          reparseAndRender(false);
          saveToStorage();
          ensureCaretVisible(ta, np, "nearest");
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
  
    return { refresh, isOpen, hide, caretRect: caretCoords };
  })();
}

export {
  _shTagsHtml,
  highlightScript,
  syncSyntaxHighlight,
  setScript,
  setRatio,
  findParsedStepForRawLine,
  getCaretRawLine,
  scheduleCursorSync,
  updateScriptLineHighlight,
  autoScrollScriptToCurrentLine,
  insertSnippet,
  initScriptEditor,
};
