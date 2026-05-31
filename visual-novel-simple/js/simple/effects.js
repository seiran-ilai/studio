// simple/effects.js — 特效系統(13 種)
// 文字級特效套在 #simplePreviewDialog 對話框(class 持久,不被打字機重繪清掉);
// 畫面級特效套在 #simplePreviewStage(class + overlay div + 合成 filter)。
// 強度 0~100 經 CSS 變數傳入。Canvas 輸出於 canvas-renderer.js 以近似方式重現畫面級特效。

const EFFECT_DEFS = [
  // 文字級(只影響對話框內文字)
  { id: "blood_text",     name: "血字滲透", cat: "text" },
  { id: "fade_breathing", name: "漸隱漸現", cat: "text" },
  { id: "glitch_text",    name: "亂碼閃爍", cat: "text" },
  { id: "text_decode",    name: "文字替換", cat: "text" },
  // 畫面級(影響整個預覽框)
  { id: "screen_noise",   name: "雜訊壞掉", cat: "screen" },
  { id: "scanlines",      name: "掃描線",   cat: "screen" },
  { id: "shake",          name: "晃動",     cat: "screen" },
  { id: "out_of_focus",   name: "失焦",     cat: "screen" },
  { id: "vignette",       name: "暗角強化", cat: "screen" },
];

const EFFECT_BY_ID = {};
EFFECT_DEFS.forEach(e => { EFFECT_BY_ID[e.id] = e; });

// 合法特效 id(舊存檔過濾用)
const VALID_EFFECT_IDS = EFFECT_DEFS.map(e => e.id);

const FX_TEXT_CLASSES = ["fx-blood", "fx-breathing", "fx-glitch", "fx-decode"];

// 任務:文字替換亂碼字符池(日文假名 + 符號)
const TEXT_DECODE_CHARS = [].concat(
  "あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん".split(""),
  "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン".split(""),
  "^%#@&*$!?".split("")
);
function randomGlitchChar() {
  return TEXT_DECODE_CHARS[Math.floor(Math.random() * TEXT_DECODE_CHARS.length)];
}
// 只替換中/日文、英數;標點與空白維持
function _isDecodeReplaceable(ch) {
  return /[一-鿿㐀-䶿぀-ヿa-zA-Z0-9]/.test(ch);
}
function getTextDecodeParams(intensity) {
  const t = Math.max(0, Math.min(100, intensity == null ? 50 : intensity)) / 100;
  return {
    typewriterStep: 100,                         // 每 100ms 浮現一個新字
    perCharGlitchDuration: 200 + t * 400,        // 200~600ms 單字解碼動畫時長
    glitchInterval: 60,                          // 60ms 換一次亂碼
    // 任務 2:整段一起閃回(訊號干擾感)
    waveCycle: 8000 - t * 5000,                  // 8s~3s 間隔
    waveDuration: 200 + t * 300,                 // 200~500ms 整段亂碼時長
  };
}
function hasTextDecode(slide) {
  return !!(slide && Array.isArray(slide.effects) && slide.effects.some(e => e.id === "text_decode"));
}
function textDecodeIntensity(slide) {
  const e = slide && Array.isArray(slide.effects) && slide.effects.find(x => x.id === "text_decode");
  return e ? (e.intensity == null ? 50 : e.intensity) : 50;
}
const FX_SCREEN_CLASSES = ["fx-shake"];
const FX_TEXT_VARS = ["--fx-blood-dur", "--fx-blood-sat", "--fx-blood-color", "--fx-decode-color", "--fx-fade-min", "--fx-glitch-amp", "--fx-glitch-speed"];

function _fxIntensity(e) {
  const v = (e && e.intensity != null) ? e.intensity : 50;
  return Math.max(0, Math.min(100, v)) / 100;
}

function _fxOverlay(stage, cls, cb) {
  const o = document.createElement("div");
  o.className = "simple-fx-overlay " + cls;
  o.setAttribute("aria-hidden", "true");
  if (cb) cb(o);
  stage.appendChild(o);
}

