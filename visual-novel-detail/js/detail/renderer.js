// detail/renderer.js — 由 index.js 搬出(階段 3-D),內容未改動
// 相依:共用樣式/markdown/canvas-font helper、escHtml、state 皆經全域(window)取得。

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

function applyPortraitTransform(figEl, ch) {
  if (!figEl || !ch) return;
  const inner = figEl.querySelector(".char-portrait, .char-portrait-placeholder");
  if (!inner) return;
  const y = typeof ch.portraitY === "number" ? ch.portraitY : 0;
  const scale = typeof ch.portraitScale === "number" ? ch.portraitScale : 100;
  inner.style.transformOrigin = "bottom center";
  inner.style.transform = `translateY(${y}%) scale(${scale / 100})`;
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

        applyPortraitTransform(fig, ch);
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
    applyStyleToDialogText(line);
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
    applyStyleToDialogText(line);
    typewrite(line.text);
  } else {
    els.dialogBox.style.display = "none";
  }
}

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

export {
  renderBackground,
  svgPortrait,
  applyPortraitTransform,
  renderCharacters,
  renderDialog,
  renderCg,
  renderChoicesStatic,
};
