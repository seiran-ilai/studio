/* ═══════════════════════════════════════════
   Template Studio — 模板:Music Player
   音樂播放器卡片。註冊到共用 Engine,負責:
   控制面板「播放器」分頁、卡片版面、卡片內容繪製、封面拖曳、自動文字色。
   共用的玻璃 / 版面 / 輸出由 Engine 提供。
   ═══════════════════════════════════════════ */

"use strict";

(function () {

  const E = window.Engine;
  const { $, $$ } = E;

  /* ─ 模板專屬 State ─ */
  const S = {
    // 封面
    cover: null,          // HTMLImageElement(另外上傳時)
    coverMode: "none",    // "none" | "media" | "upload"
    coverSize: 100,       // 封面框大小 60-200 (%)
    coverZoom: 100,       // 框內圖片縮放 100-250 (%)
    coverX: 50,           // 框內圖片水平位置 (%)
    coverY: 50,           // 框內圖片垂直位置 (%)

    // 歌曲
    title: "Midnight Drive",
    artist: "ilai",
    progress: 35,         // 0-100
    songLen: 225,         // 秒
    showControls: true,
    showTime: true,
    animateBar: true,
    ink: "auto",          // "auto" | "light" | "dark"
    inkAuto: "light",     // auto 模式的判定結果

    // 開場動畫
    intro: "slideDown",   // "none" | "fade" | "slideDown" | "slideUp" | "zoom"
    introDur: 0.9,

    // 卡片樣式
    card: "vertical"      // "vertical" | "horizontal"
  };

  /* ─────────────────────────────
     卡片版面(度量以卡片寬為基準)
     ───────────────────────────── */
  function layout(w, h) {
    const s = E.state.cardScale / 100;
    const base = Math.min(w, h);
    const vertical = S.card === "vertical";
    const hasCover = S.coverMode !== "none";

    const cw = vertical ? base * 0.82 * s : base * 0.85 * s;
    const pad = cw * (vertical ? 0.07 : 0.05);

    let ch;
    const m = {};
    if (vertical) {
      m.cover = cw * 0.34 * (S.coverSize / 100);
      m.titleSize = cw * 0.058;
      m.subSize = cw * 0.036;
      m.barH = Math.max(3, cw * 0.0075);
      m.timeSize = cw * 0.028;
      m.playR = cw * 0.052;          // 圓形播放鍵半徑
      m.iconS = cw * 0.042;          // 其他控制圖示尺寸
      m.gapCover = cw * 0.05;
      m.gapSub = cw * 0.02;
      m.gapBar = cw * 0.06;
      m.gapTime = cw * 0.02;
      m.gapCtrl = cw * 0.052;
      ch = pad
         + (hasCover ? m.cover + m.gapCover : 0)
         + m.titleSize + m.gapSub + m.subSize
         + m.gapBar + m.barH
         + (S.showTime ? m.gapTime + m.timeSize : 0)
         + (S.showControls ? m.gapCtrl + m.playR * 2 : 0)
         + pad * 1.1;
    } else {
      m.art = cw * 0.18 * (S.coverSize / 100);
      m.titleSize = cw * 0.044;
      m.subSize = cw * 0.030;
      m.barH = Math.max(3, cw * 0.007);
      m.timeSize = cw * 0.024;
      m.playR = cw * 0.036;
      m.iconS = cw * 0.030;
      m.gapBar = cw * 0.032;
      m.gapTime = cw * 0.016;
      m.gapCtrl = cw * 0.030;
      const headH = hasCover ? m.art : m.titleSize + m.subSize + cw * 0.014;
      ch = pad * 2 + headH
         + m.gapBar + m.barH + (S.showTime ? m.gapTime + m.timeSize : 0)
         + (S.showControls ? m.gapCtrl + m.playR * 2 : 0);
    }

    const cx = (w - cw) * (E.state.cardX / 100);
    const cy = (h - ch) * (E.state.cardY / 100);
    const r = E.state.radius * (cw / 880);   // 圓角隨卡片寬縮放

    return { cx, cy, cw, ch, pad, r, vertical, m };
  }

  /* ─────────────────────────────
     開場動畫
     ───────────────────────────── */
  function applyIntro(L, t) {
    if (S.intro === "none") return null;
    const e = Math.min(1, t / S.introDur);
    const ease = 1 - Math.pow(1 - e, 3);   // easeOutCubic
    let zoom = 1;
    if (S.intro === "slideDown") L.cy -= (1 - ease) * L.ch * 0.5;
    if (S.intro === "slideUp") L.cy += (1 - ease) * L.ch * 0.5;
    if (S.intro === "zoom") zoom = 0.85 + 0.15 * ease;
    return { alpha: ease, zoom };
  }

  /* ─────────────────────────────
     卡片內容
     ───────────────────────────── */
  function inkColors() {
    const mode = S.ink === "auto" ? S.inkAuto : S.ink;
    if (mode === "dark") {
      return { main: "rgba(20,22,28,0.96)", sub: "rgba(20,22,28,0.6)", track: "rgba(20,22,28,0.18)" };
    }
    return { main: "rgba(255,255,255,0.97)", sub: "rgba(255,255,255,0.66)", track: "rgba(255,255,255,0.25)" };
  }

  function fmtTime(sec) {
    sec = Math.max(0, Math.round(sec));
    return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
  }

  function currentProgress(t) {
    if (!S.animateBar) return S.progress / 100;
    const p0 = S.progress / 100;
    return (p0 + t / S.songLen) % 1;
  }

  function drawCover(c, x, y, size, r) {
    c.save();
    E.roundRectPath(c, x, y, size, size, r);
    c.clip();
    const src = (S.coverMode === "upload" && S.cover) ? S.cover : E.state.media;
    if (src) {
      const sw = E.state.isVideo && src === E.state.media ? src.videoWidth : src.naturalWidth || src.videoWidth;
      const sh = E.state.isVideo && src === E.state.media ? src.videoHeight : src.naturalHeight || src.videoHeight;
      const sc = Math.max(size / sw, size / sh) * (S.coverZoom / 100);
      const dw = sw * sc;
      const dh = sh * sc;
      c.drawImage(src,
        x + (size - dw) * (S.coverX / 100),
        y + (size - dh) * (S.coverY / 100),
        dw, dh);
    } else {
      c.fillStyle = "#2a3148";
      c.fillRect(x, y, size, size);
    }
    // 封面內側光
    const g = c.createLinearGradient(x, y, x, y + size);
    g.addColorStop(0, "rgba(255,255,255,0.1)");
    g.addColorStop(0.25, "rgba(255,255,255,0)");
    c.fillStyle = g;
    c.fillRect(x, y, size, size);
    c.restore();
    E.roundRectPath(c, x, y, size, size, r);
    c.strokeStyle = "rgba(255,255,255,0.14)";
    c.lineWidth = Math.max(1, size * 0.004);
    c.stroke();
  }

  // 封面在畫布上的矩形(拖曳判定用);沒顯示封面回傳 null
  function coverRect(L) {
    if (S.coverMode === "none") return null;
    if (L.vertical) {
      const size = L.m.cover;
      return { x: L.cx + L.cw / 2 - size / 2, y: L.cy + L.pad, size };
    }
    return { x: L.cx + L.pad, y: L.cy + L.pad, size: L.m.art };
  }

  function truncateText(c, text, maxW) {
    if (c.measureText(text).width <= maxW) return text;
    while (text.length > 1 && c.measureText(text + "…").width > maxW) {
      text = text.slice(0, -1);
    }
    return text + "…";
  }

  function drawIconPrev(c, x, y, s, color) {
    c.fillStyle = color;
    c.fillRect(x - s * 0.5, y - s * 0.42, s * 0.12, s * 0.84);
    c.beginPath();
    c.moveTo(x + s * 0.5, y - s * 0.42);
    c.lineTo(x + s * 0.5, y + s * 0.42);
    c.lineTo(x - s * 0.28, y);
    c.closePath();
    c.fill();
  }

  function drawIconNext(c, x, y, s, color) {
    c.fillStyle = color;
    c.fillRect(x + s * 0.38, y - s * 0.42, s * 0.12, s * 0.84);
    c.beginPath();
    c.moveTo(x - s * 0.5, y - s * 0.42);
    c.lineTo(x - s * 0.5, y + s * 0.42);
    c.lineTo(x + s * 0.28, y);
    c.closePath();
    c.fill();
  }

  // 圓形播放/暫停鍵(實心圓 + 反色符號)
  function drawIconPlayCircle(c, x, y, r, color, inverse, playing) {
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fillStyle = color;
    c.fill();
    c.fillStyle = inverse;
    if (playing) {
      const bw = r * 0.24;
      const bh = r * 0.78;
      const gap = r * 0.16;
      E.roundRectPath(c, x - gap - bw, y - bh / 2, bw, bh, bw * 0.3);
      c.fill();
      E.roundRectPath(c, x + gap, y - bh / 2, bw, bh, bw * 0.3);
      c.fill();
    } else {
      const s = r * 0.85;
      c.beginPath();
      c.moveTo(x - s * 0.34, y - s * 0.5);
      c.lineTo(x - s * 0.34, y + s * 0.5);
      c.lineTo(x + s * 0.62, y);
      c.closePath();
      c.fill();
    }
  }

  function drawIconHeart(c, x, y, s, color) {
    c.save();
    c.translate(x, y);
    c.scale(s / 24, s / 24);
    c.beginPath();
    c.moveTo(0, 8);
    c.bezierCurveTo(-12, -1, -8.5, -13, 0, -6.5);
    c.bezierCurveTo(8.5, -13, 12, -1, 0, 8);
    c.closePath();
    c.strokeStyle = color;
    c.lineWidth = 2.2;
    c.lineJoin = "round";
    c.stroke();
    c.restore();
  }

  // 隨機播放:兩條交叉曲線 + 右端箭頭
  function drawIconShuffle(c, x, y, s, color) {
    c.save();
    c.strokeStyle = color;
    c.fillStyle = color;
    c.lineWidth = Math.max(1, s * 0.1);
    c.lineCap = "round";
    c.lineJoin = "round";
    const L = s * 0.55;
    const hh = s * 0.34;
    // 左下 → 右上
    c.beginPath();
    c.moveTo(x - L, y + hh);
    c.bezierCurveTo(x - L * 0.3, y + hh, x + L * 0.3, y - hh, x + L, y - hh);
    c.stroke();
    // 左上 → 右下
    c.beginPath();
    c.moveTo(x - L, y - hh);
    c.bezierCurveTo(x - L * 0.3, y - hh, x + L * 0.3, y + hh, x + L, y + hh);
    c.stroke();
    // 箭頭
    const ah = s * 0.2;
    for (const dir of [-1, 1]) {
      c.beginPath();
      c.moveTo(x + L + ah, y + hh * dir);
      c.lineTo(x + L - ah * 0.35, y + hh * dir - ah * 0.85);
      c.lineTo(x + L - ah * 0.35, y + hh * dir + ah * 0.85);
      c.closePath();
      c.fill();
    }
    c.restore();
  }

  function drawProgressBar(c, x, y, w, h, p, ink) {
    // 軌道
    E.roundRectPath(c, x, y, w, h, h / 2);
    c.fillStyle = ink.track;
    c.fill();
    // 進度
    const fw = Math.max(h, w * p);
    E.roundRectPath(c, x, y, fw, h, h / 2);
    c.fillStyle = ink.main;
    c.fill();
    // 圓點
    c.beginPath();
    c.arc(x + fw, y + h / 2, h * 1.7, 0, Math.PI * 2);
    c.fillStyle = ink.main;
    c.fill();
  }

  function drawContent(c, w, h, L, t) {
    const { cx, cy, cw, ch, pad, r, vertical, m } = L;
    const ink = inkColors();
    const p = currentProgress(t);
    const mode = S.ink === "auto" ? S.inkAuto : S.ink;
    const inverse = mode === "dark" ? "rgba(250,250,252,0.97)" : "rgba(22,24,30,0.95)";
    const hasCover = S.coverMode !== "none";
    const mid = cx + cw / 2;

    if (vertical) {
      let y = cy + pad;

      if (hasCover) {
        drawCover(c, mid - m.cover / 2, y, m.cover, r * 0.5);
        y += m.cover + m.gapCover;
      }

      c.textBaseline = "top";
      c.textAlign = "center";
      c.font = `700 ${m.titleSize}px "Noto Sans TC", sans-serif`;
      c.fillStyle = ink.main;
      c.fillText(truncateText(c, S.title, cw - pad * 2), mid, y);
      y += m.titleSize + m.gapSub;

      c.font = `500 ${m.subSize}px "Noto Sans TC", sans-serif`;
      c.fillStyle = ink.sub;
      c.fillText(truncateText(c, S.artist, cw - pad * 2), mid, y);
      y += m.subSize + m.gapBar;

      drawProgressBar(c, cx + pad, y, cw - pad * 2, m.barH, p, ink);
      y += m.barH;

      if (S.showTime) {
        y += m.gapTime;
        c.textBaseline = "top";
        c.font = `500 ${m.timeSize}px Inter, sans-serif`;
        c.fillStyle = ink.sub;
        c.textAlign = "left";
        c.fillText(fmtTime(p * S.songLen), cx + pad, y);
        c.textAlign = "right";
        c.fillText(fmtTime(S.songLen), cx + cw - pad, y);
        y += m.timeSize;
      }

      if (S.showControls) {
        y += m.gapCtrl;
        const cyy = y + m.playR;
        const sp = cw * 0.155;
        drawIconShuffle(c, mid - sp * 2, cyy, m.iconS, ink.main);
        drawIconPrev(c, mid - sp, cyy, m.iconS, ink.main);
        drawIconPlayCircle(c, mid, cyy, m.playR, ink.main, inverse, S.animateBar);
        drawIconNext(c, mid + sp, cyy, m.iconS, ink.main);
        drawIconHeart(c, mid + sp * 2, cyy, m.iconS, ink.main);
        y += m.playR * 2;
      }
    } else {
      // 橫式:封面(可選)在左,文字在右,進度與控制鍵在下
      const headY = cy + pad;
      let tx = cx + pad;
      let textW = cw - pad * 2;

      if (hasCover) {
        drawCover(c, cx + pad, headY, m.art, r * 0.5);
        tx = cx + pad + m.art + pad * 0.9;
        textW = cx + cw - pad - tx;
      }

      c.textBaseline = "top";
      c.textAlign = "left";
      c.font = `700 ${m.titleSize}px "Noto Sans TC", sans-serif`;
      c.fillStyle = ink.main;
      c.fillText(truncateText(c, S.title, textW), tx, headY + (hasCover ? m.art * 0.06 : 0));
      c.font = `500 ${m.subSize}px "Noto Sans TC", sans-serif`;
      c.fillStyle = ink.sub;
      c.fillText(truncateText(c, S.artist, textW), tx, headY + m.titleSize + cw * 0.014 + (hasCover ? m.art * 0.06 : 0));

      let y = headY + (hasCover ? m.art : m.titleSize + m.subSize + cw * 0.014) + m.gapBar;
      drawProgressBar(c, cx + pad, y, cw - pad * 2, m.barH, p, ink);
      y += m.barH;

      if (S.showTime) {
        y += m.gapTime;
        c.textBaseline = "top";
        c.font = `500 ${m.timeSize}px Inter, sans-serif`;
        c.fillStyle = ink.sub;
        c.textAlign = "left";
        c.fillText(fmtTime(p * S.songLen), cx + pad, y);
        c.textAlign = "right";
        c.fillText(fmtTime(S.songLen), cx + cw - pad, y);
        y += m.timeSize;
      }

      if (S.showControls) {
        y += m.gapCtrl;
        const cyy = y + m.playR;
        const sp = cw * 0.085;
        drawIconShuffle(c, mid - sp * 2, cyy, m.iconS, ink.main);
        drawIconPrev(c, mid - sp, cyy, m.iconS, ink.main);
        drawIconPlayCircle(c, mid, cyy, m.playR, ink.main, inverse, S.animateBar);
        drawIconNext(c, mid + sp, cyy, m.iconS, ink.main);
        drawIconHeart(c, mid + sp * 2, cyy, m.iconS, ink.main);
      }
    }
  }

  /* ─────────────────────────────
     封面拖曳(平移框內圖片)
     ───────────────────────────── */
  const coverDrag = { active: false, lastX: 0, lastY: 0 };

  // 封面圖片在框內的溢出量(≤0,為 0 表示該方向無法平移)
  function coverOverflow(size) {
    const src = (S.coverMode === "upload" && S.cover) ? S.cover : E.state.media;
    if (!src) return { ox: 0, oy: 0 };
    const sw = src.videoWidth || src.naturalWidth;
    const sh = src.videoHeight || src.naturalHeight;
    const sc = Math.max(size / sw, size / sh) * (S.coverZoom / 100);
    return { ox: size - sw * sc, oy: size - sh * sc };
  }

  function hitTest(px, py, L) {
    const cr = coverRect(L);
    if (cr && px >= cr.x && px <= cr.x + cr.size && py >= cr.y && py <= cr.y + cr.size) {
      coverDrag.active = true;
      coverDrag.lastX = px;
      coverDrag.lastY = py;
      return true;
    }
    return false;
  }

  function dragMove(px, py) {
    if (!coverDrag.active) return;
    const L = layout(E.cv.width, E.cv.height);
    const cr = coverRect(L);
    if (cr) {
      const { ox, oy } = coverOverflow(cr.size);
      if (ox < 0) {
        S.coverX = Math.min(100, Math.max(0, S.coverX + ((px - coverDrag.lastX) * 100) / ox));
        $("#coverX").value = S.coverX;
        $("#coverXVal").textContent = Math.round(S.coverX) + "%";
      }
      if (oy < 0) {
        S.coverY = Math.min(100, Math.max(0, S.coverY + ((py - coverDrag.lastY) * 100) / oy));
        $("#coverY").value = S.coverY;
        $("#coverYVal").textContent = Math.round(S.coverY) + "%";
      }
    }
    coverDrag.lastX = px;
    coverDrag.lastY = py;
  }

  function dragEnd() {
    coverDrag.active = false;
  }

  /* ─────────────────────────────
     自動文字顏色
     ───────────────────────────── */
  function onInk() {
    const lum = E.cardLuminance(layout(E.cv.width, E.cv.height));
    S.inkAuto = lum > 0.62 ? "dark" : "light";
  }

  // PNG 輸出時的時間點(進度條停在當下)
  function stillTime() {
    return S.animateBar ? E.clock() : 0;
  }

  /* ─────────────────────────────
     控制面板:播放器分頁
     ───────────────────────────── */
  function buildPanel(api) {
    api.addTab("播放器", buildPlayerTab);
  }

  function buildPlayerTab(panel) {
    panel.innerHTML = `
      <div class="group">
        <div class="group-title">歌曲資訊</div>
        <label class="field">
          <span class="field-label">歌名</span>
          <input type="text" id="songTitle" value="Midnight Drive" maxlength="40" spellcheck="false">
        </label>
        <label class="field">
          <span class="field-label">演出者</span>
          <input type="text" id="songArtist" value="ilai" maxlength="40" spellcheck="false">
        </label>
      </div>

      <div class="group">
        <div class="group-title">卡片樣式</div>
        <div class="row">
          <button class="seg-btn on" data-card="vertical" type="button">直式(大封面)</button>
          <button class="seg-btn" data-card="horizontal" type="button">橫式(小封面)</button>
        </div>
      </div>

      <div class="group">
        <div class="group-title">封面</div>
        <div class="row">
          <button class="seg-btn on" data-cover="none" type="button">不顯示</button>
          <button class="seg-btn" data-cover="media" type="button">使用素材</button>
          <button class="seg-btn" data-cover="upload" id="coverUploadBtn" type="button">另外上傳</button>
        </div>
        <input type="file" id="coverFi" accept="image/*" hidden>
        <div id="coverAdjust" style="display:none; margin-top:12px;">
          <label class="slider-row">
            <span class="field-label">封面大小 <b id="coverSizeVal">100%</b></span>
            <input type="range" id="coverSize" min="60" max="200" value="100">
          </label>
          <label class="slider-row">
            <span class="field-label">圖片縮放 <b id="coverZoomVal">100%</b></span>
            <input type="range" id="coverZoom" min="100" max="250" value="100">
          </label>
          <label class="slider-row">
            <span class="field-label">圖片水平 <b id="coverXVal">50%</b></span>
            <input type="range" id="coverX" min="0" max="100" value="50">
          </label>
          <label class="slider-row">
            <span class="field-label">圖片垂直 <b id="coverYVal">50%</b></span>
            <input type="range" id="coverY" min="0" max="100" value="50">
          </label>
          <p class="hint">也可以直接在預覽的封面上拖曳,移動圖片顯示範圍。</p>
        </div>
      </div>

      <div class="group">
        <div class="group-title">播放狀態</div>
        <label class="slider-row">
          <span class="field-label">播放進度 <b id="progressVal">35%</b></span>
          <input type="range" id="playProgress" min="0" max="100" value="35">
        </label>
        <label class="field">
          <span class="field-label">歌曲長度 <b id="songLenVal">3:45</b></span>
          <input type="text" id="songLenText" value="3:45" spellcheck="false" placeholder="3:45 或 225(秒)">
        </label>
        <div class="row toggles">
          <label class="check"><input type="checkbox" id="showControls" checked><span>控制鍵</span></label>
          <label class="check"><input type="checkbox" id="showTime" checked><span>時間</span></label>
          <label class="check"><input type="checkbox" id="animateBar" checked><span>進度動畫</span></label>
        </div>
      </div>

      <div class="group">
        <div class="group-title">開場動畫</div>
        <div class="row intro-row">
          <button class="seg-btn" data-intro="none" type="button">無</button>
          <button class="seg-btn" data-intro="fade" type="button">淡入</button>
          <button class="seg-btn on" data-intro="slideDown" type="button">上方滑入</button>
          <button class="seg-btn" data-intro="slideUp" type="button">下方滑入</button>
          <button class="seg-btn" data-intro="zoom" type="button">縮放浮現</button>
        </div>
        <label class="slider-row" style="margin-top:10px;">
          <span class="field-label">動畫時長 <b id="introDurVal">0.9s</b></span>
          <input type="range" id="introDur" min="0.3" max="2" step="0.1" value="0.9">
        </label>
        <button class="seg-btn" id="introReplay" type="button" style="width:100%;">↻ 重播開場動畫</button>
      </div>

      <div class="group">
        <div class="group-title">文字顏色</div>
        <div class="row">
          <button class="seg-btn on" data-ink="auto" type="button">自動</button>
          <button class="seg-btn" data-ink="light" type="button">亮色</button>
          <button class="seg-btn" data-ink="dark" type="button">暗色</button>
        </div>
      </div>`;

    bindPlayerControls();
  }

  function bindPlayerControls() {
    // 文字
    $("#songTitle").addEventListener("input", e => { S.title = e.target.value || " "; });
    $("#songArtist").addEventListener("input", e => { S.artist = e.target.value || " "; });

    // 卡片樣式
    $$("[data-card]").forEach(btn => {
      btn.addEventListener("click", () => {
        S.card = btn.dataset.card;
        $$("[data-card]").forEach(x => x.classList.toggle("on", x === btn));
        E.requestInk();
      });
    });

    // 封面來源
    const coverFi = $("#coverFi");
    coverFi.addEventListener("change", () => {
      const f = coverFi.files[0];
      if (!f) return;
      const img = new Image();
      img.onload = () => {
        S.cover = img;
        S.coverMode = "upload";
        syncCoverButtons();
        E.requestInk();
      };
      img.src = URL.createObjectURL(f);
      coverFi.value = "";
    });
    $$("[data-cover]").forEach(btn => {
      btn.addEventListener("click", () => {
        if (btn.dataset.cover === "upload") {
          // 已有上傳過的封面就直接切換,否則開檔案選擇
          if (S.cover) {
            S.coverMode = "upload";
            syncCoverButtons();
          } else {
            coverFi.click();
          }
          return;
        }
        S.coverMode = btn.dataset.cover;
        syncCoverButtons();
        E.requestInk();
      });
    });
    E.bindRange("#coverSize", "#coverSizeVal", v => { S.coverSize = v; }, v => v + "%");
    E.bindRange("#coverZoom", "#coverZoomVal", v => { S.coverZoom = v; }, v => v + "%");
    E.bindRange("#coverX", "#coverXVal", v => { S.coverX = v; }, v => v + "%");
    E.bindRange("#coverY", "#coverYVal", v => { S.coverY = v; }, v => v + "%");

    // 播放狀態
    E.bindRange("#playProgress", "#progressVal", v => { S.progress = v; E.resetClock(); }, v => v + "%");
    $("#songLenText").addEventListener("input", e => {
      const v = parseTimeInput(e.target.value);
      e.target.style.borderColor = v ? "" : "rgba(232,176,74,0.7)";
      if (v) {
        S.songLen = v;
        $("#songLenVal").textContent = fmtTime(v);
      }
    });
    $("#songLenText").addEventListener("blur", e => {
      // 失焦時正規化顯示
      if (parseTimeInput(e.target.value)) e.target.value = fmtTime(S.songLen);
      e.target.style.borderColor = "";
    });
    $("#showControls").addEventListener("change", e => { S.showControls = e.target.checked; });
    $("#showTime").addEventListener("change", e => { S.showTime = e.target.checked; });
    $("#animateBar").addEventListener("change", e => { S.animateBar = e.target.checked; E.resetClock(); });

    // 開場動畫
    $$("[data-intro]").forEach(btn => {
      btn.addEventListener("click", () => {
        S.intro = btn.dataset.intro;
        $$("[data-intro]").forEach(x => x.classList.toggle("on", x === btn));
        E.resetClock();
      });
    });
    E.bindRange("#introDur", "#introDurVal", v => { S.introDur = v; E.resetClock(); }, v => v.toFixed(1) + "s");
    $("#introReplay").addEventListener("click", E.resetClock);

    // 文字顏色
    $$("[data-ink]").forEach(btn => {
      btn.addEventListener("click", () => {
        S.ink = btn.dataset.ink;
        $$("[data-ink]").forEach(x => x.classList.toggle("on", x === btn));
      });
    });
  }

  function syncCoverButtons() {
    $$("[data-cover]").forEach(b => b.classList.toggle("on", b.dataset.cover === S.coverMode));
    $("#coverAdjust").style.display = S.coverMode === "none" ? "none" : "";
  }

  // 歌曲長度:手動輸入 mm:ss 或純秒數
  function parseTimeInput(s) {
    s = s.trim();
    const m = s.match(/^(\d{1,3}):([0-5]?\d)$/);
    if (m) return Math.min(5999, Number(m[1]) * 60 + Number(m[2]));
    if (/^\d+$/.test(s)) return Math.min(5999, Number(s));
    return null;
  }

  /* ─ 註冊到引擎 ─ */
  E.register({
    id: "music",
    name: "Music Player",
    desc: "音樂播放器卡片",
    badge: "Music Player",
    filePrefix: "template_music",
    thumb: `<i class="thumb-art"></i><i class="thumb-line w1"></i><i class="thumb-line w2"></i><i class="thumb-bar"></i>`,
    buildPanel,
    layout,
    drawContent,
    applyIntro,
    hitTest,
    dragMove,
    dragEnd,
    onInk,
    stillTime
  });

})();