// 清除一個 stage / dialogEl 上的所有特效痕跡
function clearSlideEffects(stage, dialogEl) {
  if (stage) {
    FX_SCREEN_CLASSES.forEach(c => stage.classList.remove(c));
    stage.classList.remove("fx-paused");
    stage.style.filter = "";
    stage.style.removeProperty("--fx-shake-amp");
    stage.querySelectorAll(".simple-fx-overlay").forEach(n => n.remove());
  }
  if (dialogEl) {
    clearTextDecode(dialogEl);   // 停掉解碼 timer + 還原文字
    FX_TEXT_CLASSES.forEach(c => dialogEl.classList.remove(c));
    dialogEl.classList.remove("fx-paused");
    FX_TEXT_VARS.forEach(p => dialogEl.style.removeProperty(p));
  }
}

// 把 slide.effects 套到預覽 DOM(編輯模式與播放模式都呼叫;task 1-8)
function applySlideEffects(stage, dialogEl, slide) {
  clearSlideEffects(stage, dialogEl);
  const effects = (slide && Array.isArray(slide.effects)) ? slide.effects : [];
  if (!effects.length) return;
  const filterParts = [];
  const isChoice = !!(slide && slide.type === "choice");
  for (const e of effects) {
    const def = EFFECT_BY_ID[e.id];
    if (!def) continue;
    // 任務 5:選項幕不套用文字級特效(資料保留,只是不套)
    if (isChoice && def.cat === "text") continue;
    const t = _fxIntensity(e);
    if (def.cat === "screen" && stage) {
      switch (e.id) {
        case "shake":
          stage.classList.add("fx-shake");
          stage.style.setProperty("--fx-shake-amp", (1 + t * 9).toFixed(1) + "px");
          break;
        case "out_of_focus":
          filterParts.push(`blur(${(t * 7).toFixed(1)}px)`);
          break;
        case "screen_noise":
          _fxOverlay(stage, "fx-noise", o => o.style.setProperty("--fx-op", (0.08 + t * 0.5).toFixed(2)));
          break;
        case "scanlines":
          _fxOverlay(stage, "fx-scanlines", o => {
            o.style.setProperty("--fx-op", (0.12 + t * 0.45).toFixed(2));
            o.style.setProperty("--fx-speed", (8 - t * 6).toFixed(1) + "s");
          });
          break;
        case "vignette":
          _fxOverlay(stage, "fx-vignette", o => o.style.setProperty("--fx-vig", (0.3 + t * 0.65).toFixed(2)));
          break;
      }
    } else if (def.cat === "text" && dialogEl) {
      switch (e.id) {
        case "blood_text":
          dialogEl.classList.add("fx-blood");
          dialogEl.style.setProperty("--fx-blood-dur", (4 - t * 3).toFixed(1) + "s");
          dialogEl.style.setProperty("--fx-blood-sat", (40 + t * 60).toFixed(0) + "%");
          dialogEl.style.setProperty("--fx-blood-color", e.color || "#a02828");  // 任務 4:可客製色
          break;
        case "fade_breathing":
          dialogEl.classList.add("fx-breathing");
          dialogEl.style.setProperty("--fx-fade-min", (1 - t * 0.8).toFixed(2));
          break;
        case "glitch_text":
          dialogEl.classList.add("fx-glitch");
          dialogEl.style.setProperty("--fx-glitch-amp", (0.5 + t * 3).toFixed(1) + "px");
          dialogEl.style.setProperty("--fx-glitch-speed", (0.26 - t * 0.18).toFixed(2) + "s");
          break;
        case "text_decode":
          // 只加 class 標記;實際逐字解碼動畫需在文字渲染「之後」由 runTextDecode 啟動
          dialogEl.classList.add("fx-decode");
          if (e.color) dialogEl.style.setProperty("--fx-decode-color", e.color);  // 任務 4:可客製亂碼色
          break;
      }
    }
  }
  if (stage) stage.style.filter = filterParts.join(" ");
}

// 暫停 / 恢復:凍結所有 CSS 動畫(animation-play-state: paused)
function setEffectsPaused(stage, dialogEl, paused) {
  if (stage) stage.classList.toggle("fx-paused", !!paused);
  if (dialogEl) dialogEl.classList.toggle("fx-paused", !!paused);
}

// ---------- Canvas 輸出用(畫面級特效近似) ----------

