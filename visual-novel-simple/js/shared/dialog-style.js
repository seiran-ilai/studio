// shared/dialog-style.js — 由 index.js 搬出,內容未改動。對話框樣式系統(簡易/細節共用)。

function getStylePreset(styleId, variantId) {
  const style = STYLE_PRESETS[styleId];
  if (!style) return null;
  const v = style.variants[variantId] || Object.values(style.variants).find(x => x.isDefault) || Object.values(style.variants)[0];
  return { style, variant: v };
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
  // 樣式 modal 右側即時預覽同步(主要是對話框形狀)
  if (typeof updateDefaultsPreview === "function") updateDefaultsPreview();
}

function renderStyleTab() {
  // 任務 3:對話框形狀 / 角色光線 / 遊戲介面 設定已從樣式 modal 移除,改 no-op。
  // renderShapeGrid / renderLightModeButtons / bindGameUISettings 維持定義但不再被觸發。
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

function openStyleModal() {
  styleModalEl.classList.add("show");
  renderStyleTab();
  renderFontPreviewList();
  if (typeof renderStylePresetGrid === "function") renderStylePresetGrid();
  if (typeof syncStyleDefaultsUI === "function") syncStyleDefaultsUI();
  // 任務 3:已取消分頁,modal 為單頁,不再切換 tab
}

function closeStyleModal() {
  styleModalEl.classList.remove("show");
  reparseAndRender(false);
}

function updateDefaultsPreview() {
  const fs = state.fontSizes || { dialog: 18, speaker: 16, narration: 16, inner: 15 };
  const sd = state.styleDefaults || {};
  const fontStack = (id) => {
    const f = id && FONT_BY_ID[id];
    return f && f.stack;
  };
  const fontWeight = (id) => {
    const f = id && FONT_BY_ID[id];
    return f && f.weight;
  };
  const apply = (el, px, stack, weight) => {
    if (!el) return;
    el.style.fontSize = px + "px";
    el.style.fontFamily = stack || "";
    el.style.fontWeight = weight ? String(weight) : "";
  };
  apply(document.getElementById("modalPreviewSpeaker"),
        fs.speaker, fontStack(sd.speaker && sd.speaker.font), fontWeight(sd.speaker && sd.speaker.font));
  apply(document.getElementById("modalPreviewDialog"),
        fs.dialog, fontStack(sd.dialog && sd.dialog.font), fontWeight(sd.dialog && sd.dialog.font));
  apply(document.getElementById("modalPreviewNarration"),
        fs.narration, fontStack(sd.narration && sd.narration.font), fontWeight(sd.narration && sd.narration.font));
  apply(document.getElementById("modalPreviewInner"),
        fs.inner, fontStack(sd.inner && sd.inner.font), fontWeight(sd.inner && sd.inner.font));
  // 同步對話框形狀(classic / soft / window)
  const box = document.getElementById("modalPreviewBox");
  if (box && state.dialogStyle && state.dialogStyle.shape) {
    box.setAttribute("data-shape", state.dialogStyle.shape);
  }
}

function buildCustomVariant(presetId) {
  const style = STYLE_PRESETS[presetId];
  if (!style) return null;
  const cv = getOrInitCustomVariant(presetId);
  if (!cv) return null;
  const baseVariant = style.variants[cv.basedOn] || style.variants[getDefaultVariantId(presetId)];
  // deep clone 以免動到 STYLE_PRESETS 原始資料
  const v = JSON.parse(JSON.stringify(baseVariant));
  v.name = "自訂";
  v.dialog.borderColor = cv.borderColor;
  v.dialog.bgColor     = cv.bgColor;
  v.dialog.opacity     = cv.bgOpacity;
  v.speaker.color      = cv.nameColor;
  v.dialogText.color   = cv.textColor;
  return v;
}

function applyStylePreset(presetId, variantId, opts) {
  let style, variant;
  if (variantId === "custom") {
    style = STYLE_PRESETS[presetId];
    if (!style) return;
    variant = buildCustomVariant(presetId);
    if (!variant) return;
  } else {
    const result = getStylePreset(presetId, variantId);
    if (!result) return;
    style = result.style;
    variant = result.variant;
  }
  const root = document.documentElement;

  // 1. 標記 active + animation id
  root.setAttribute("data-style-active", presetId);
  root.setAttribute("data-animation", style.animationId);
  root.setAttribute("data-dialog-shape", variant.dialog.shape);
  root.setAttribute("data-ui-preset", style.uiPreset);

  // 2. CSS 變數 — dialog box
  // 任務 3:把背景透明度併入 --style-dialog-bg(rgba),否則純色背景會忽略透明度;
  //         canvas 也讀同一變數,輸出自動跟著套用。
  {
    const _op = (typeof variant.dialog.opacity === "number") ? variant.dialog.opacity : 1;
    const _bg = variant.dialog.bgColor;
    let _rgba = _bg;
    if (typeof _bg === "string" && _bg.charAt(0) === "#" && typeof hexToRgb === "function") {
      const c = hexToRgb(_bg);
      if (c) _rgba = `rgba(${c.r}, ${c.g}, ${c.b}, ${_op})`;
    }
    root.style.setProperty("--style-dialog-bg", _rgba);
  }
  root.style.setProperty("--style-dialog-border", variant.dialog.borderColor);
  root.style.setProperty("--style-dialog-border-width", (variant.dialog.borderWidth || 1) + "px");
  root.style.setProperty("--style-dialog-opacity", variant.dialog.opacity);

  // 3. CSS 變數 — speaker
  root.style.setProperty("--style-speaker-color", variant.speaker.color);
  root.style.setProperty("--style-speaker-font", variant.speaker.fontStack);
  root.style.setProperty("--style-speaker-weight", variant.speaker.weight || 400);
  root.style.setProperty("--style-speaker-style", variant.speaker.fontStyle || "normal");
  root.style.setProperty("--style-speaker-spacing", variant.speaker.letterSpacing || "normal");

  // 4. CSS 變數 — dialog text
  root.style.setProperty("--style-dialog-text-color", variant.dialogText.color);
  root.style.setProperty("--style-dialog-text-font", variant.dialogText.fontStack);
  root.style.setProperty("--style-dialog-text-weight", variant.dialogText.weight || 400);
  root.style.setProperty("--style-dialog-text-spacing", variant.dialogText.letterSpacing || "normal");

  // 5. 舞台背景
  root.style.setProperty("--style-stage-bg", variant.stageBg.base);

  // 6. UI preset 配色變數
  const uiPreset = UI_PRESETS[style.uiPreset];
  if (uiPreset) {
    if (uiPreset.chapter) {
      root.style.setProperty("--ui-chapter-color", uiPreset.chapter.color || "#ffffff");
      root.style.setProperty("--ui-chapter-font", uiPreset.chapter.fontStack || "inherit");
      root.style.setProperty("--ui-chapter-size", (uiPreset.chapter.fontSize || 13) + "px");
    }
    if (uiPreset.love) {
      root.style.setProperty("--ui-love-icon-color", uiPreset.love.iconColor || "#ffffff");
      root.style.setProperty("--ui-love-bar-bg", uiPreset.love.barBg || "rgba(0,0,0,0.4)");
      root.style.setProperty("--ui-love-label-color", uiPreset.love.labelColor || "#ffffff");
    }
  }

  // 7. State 更新 + 持久化
  state.style.preset = presetId;
  state.style.variant = variantId;
  if (!opts || !opts.skipSave) saveToStorage();

  // 8. 樣式 modal 右側即時預覽同步
  if (typeof updateDefaultsPreview === "function") updateDefaultsPreview();
}

function renderStylePresetGrid() {
  const grid = document.getElementById("stylePresetGrid");
  if (!grid) return;
  grid.innerHTML = "";
  for (const [styleId, style] of Object.entries(STYLE_PRESETS)) {
    const card = document.createElement("div");
    card.className = "style-preset-card";
    // 任務 2:移除「Coffee Shop」分類層 — 不再顯示 family 名稱,直接列出變體
    card.innerHTML = `<div class="style-preset-variants" id="variants-${styleId}"></div>`;
    grid.appendChild(card);
    const varContainer = card.querySelector(".style-preset-variants");
    for (const [variantId, variant] of Object.entries(style.variants)) {
      const btn = document.createElement("button");
      btn.className = "variant-btn";
      if (state.style.preset === styleId && state.style.variant === variantId) btn.classList.add("active");
      btn.style.background = variant.dialog.bgColor;
      btn.style.borderColor = variant.dialog.borderColor;
      btn.style.color = variant.speaker.color;
      btn.textContent = variant.name;
      btn.addEventListener("click", () => {
        applyStylePreset(styleId, variantId);
        renderStylePresetGrid();
      });
      varContainer.appendChild(btn);
    }
    // 第 4 顆「自訂」變體 — 點下去切到 custom 並展開 inline 編輯器
    const isCustomActive = state.style.preset === styleId && state.style.variant === "custom";
    const customBtn = document.createElement("button");
    customBtn.className = "variant-btn variant-btn-custom" + (isCustomActive ? " active" : "");
    customBtn.textContent = "自訂";
    customBtn.title = "以當前變體配色為起點,自訂顏色組合";
    customBtn.addEventListener("click", () => {
      applyStylePreset(styleId, "custom");
      renderStylePresetGrid();
    });
    varContainer.appendChild(customBtn);

    // 若目前正在編輯這個風格的自訂變體,卡片下方展開顏色編輯器
    if (isCustomActive) {
      const editor = buildCustomVariantEditor(styleId);
      if (editor) card.appendChild(editor);
    }
  }
}

function buildCustomVariantEditor(presetId) {
  const cv = getOrInitCustomVariant(presetId);
  if (!cv) return null;
  const style = STYLE_PRESETS[presetId];
  const basedOnName = (style.variants[cv.basedOn] && style.variants[cv.basedOn].name) || cv.basedOn;

  const wrap = document.createElement("div");
  wrap.className = "style-custom-editor";

  const title = document.createElement("div");
  title.className = "style-custom-editor-title";
  title.textContent = `自訂配色(${style.name})`;
  wrap.appendChild(title);

  const rows = [
    { key: "borderColor", label: "邊框色",   type: "color" },
    { key: "bgColor",     label: "背景色",   type: "color" },
    { key: "bgOpacity",   label: "背景透明度", type: "range" },
    { key: "nameColor",   label: "角色名色", type: "color" },
    { key: "textColor",   label: "對話文字色", type: "color" },
  ];

  for (const r of rows) {
    const row = document.createElement("div");
    row.className = "style-custom-editor-row";

    const label = document.createElement("label");
    label.textContent = r.label;
    row.appendChild(label);

    if (r.type === "color") {
      const input = document.createElement("input");
      input.type = "color";
      input.value = cv[r.key];
      input.addEventListener("input", () => {
        state.customVariants[presetId][r.key] = input.value;
        applyStylePreset(presetId, "custom");
        saveToStorage();
      });
      row.appendChild(input);
      const code = document.createElement("code");
      code.className = "style-custom-editor-code";
      code.textContent = cv[r.key];
      input.addEventListener("input", () => { code.textContent = input.value; });
      row.appendChild(code);
    } else if (r.type === "range") {
      const input = document.createElement("input");
      input.type = "range";
      input.min = "0"; input.max = "100"; input.step = "1";
      input.value = String(Math.round((cv.bgOpacity || 0) * 100));
      const val = document.createElement("strong");
      val.className = "style-custom-editor-val";
      val.textContent = input.value + "%";
      input.addEventListener("input", () => {
        const pct = parseInt(input.value, 10) || 0;
        val.textContent = pct + "%";
        state.customVariants[presetId].bgOpacity = pct / 100;
        applyStylePreset(presetId, "custom");
        saveToStorage();
      });
      row.appendChild(input);
      row.appendChild(val);
    }
    wrap.appendChild(row);
  }

  const resetBtn = document.createElement("button");
  resetBtn.type = "button";
  resetBtn.className = "style-custom-editor-reset";
  resetBtn.textContent = `↻ 還原為「${basedOnName}」配色`;
  resetBtn.addEventListener("click", () => {
    const baseVariant = style.variants[cv.basedOn];
    if (!baseVariant) return;
    state.customVariants[presetId] = {
      borderColor: baseVariant.dialog.borderColor,
      bgColor:     baseVariant.dialog.bgColor,
      bgOpacity:   typeof baseVariant.dialog.opacity === "number" ? baseVariant.dialog.opacity : 0.9,
      nameColor:   baseVariant.speaker.color,
      textColor:   baseVariant.dialogText.color,
      basedOn:     cv.basedOn,
    };
    applyStylePreset(presetId, "custom");
    saveToStorage();
    renderStylePresetGrid();
  });
  wrap.appendChild(resetBtn);

  return wrap;
}

function getEffectiveStyle(line) {
  let font = line && line.styleFont;
  const size = line && line.styleSize;
  if (line && line.type === "narration") {
    const kind = line.subtype === "inner" ? "inner" : "narration";
    const def = (state.styleDefaults && state.styleDefaults[kind]) || {};
    if (!font && def.font) font = def.font;
  } else if (line && line.type === "dialog") {
    const def = (state.styleDefaults && state.styleDefaults.dialog) || {};
    if (!font && def.font) font = def.font;
  }
  return {
    font: font || null,
    size: size || null,
    bold: !!(line && line.styleBold),
    italic: !!(line && line.styleItalic),
  };
}

function basePxForLine(line) {
  const fs = state.fontSizes || { dialog: 18, speaker: 16, narration: 16, inner: 15 };
  if (line && line.type === "narration") {
    return line.subtype === "inner" ? (fs.inner || 15) : (fs.narration || 16);
  }
  return fs.dialog || 18;
}

function renderInlineMarkdownToHTML(text) {
  let html = escHtml(text);
  const fontNames = FONT_TAG_NAMES.join("|");
  // 句中字體:[字體名:文字]
  html = html.replace(new RegExp(`\\[(${fontNames}):([^\\]]+)\\]`, "g"), (m, name, content) => {
    const alias = STYLE_TAG_ALIASES[name];
    const font = alias ? FONT_BY_ID[alias.value] : null;
    if (!font || !font.stack) return content;
    const w = font.weight ? `;font-weight:${font.weight}` : "";
    return `<span style="font-family: ${font.stack}${w}">${content}</span>`;
  });
  html = html.replace(/\*\*([^*]+)\*\*/g, '<span class="md-bold">$1</span>');
  html = html.replace(/\*([^*]+)\*/g, '<span class="md-italic">$1</span>');
  html = html.replace(/##([^#]+)##/g, '<span class="md-large">$1</span>');
  html = html.replace(/\^\^([^\^]+)\^\^/g, '<span class="md-small">$1</span>');
  return html;
}

function parseInlineToSegments(text) {
  const segments = [];
  let i = 0;
  while (i < text.length) {
    const rest = text.substring(i);
    const fontMatch = rest.match(/^\[([^:\]]+):([^\]]+)\]/);
    if (fontMatch && STYLE_TAG_ALIASES[fontMatch[1]]
        && STYLE_TAG_ALIASES[fontMatch[1]].kind === "font") {
      const fontId = STYLE_TAG_ALIASES[fontMatch[1]].value;
      const f = FONT_BY_ID[fontId];
      segments.push({ text: fontMatch[2], fontStack: f && f.stack, fontWeight: f && f.weight });
      i += fontMatch[0].length;
      continue;
    }
    const boldMatch = rest.match(/^\*\*([^*]+)\*\*/);
    if (boldMatch) { segments.push({ text: boldMatch[1], bold: true }); i += boldMatch[0].length; continue; }
    const italicMatch = rest.match(/^\*([^*]+)\*/);
    if (italicMatch) { segments.push({ text: italicMatch[1], italic: true }); i += italicMatch[0].length; continue; }
    const largeMatch = rest.match(/^##([^#]+)##/);
    if (largeMatch) { segments.push({ text: largeMatch[1], large: true }); i += largeMatch[0].length; continue; }
    const smallMatch = rest.match(/^\^\^([^\^]+)\^\^/);
    if (smallMatch) { segments.push({ text: smallMatch[1], small: true }); i += smallMatch[0].length; continue; }
    let plainEnd = i;
    while (plainEnd < text.length
           && !text.substring(plainEnd).match(/^(\*\*|\*|##|\^\^|\[[^:\]]+:)/)) {
      plainEnd++;
    }
    if (plainEnd > i) { segments.push({ text: text.substring(i, plainEnd) }); i = plainEnd; }
    else { segments.push({ text: text[i] }); i++; }
  }
  return segments;
}

function applyStyleToDialogText(ln) {
  const el = els.dialogText;
  if (!el) return;
  const eff = getEffectiveStyle(ln);

  // 1. 字體
  let fontWeight = null;  // 字體固有 weight(例如麥克黑 900)
  if (eff.font) {
    const font = FONT_BY_ID[eff.font];
    if (font && font.stack) {
      el.style.fontFamily = font.stack;
      if (font.weight) fontWeight = font.weight;
      // ★ M18:確保字體已載入(辰宇落雁體較大,先觸發下載)
      const primaryFont = font.stack.split(",")[0].trim().replace(/^["']|["']$/g, "");
      if (document.fonts && document.fonts.load) {
        try { document.fonts.load(`16px "${primaryFont}"`); } catch (e) {}
      }
    } else {
      el.style.fontFamily = "";
    }
  } else {
    el.style.fontFamily = "";
  }

  // 2. 大小 — 基底用該行類型的 pt,行內 [大]/[小] 對基底乘倍率
  const basePx = basePxForLine(ln);
  let finalPx = basePx;
  if (eff.size === "large") finalPx = basePx * 1.3;
  else if (eff.size === "small") finalPx = basePx * 0.85;
  el.style.fontSize = Math.round(finalPx) + "px";

  // 3. 粗體:明確 [粗] tag > 字體固有 weight > 清空
  if (eff.bold) el.style.fontWeight = "700";
  else if (fontWeight) el.style.fontWeight = String(fontWeight);
  else el.style.fontWeight = "";

  // 4. 斜體(narration 預設無斜體,但明確指定 [斜] 仍要套)
  el.style.fontStyle = eff.italic ? "italic" : "";
}

function styleFieldsFromLine(ln) {
  const eff = getEffectiveStyle(ln);
  const styleFont = eff.font || null;
  return {
    styleFont,
    styleSize: eff.size || null,
    styleBold: eff.bold,
    styleItalic: eff.italic,
    fontStack: styleFont ? (FONT_BY_ID[styleFont] && FONT_BY_ID[styleFont].stack) : null,
  };
}

function buildCanvasFont(d, basePx, fallbackStack) {
  const preset = (d && d.styleFont) ? FONT_BY_ID[d.styleFont] : null;
  const stack = (preset && preset.stack) ? preset.stack : ((d && d.fontStack) || fallbackStack);
  let size = basePx;
  if (d && d.styleSize === "large") size = basePx * 1.3;
  else if (d && d.styleSize === "small") size = basePx * 0.85;
  const style = (d && d.styleItalic) ? "italic " : "";
  let weight = "400";
  if (d && d.styleBold) weight = "700";
  else if (preset && preset.weight) weight = String(preset.weight);
  return `${style}${weight} ${Math.round(size)}px ${stack}`;
}

function applyFontSizes() {
  const fs = state.fontSizes || { dialog: 18, speaker: 16, narration: 16, inner: 15 };
  const root = document.documentElement;
  root.style.setProperty("--dialog-font-size", fs.dialog + "px");
  root.style.setProperty("--speaker-font-size", fs.speaker + "px");
  root.style.setProperty("--narration-font-size", fs.narration + "px");
  root.style.setProperty("--inner-font-size", fs.inner + "px");
}

function syncStyleDefaultsUI() {
  for (const f of STYLE_DEFAULT_FIELDS) {
    if (f.font) {
      const fe = document.getElementById(f.font);
      const d = state.styleDefaults[f.key] || { font: "" };
      if (fe) fe.value = d.font || "";
    }
    const se = document.getElementById(f.size);
    const le = document.getElementById(f.label);
    const v = (state.fontSizes && state.fontSizes[f.key]) || 16;
    if (se) se.value = v;
    if (le) le.textContent = v + " pt";
  }
  updateDefaultsPreview();
}

function getOrInitCustomVariant(presetId) {
  const style = STYLE_PRESETS[presetId];
  if (!style) return null;
  // 決定 basedOn 起點:已存在的 → 沿用;否則用目前同一風格的變體;否則用該風格的預設變體
  let cv = state.customVariants && state.customVariants[presetId];
  if (!cv) {
    const baseVariantId =
      (state.style.preset === presetId
        && state.style.variant
        && state.style.variant !== "custom"
        && style.variants[state.style.variant])
        ? state.style.variant
        : getDefaultVariantId(presetId);
    const baseVariant = style.variants[baseVariantId];
    if (!baseVariant) return null;
    cv = {
      borderColor: baseVariant.dialog.borderColor,
      bgColor:     baseVariant.dialog.bgColor,
      bgOpacity:   typeof baseVariant.dialog.opacity === "number" ? baseVariant.dialog.opacity : 0.9,
      nameColor:   baseVariant.speaker.color,
      textColor:   baseVariant.dialogText.color,
      basedOn:     baseVariantId,
    };
    if (!state.customVariants) state.customVariants = {};
    state.customVariants[presetId] = cv;
  }
  return cv;
}

function applyAnimationsToggle(enabled) {
  document.documentElement.setAttribute("data-animations", enabled ? "on" : "off");
}

export {
  getStylePreset,
  applyDialogStyle,
  applyStylePreset,
  buildCustomVariant,
  buildCustomVariantEditor,
  renderStylePresetGrid,
  renderShapeGrid,
  renderLightModeButtons,
  updateDefaultsPreview,
  openStyleModal,
  closeStyleModal,
  renderStyleTab,
  getEffectiveStyle,
  basePxForLine,
  renderInlineMarkdownToHTML,
  parseInlineToSegments,
  applyStyleToDialogText,
  styleFieldsFromLine,
  buildCanvasFont,
  applyFontSizes,
  syncStyleDefaultsUI,
  getOrInitCustomVariant,
  applyAnimationsToggle,
};