// 回傳要套在 ctx.filter 的字串(blur 類)
function fxCanvasFilter(slide) {
  const fx = (slide && slide.effects) || [];
  const parts = [];
  for (const e of fx) {
    const t = _fxIntensity(e);
    if (e.id === "out_of_focus") parts.push(`blur(${(t * 7).toFixed(1)}px)`);
  }
  return parts.join(" ");
}

// 晃動位移(依時間擺動)
function fxCanvasShake(slide, timeSec) {
  const fx = (slide && slide.effects) || [];
  const e = fx.find(x => x.id === "shake");
  if (!e) return { x: 0, y: 0 };
  const amp = 1 + _fxIntensity(e) * 9;
  return { x: Math.sin(timeSec * 53) * amp, y: Math.cos(timeSec * 71) * amp };
}

function _parseColor(c) {
  if (!c) return [243, 233, 216];
  c = String(c).trim();
  if (c[0] === "#") {
    if (c.length === 4) return [parseInt(c[1] + c[1], 16), parseInt(c[2] + c[2], 16), parseInt(c[3] + c[3], 16)];
    return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
  }
  const m = c.match(/(\d+)\D+(\d+)\D+(\d+)/);
  if (m) return [+m[1], +m[2], +m[3]];
  return [243, 233, 216];
}

// blood_text 在 canvas 上的文字色:由停留進度 prog(0~1)從原色漸變到目標色(任務 4:可客製)
function fxCanvasBloodColor(slide, baseColor, prog) {
  const fx = (slide && slide.effects) || [];
  const e = fx.find(x => x.id === "blood_text");
  if (!e) return baseColor;
  const t = _fxIntensity(e);
  const amt = Math.max(0, Math.min(1, prog)) * (0.4 + t * 0.6);
  const from = _parseColor(baseColor);
  const to = _parseColor(e.color || "#a02828");
  const r = Math.round(from[0] + (to[0] - from[0]) * amt);
  const g = Math.round(from[1] + (to[1] - from[1]) * amt);
  const b = Math.round(from[2] + (to[2] - from[2]) * amt);
  return `rgb(${r}, ${g}, ${b})`;
}

// 畫面級 overlay(在畫完 CG + 對話框「之後」疊上去)
function fxCanvasOverlay(ctx, w, h, slide, timeSec) {
  const fx = (slide && slide.effects) || [];
  for (const e of fx) {
    const t = _fxIntensity(e);
    if (e.id === "vignette") {
      const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.2, w / 2, h / 2, Math.max(w, h) * 0.62);
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(1, `rgba(0,0,0,${(0.3 + t * 0.65).toFixed(2)})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    } else if (e.id === "scanlines") {
      ctx.save();
      ctx.globalAlpha = 0.12 + t * 0.4;
      ctx.fillStyle = "#000";
      const gap = Math.max(2, Math.round(h / 220));
      for (let y = 0; y < h; y += gap * 2) ctx.fillRect(0, y, w, gap);
      ctx.restore();
    } else if (e.id === "screen_noise") {
      _fxCanvasNoise(ctx, w, h, 0.08 + t * 0.5, timeSec);
    }
  }
}

function _fxCanvasNoise(ctx, w, h, opacity, timeSec) {
  ctx.save();
  ctx.globalAlpha = Math.min(0.6, opacity);
  // 以方塊雜訊近似(輕量;seed 隨時間變動)
  const cell = Math.max(3, Math.round(w / 320));
  const seed = Math.floor(timeSec * 24);
  let s = seed * 9301 + 49297;
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  for (let y = 0; y < h; y += cell) {
    for (let x = 0; x < w; x += cell) {
      if (rnd() > 0.55) {
        const v = Math.round(rnd() * 255);
        ctx.fillStyle = `rgb(${v},${v},${v})`;
        ctx.fillRect(x, y, cell, cell);
      }
    }
  }
  ctx.restore();
}

// ---------- 文字替換(DOM 預覽) ----------

// 把一個文字元素的內容包成 .decode-char(可替換)/ .decode-fixed(標點空白)span
function _wrapDecodeChars(el) {
  if (!el || el.dataset.decodeWrapped === "1") return;
  const text = el.textContent || "";
  el.dataset.decodeOrig = text;
  el.dataset.decodeWrapped = "1";
  const frag = document.createDocumentFragment();
  for (const ch of text) {
    const span = document.createElement("span");
    if (_isDecodeReplaceable(ch)) {
      span.className = "decode-char";
      span.dataset.original = ch;
    } else {
      span.className = "decode-fixed";
    }
    span.textContent = ch;
    frag.appendChild(span);
  }
  el.textContent = "";
  el.appendChild(frag);
}

// 在已渲染的對話框上啟動「打字機式逐字解碼」。角色名(speaker)不參與。
function initTextDecode(dialogEl, intensity) {
  if (!dialogEl) return;
  clearTextDecode(dialogEl);
  const params = getTextDecodeParams(intensity);
  // ⚠ 只包對話 / 旁白 / 內心話;角色名不套用
  const targets = dialogEl.querySelectorAll(
    ".simple-preview-narration, .simple-preview-inner, .simple-preview-content");
  targets.forEach(_wrapDecodeChars);
  const slots = Array.prototype.slice.call(dialogEl.querySelectorAll(".decode-char"));
  if (!slots.length) return;
  dialogEl._decodeTimers = [];
  // 初始全部「未顯示」(CSS visibility:hidden,佔位不跳行)
  slots.forEach(s => { s.classList.remove("revealed", "decoding", "decoded", "flicker"); });

  let charIdx = 0;
  const typeTimer = setInterval(() => {
    if (charIdx >= slots.length) {
      clearInterval(typeTimer);
      // 最後一字解碼完 → 進入閃回階段
      const after = setTimeout(() => _startAfterDecodeFlicker(dialogEl, slots, params), params.perCharGlitchDuration);
      dialogEl._decodeTimers.push(after);
      return;
    }
    _revealAndDecodeChar(slots[charIdx], params, dialogEl);
    charIdx++;
  }, params.typewriterStep);
  dialogEl._decodeTimers.push(typeTimer);
}

// 讓一個字「浮現」並開始獨立解碼動畫
function _revealAndDecodeChar(slot, params, dialogEl) {
  slot.classList.add("revealed", "decoding");
  slot.textContent = randomGlitchChar();
  const startTime = Date.now();
  const glitchTimer = setInterval(() => {
    if (Date.now() - startTime >= params.perCharGlitchDuration) {
      clearInterval(glitchTimer);
      slot.textContent = slot.dataset.original;
      slot.classList.remove("decoding");
      slot.classList.add("decoded");
    } else {
      slot.textContent = randomGlitchChar();
    }
  }, params.glitchInterval);
  if (slot._glitchTimer) clearInterval(slot._glitchTimer);
  slot._glitchTimer = glitchTimer;
  if (Array.isArray(dialogEl._decodeTimers)) dialogEl._decodeTimers.push(glitchTimer);
}

// 任務 2:整段一起閃回(每 waveCycle 一次,持續 waveDuration)
function _startAfterDecodeFlicker(dialogEl, slots, params) {
  const waveTimer = setInterval(() => {
    slots.forEach(s => { s.classList.add("flicker"); s.textContent = randomGlitchChar(); });
    const back = setTimeout(() => {
      slots.forEach(s => {
        s.classList.remove("flicker");
        if (s.dataset.original != null) s.textContent = s.dataset.original;
      });
    }, params.waveDuration);
    if (Array.isArray(dialogEl._decodeTimers)) dialogEl._decodeTimers.push(back);
  }, params.waveCycle);
  dialogEl._flickerTimer = waveTimer;
  if (Array.isArray(dialogEl._decodeTimers)) dialogEl._decodeTimers.push(waveTimer);
}

function clearTextDecode(dialogEl) {
  if (!dialogEl) return;
  if (Array.isArray(dialogEl._decodeTimers)) {
    dialogEl._decodeTimers.forEach(t => { clearInterval(t); clearTimeout(t); });
  }
  dialogEl._decodeTimers = [];
  dialogEl._flickerTimer = null;
  // 還原被包過的元素文字
  dialogEl.querySelectorAll("[data-decode-wrapped='1']").forEach(el => {
    if (el.dataset.decodeOrig != null) el.textContent = el.dataset.decodeOrig;
    delete el.dataset.decodeWrapped;
    delete el.dataset.decodeOrig;
  });
}

// 文字渲染「之後」呼叫:若該幕啟用 text_decode 就跑動畫
function runTextDecode(dialogEl, slide) {
  if (!dialogEl || !hasTextDecode(slide)) return;
  initTextDecode(dialogEl, textDecodeIntensity(slide));
}

// ---------- 文字替換(Canvas 輸出) ----------

// 確定性偽隨機(同 seed → 同字,保證 GIF 每幀可重現)
function pseudoRandomChar(timeMs, index) {
  const seed = Math.floor(timeMs / 80) * 7 + index * 31;
  const hash = ((seed % 233280) + 233280) % 233280;
  return TEXT_DECODE_CHARS[hash % TEXT_DECODE_CHARS.length];
}
function pseudoRandomBool(timeMs, index) {
  const seed = Math.floor(timeMs / 200) * 13 + index * 7;
  return (((seed % 7) + 7) % 7) < 3;
}

// 打字機式:第 idx 個可解碼字在 timeSec 的狀態
function _charStateAt(idx, timeSec, params) {
  const revealT = idx * (params.typewriterStep / 1000);
  const settleT = revealT + params.perCharGlitchDuration / 1000;
  if (timeSec < revealT) return "hidden";
  if (timeSec < settleT) return "glitching";
  return "settled";
}

// 解碼版的 wrap 繪字(打字機式)。idxRef.n 為跨呼叫連續的「可解碼字索引」。回傳結束 y。
// 角色名不會走此函式(canvas-renderer 直接 fillText)。
function fxDrawDecodeWrapped(ctx, text, x, y, maxWidth, lineHeight, timeSec, params, idxRef, baseColor, accentColor) {
  let curX = x, curY = y;
  // 任務 2:整段閃回 — 全部字定型後,每 waveCycle 整段一起變亂碼 waveDuration
  const reCount = (text.match(/[一-鿿㐀-䶿぀-ヿa-zA-Z0-9]/g) || []).length;
  const totalSec = (reCount * params.typewriterStep + params.perCharGlitchDuration) / 1000;
  const afterAll = timeSec - totalSec;
  const inWave = afterAll > 0 && (afterAll % (params.waveCycle / 1000)) < (params.waveDuration / 1000);
  for (const ch of text) {
    if (ch === "\n") { curX = x; curY += lineHeight; continue; }
    // 標點 / 空白:永遠正常顯示,不參與打字機
    if (!_isDecodeReplaceable(ch)) {
      const pw = ctx.measureText(ch).width;
      if (curX + pw > x + maxWidth && curX > x) { curX = x; curY += lineHeight; }
      ctx.fillStyle = baseColor;
      ctx.fillText(ch, curX, curY);
      curX += pw;
      continue;
    }
    const idx = idxRef.n; idxRef.n++;
    const st = _charStateAt(idx, timeSec, params);
    let drawCh = ch, color = baseColor, draw = true;
    if (st === "hidden") {
      draw = false;   // 未浮現:佔位(用原字寬度)但不繪
    } else if (st === "glitching") {
      drawCh = pseudoRandomChar(timeSec * 1000, idx);
      color = accentColor;
    } else if (inWave) {
      // settled 且處於整段閃回時段
      drawCh = pseudoRandomChar(timeSec * 1000, idx + 999);
      color = accentColor;
    }
    const w = ctx.measureText(draw ? drawCh : ch).width;
    if (curX + w > x + maxWidth && curX > x) { curX = x; curY += lineHeight; }
    if (draw) { ctx.fillStyle = color; ctx.fillText(drawCh, curX, curY); }
    curX += w;
  }
  return curY + lineHeight;
}

export {
  EFFECT_DEFS,
  EFFECT_BY_ID,
  VALID_EFFECT_IDS,
  getTextDecodeParams,
  hasTextDecode,
  textDecodeIntensity,
  initTextDecode,
  clearTextDecode,
  runTextDecode,
  fxDrawDecodeWrapped,
  applySlideEffects,
  clearSlideEffects,
  setEffectsPaused,
  fxCanvasFilter,
  fxCanvasShake,
  fxCanvasBloodColor,
  fxCanvasOverlay,
};
