'use strict';

// ═══════════════════════════════════════════
// C1 全域狀態
// ═══════════════════════════════════════════
const FPS = 15;

// 預設段落範本
function newTxt(overrides = {}) {
  return {
    id: Date.now() + Math.random(),
    text: '',
    font: 'orbitron',
    lang: 'en',
    x: 0.5, y: 0.5,
    size: 42,
    opacity: 90,
    lineH: 1.2,
    letterSpacing: 0,
    strokeWidth: 0.04,
    color: '#ffffff',
    align: 'center',
    valign: 'middle',           // 垂直書寫專用：top / middle / bottom
    bold: false, italic: false, underline: false, shadow: false,
    rotate: 0,                  // -180~180 度
    bgEnable: false,            // 背景色塊
    bgColor: '#000000',
    bgOpacity: 60,              // 0~100
    bgPad: 10,                  // px
    glow: false,                // 外光
    glowSize: 15,               // 0~40
    border: false,              // 外框
    borderW: 2,                 // px
    vertical: false,            // 垂直書寫
    effect: 'none',
    ...overrides
  };
}

const state = {
  img: null,                    // 圖片（HTMLImageElement）
  video: null,                  // 影片（HTMLVideoElement）
  isVideo: false,               // 當前媒體是否為影片
  trimStart: 0,                 // 影片剪輯起點（秒）
  trimEnd: 0,                   // 影片剪輯終點（秒，0 表示用影片總長）
  fx: 'film',
  duration: 2,
  resMode: 'recommended',
  customWidth: 1080,
  quality: 'standard',          // 'low' | 'standard' | 'high' | 'ultra'
  livePreview: true,
  paused: false,
  raf: null,

  // 強度 0-10
  NO: 5, CO: 5, DK: 5, HU: 5, SP: 5,
  HUE: 0, SAT: 100,
  focusMode: 'auto',

  // 多段文字
  txts: [newTxt()],
  selectedTxt: 0
};

/** 取得當前選中的文字段落 */
function curTxt() { return state.txts[state.selectedTxt]; }

const FONTS = {
  orbitron: { css: "'Orbitron', sans-serif", weight: '700' },
  tech: { css: "'Share Tech Mono', monospace", weight: '400' },
  vt: { css: "'VT323', monospace", weight: '400' },
  major: { css: "'Major Mono Display', monospace", weight: '400' },
  bebas: { css: "'Bebas Neue', sans-serif", weight: '400' },
  pixel: { css: "'Press Start 2P', cursive", weight: '400' },
  'jp-sans': { css: "'Noto Sans JP', sans-serif", weight: '900' },
  'jp-serif': { css: "'Noto Serif JP', serif", weight: '700' },
  'jp-round': { css: "'M PLUS Rounded 1c', sans-serif", weight: '700' },
  'jp-maru': { css: "'Zen Maru Gothic', sans-serif", weight: '700' },
  huninn: { css: "'Huninn', sans-serif", weight: '400' },
  chenyu: { css: "'ChenYuluoyan', cursive", weight: '400' },
  naikai: { css: "'NaikaiFont', sans-serif", weight: '400' }
};

const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const cv = $('#cvs');
const ctx = cv.getContext('2d');
const dz = $('#dz');

// ═══════════════════════════════════════════
// C2 媒體上傳（圖片 / 影片）
// ═══════════════════════════════════════════
$('#fi').addEventListener('change', e => {
  if (e.target.files[0]) loadFile(e.target.files[0]);
});

dz.addEventListener('dragover', e => { e.preventDefault(); dz.style.borderColor = '#444'; });
dz.addEventListener('dragleave', () => dz.style.borderColor = '');
dz.addEventListener('drop', e => {
  e.preventDefault();
  dz.style.borderColor = '';
  if (e.dataTransfer.files[0]) loadFile(e.dataTransfer.files[0]);
});

$('#btnReplace').addEventListener('click', () => $('#fi').click());

/** 共用：套用媒體尺寸並啟用 UI */
function setupMedia(naturalW, naturalH) {
  const rec = recommendedSize(naturalW, naturalH);
  cv.width = rec.w;
  cv.height = rec.h;
  cv.style.display = 'block';
  $('#uploadPrompt').style.display = 'none';
  dz.classList.add('has');
  $('#btnPng').disabled = $('#btnGif').disabled = $('#btnMp4').disabled = false;
  $('#btnReplace').style.display = 'inline-block';
  $('#btnPause').style.display = 'inline-block';
  $('#metaSize').textContent = `${cv.width}×${cv.height}`;

  // 影片不需要「輸出長度」設定（直接用影片時長）
  const durSec = $('#durSection');
  if (durSec) durSec.style.display = state.isVideo ? 'none' : 'block';

  updateResInfo();
  play();
}

/** 釋放當前媒體資源 */
function clearMedia() {
  if (state.video) {
    state.video.pause();
    URL.revokeObjectURL(state.video.src);
    state.video = null;
  }
  if (state.img) {
    URL.revokeObjectURL(state.img.src);
    state.img = null;
  }
  state.isVideo = false;
}

// ─── 影片時間軸（剪輯起訖點 + 播放頭） ───
function initTrimBar() {
  const v = state.video;
  if (!v) return;

  $('#trimDur').textContent = `總長 ${v.duration.toFixed(1)}s`;
  updateTrimUI();

  // 播放頭跟著影片時間更新
  if (window._trimRaf) cancelAnimationFrame(window._trimRaf);
  const updatePlayhead = () => {
    if (!state.isVideo || !state.video) return;
    const pct = (state.video.currentTime / state.video.duration) * 100;
    $('#trimPlayhead').style.left = pct + '%';
    // 播放到結尾自動跳回起點（loop 邏輯）
    if (state.video.currentTime >= state.trimEnd && !state.video.paused) {
      state.video.currentTime = state.trimStart;
    }
    window._trimRaf = requestAnimationFrame(updatePlayhead);
  };
  updatePlayhead();
}

function updateTrimUI() {
  const v = state.video;
  if (!v) return;
  const startPct = (state.trimStart / v.duration) * 100;
  const endPct = (state.trimEnd / v.duration) * 100;
  $('#trimRange').style.left = startPct + '%';
  $('#trimRange').style.width = (endPct - startPct) + '%';
  $('#trimStart').style.left = startPct + '%';
  $('#trimEnd').style.left = endPct + '%';
  $('#trimStartTime').textContent = state.trimStart.toFixed(1) + 's';
  $('#trimEndTime').textContent = state.trimEnd.toFixed(1) + 's';
  $('#trimDur').textContent = `剪輯 ${(state.trimEnd - state.trimStart).toFixed(1)}s`;
}

// 拖曳起訖點
let trimDrag = null;
const trimTrack = document.querySelector('.trim-track');

['#trimStart', '#trimEnd'].forEach(sel => {
  const el = document.querySelector(sel);
  if (!el) return;
  el.addEventListener('pointerdown', e => {
    e.stopPropagation();
    trimDrag = { type: sel === '#trimStart' ? 'start' : 'end' };
    el.setPointerCapture(e.pointerId);
  });
});

document.addEventListener('pointermove', e => {
  if (!trimDrag || !state.video) return;
  const r = trimTrack.getBoundingClientRect();
  const pct = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
  const t = pct * state.video.duration;
  if (trimDrag.type === 'start') {
    state.trimStart = Math.min(t, state.trimEnd - 0.1);
    if (state.video.currentTime < state.trimStart) state.video.currentTime = state.trimStart;
  } else {
    state.trimEnd = Math.max(t, state.trimStart + 0.1);
  }
  updateTrimUI();
});

document.addEventListener('pointerup', () => { trimDrag = null; });

// 點擊時間軸跳到該位置
trimTrack && trimTrack.addEventListener('click', e => {
  if (!state.video || trimDrag) return;
  if (e.target.classList.contains('trim-handle')) return;
  const r = trimTrack.getBoundingClientRect();
  const pct = (e.clientX - r.left) / r.width;
  state.video.currentTime = pct * state.video.duration;
});

function loadFile(file) {
  clearMedia();

  if (file.type.startsWith('video/')) {
    loadVideo(file);
  } else if (file.type.startsWith('image/')) {
    loadImage(file);
  } else {
    alert('不支援的檔案格式，請上傳圖片或影片');
  }
}

function loadImage(file) {
  const img = new Image();
  img.onload = () => {
    state.img = img;
    state.isVideo = false;
    setupMedia(img.naturalWidth, img.naturalHeight);
    $('#metaFx').textContent = state.fx === 'err' ? '404' : state.fx.toUpperCase();
    $('#trimBar').style.display = 'none';
  };
  img.src = URL.createObjectURL(file);
}

function loadVideo(file) {
  const v = document.createElement('video');
  v.muted = true;             // 必須靜音才能 autoplay
  v.loop = true;              // 自動循環
  v.playsInline = true;
  v.crossOrigin = 'anonymous';

  v.onloadedmetadata = () => {
    state.video = v;
    state.isVideo = true;
    state.trimStart = 0;
    state.trimEnd = v.duration;
    setupMedia(v.videoWidth, v.videoHeight);

    // 顯示影片時長到 meta
    const dur = v.duration.toFixed(1);
    $('#metaSize').textContent = `${cv.width}×${cv.height} · ${dur}s`;

    // 顯示時間軸並初始化
    $('#trimBar').style.display = 'flex';
    initTrimBar();

    v.play().catch(err => {
      console.warn('autoplay failed:', err);
    });
  };

  v.onerror = () => {
    alert('影片載入失敗，請檢查格式（支援 MP4 / WebM / MOV）');
  };

  v.src = URL.createObjectURL(file);
  v.load();
}

function recommendedSize(w, h) {
  const MAX = 1080;
  if (w <= MAX) return { w, h };
  return { w: MAX, h: Math.round(h * MAX / w) };
}

// ═══════════════════════════════════════════
// C3 控制元件監聽
// ═══════════════════════════════════════════

// Tabs
$$('.tab').forEach(b => b.addEventListener('click', () => {
  $$('.tab').forEach(x => x.classList.remove('on'));
  b.classList.add('on');
  $$('.panel').forEach(p => p.classList.remove('on'));
  $(`.panel[data-panel="${b.dataset.tab}"]`).classList.add('on');
}));

// UI 大小
$$('.us-btn').forEach(b => b.addEventListener('click', () => {
  $$('.us-btn').forEach(x => x.classList.remove('on'));
  b.classList.add('on');
  document.documentElement.style.setProperty('--ui-scale', b.dataset.size);
}));

// ─── 段落清單管理 ───
function renderTxtList() {
  const list = $('#txtList');
  list.innerHTML = '';
  state.txts.forEach((tx, i) => {
    const row = document.createElement('div');
    row.className = 'txt-row' + (i === state.selectedTxt ? ' on' : '');
    const preview = (tx.text || '(空白段落)').replace(/\n/g, ' ').slice(0, 24);
    const isEmpty = !tx.text;
    const isFirst = i === 0;
    const isLast = i === state.txts.length - 1;
    row.innerHTML = `
      <span class="preview${isEmpty ? ' empty' : ''}">${i+1}. ${preview}</span>
      <button class="layer-btn" data-act="up"   ${isFirst ? 'disabled' : ''} title="上移（往背景）">▲</button>
      <button class="layer-btn" data-act="down" ${isLast  ? 'disabled' : ''} title="下移（往前景）">▼</button>
      <button class="del" title="刪除">×</button>
    `;
    row.addEventListener('click', e => {
      if (e.target.tagName === 'BUTTON') return;
      state.selectedTxt = i;
      syncEditorFromCurrent();
      renderTxtList();
    });

    // 上移：跟前一個交換
    row.querySelector('[data-act="up"]').addEventListener('click', e => {
      e.stopPropagation();
      if (i === 0) return;
      [state.txts[i-1], state.txts[i]] = [state.txts[i], state.txts[i-1]];
      // 跟著移動選中
      if (state.selectedTxt === i)        state.selectedTxt = i - 1;
      else if (state.selectedTxt === i-1) state.selectedTxt = i;
      renderTxtList();
    });

    // 下移：跟後一個交換
    row.querySelector('[data-act="down"]').addEventListener('click', e => {
      e.stopPropagation();
      if (i === state.txts.length - 1) return;
      [state.txts[i+1], state.txts[i]] = [state.txts[i], state.txts[i+1]];
      if (state.selectedTxt === i)        state.selectedTxt = i + 1;
      else if (state.selectedTxt === i+1) state.selectedTxt = i;
      renderTxtList();
    });

    row.querySelector('.del').addEventListener('click', e => {
      e.stopPropagation();
      if (state.txts.length === 1) {
        state.txts[0] = newTxt();
      } else {
        state.txts.splice(i, 1);
        if (state.selectedTxt >= state.txts.length) state.selectedTxt = state.txts.length - 1;
      }
      syncEditorFromCurrent();
      renderTxtList();
    });
    list.appendChild(row);
  });
}

$('#addTxt').addEventListener('click', () => {
  // 新段繼承當前語言設定，文字內容空白
  const cur = curTxt();
  const newOne = newTxt({ lang: cur.lang });
  state.txts.push(newOne);
  state.selectedTxt = state.txts.length - 1;
  syncEditorFromCurrent();
  renderTxtList();
  $('#txtText').focus();
});

/** 把目前選中段落的所有設定同步到右側編輯器 UI */
function syncEditorFromCurrent() {
  const tx = curTxt();
  $('#txtText').value = tx.text;
  $('#txtSize').value = tx.size; $('#vTxtSize').textContent = tx.size;
  $('#txtOpacity').value = tx.opacity; $('#vTxtOpacity').textContent = tx.opacity + '%';
  $('#txtLineH').value = tx.lineH * 100; $('#vTxtLineH').textContent = tx.lineH.toFixed(1);
  $('#txtLetterSp').value = tx.letterSpacing; $('#vTxtLetterSp').textContent = tx.letterSpacing;
  $('#txtStroke').value = tx.strokeWidth * 100; $('#vTxtStroke').textContent = (tx.strokeWidth * 100 | 0) + '%';
  $('#txtRotate').value = tx.rotate; $('#vTxtRotate').textContent = tx.rotate + '°';
  $('#txtX').value = tx.x * 100; $('#vTxtX').textContent = (tx.x * 100 | 0) + '%';
  $('#txtY').value = tx.y * 100; $('#vTxtY').textContent = (tx.y * 100 | 0) + '%';
  $('#txtColor').value = tx.color;
  $('#txtBgColor').value = tx.bgColor;
  $('#txtBgOpacity').value = tx.bgOpacity; $('#vTxtBgOpacity').textContent = tx.bgOpacity + '%';
  $('#txtBgPad').value = tx.bgPad; $('#vTxtBgPad').textContent = tx.bgPad;
  $('#txtGlow').value = tx.glowSize; $('#vTxtGlow').textContent = tx.glowSize;
  $('#txtBorderW').value = tx.borderW; $('#vTxtBorderW').textContent = tx.borderW + 'px';

  // 更新所有按鈕狀態
  $$('.lang-btn').forEach(b => b.classList.toggle('on', b.dataset.lang === tx.lang));
  if (tx.lang === 'en') { $('#fontsEn').classList.remove('hidden'); $('#fontsJp').classList.add('hidden'); }
  else { $('#fontsEn').classList.add('hidden'); $('#fontsJp').classList.remove('hidden'); }
  $$('#fontsEn button, #fontsJp button').forEach(b => b.classList.toggle('on', b.dataset.font === tx.font));
  $$('.align-btn').forEach(b => b.classList.toggle('on', b.dataset.align === tx.align));
  $$('.valign-btn').forEach(b => b.classList.toggle('on', b.dataset.valign === (tx.valign || 'middle')));
  $$('.effect-btn').forEach(b => b.classList.toggle('on', b.dataset.effect === tx.effect));
  $$('.sw').forEach(b => b.classList.toggle('on', b.dataset.color === tx.color));

  // Style buttons
  ['bold', 'italic', 'underline', 'shadow'].forEach(s => {
    const btn = $(`.style-btn[data-style="${s}"]`);
    if (btn) {
      btn.style.borderColor = tx[s] ? 'var(--a2)' : 'var(--b)';
      btn.style.color = tx[s] ? 'var(--a2)' : 'var(--m)';
    }
  });

  // Toggles
  ['bgEnable', 'glow', 'border', 'vertical'].forEach(k => {
    const tg = { bgEnable: '#bgEnableToggle', glow: '#glowToggle', border: '#borderToggle', vertical: '#verticalToggle' }[k];
    const el = $(tg);
    if (el) el.classList.toggle('on', tx[k]);
  });

  // 依垂直書寫狀態切換對齊按鈕組
  if (typeof updateAlignVisibility === 'function') updateAlignVisibility();
}

renderTxtList();

// 特效切換
$$('[data-fx]').forEach(b => b.addEventListener('click', () => {
  $$('[data-fx]').forEach(x => x.classList.remove('on'));
  b.classList.add('on');
  state.fx = b.dataset.fx;
  $('#metaFx').textContent = state.fx === 'err' ? '404' : state.fx.toUpperCase();
}));

// 強度滑桿
['NO','CO','DK','HU','SP'].forEach(k => {
  $(`#s${k}`).addEventListener('input', e => {
    state[k] = +e.target.value;
    $(`#v${k}`).textContent = e.target.value;
  });
});

// 色調
$('#sHUE').addEventListener('input', e => { state.HUE = +e.target.value; $('#vHUE').textContent = e.target.value + '°'; });
$('#sSAT').addEventListener('input', e => { state.SAT = +e.target.value; $('#vSAT').textContent = e.target.value + '%'; });

// 焦點
$$('[data-focus]').forEach(b => b.addEventListener('click', () => {
  $$('[data-focus]').forEach(x => x.classList.remove('on'));
  b.classList.add('on');
  state.focusMode = b.dataset.focus;
}));

// 文字
$('#txtText').addEventListener('input', e => {
  curTxt().text = e.target.value;
  renderTxtList();
});
$('#txtSize').addEventListener('input', e => { curTxt().size = +e.target.value; $('#vTxtSize').textContent = e.target.value; });
$('#txtOpacity').addEventListener('input', e => { curTxt().opacity = +e.target.value; $('#vTxtOpacity').textContent = e.target.value + '%'; });
$('#txtLineH').addEventListener('input', e => { curTxt().lineH = +e.target.value / 100; $('#vTxtLineH').textContent = curTxt().lineH.toFixed(1); });
$('#txtLetterSp').addEventListener('input', e => { curTxt().letterSpacing = +e.target.value; $('#vTxtLetterSp').textContent = e.target.value; });
$('#txtStroke').addEventListener('input', e => { curTxt().strokeWidth = +e.target.value / 100; $('#vTxtStroke').textContent = e.target.value + '%'; });
$('#txtRotate').addEventListener('input', e => { curTxt().rotate = +e.target.value; $('#vTxtRotate').textContent = e.target.value + '°'; });
$('#txtX').addEventListener('input', e => { curTxt().x = +e.target.value / 100; $('#vTxtX').textContent = e.target.value + '%'; });
$('#txtY').addEventListener('input', e => { curTxt().y = +e.target.value / 100; $('#vTxtY').textContent = e.target.value + '%'; });
$('#txtColor').addEventListener('input', e => {
  curTxt().color = e.target.value;
  $$('.sw').forEach(x => x.classList.remove('on'));
});

// 進階：背景 / glow / 外框 / 垂直
$('#txtBgColor').addEventListener('input', e => curTxt().bgColor = e.target.value);
$('#txtBgOpacity').addEventListener('input', e => { curTxt().bgOpacity = +e.target.value; $('#vTxtBgOpacity').textContent = e.target.value + '%'; });
$('#txtBgPad').addEventListener('input', e => { curTxt().bgPad = +e.target.value; $('#vTxtBgPad').textContent = e.target.value; });
$('#txtGlow').addEventListener('input', e => { curTxt().glowSize = +e.target.value; $('#vTxtGlow').textContent = e.target.value; });
$('#txtBorderW').addEventListener('input', e => { curTxt().borderW = +e.target.value; $('#vTxtBorderW').textContent = e.target.value + 'px'; });

// Toggles 切換
[['bgEnableToggle', 'bgEnable'], ['glowToggle', 'glow'], ['borderToggle', 'border'], ['verticalToggle', 'vertical']].forEach(([id, key]) => {
  const el = $('#' + id);
  if (el) el.addEventListener('click', () => {
    curTxt()[key] = !curTxt()[key];
    el.classList.toggle('on', curTxt()[key]);
    if (key === 'vertical') updateAlignVisibility();
  });
});

// 字體語言切換
$$('.lang-btn').forEach(b => b.addEventListener('click', () => {
  $$('.lang-btn').forEach(x => x.classList.remove('on'));
  b.classList.add('on');
  curTxt().lang = b.dataset.lang;
  if (b.dataset.lang === 'en') {
    $('#fontsEn').classList.remove('hidden');
    $('#fontsJp').classList.add('hidden');
  } else {
    $('#fontsEn').classList.add('hidden');
    $('#fontsJp').classList.remove('hidden');
  }
}));

// 字體選擇
$$('#fontsEn button, #fontsJp button').forEach(b => b.addEventListener('click', () => {
  b.parentElement.querySelectorAll('button').forEach(x => x.classList.remove('on'));
  b.classList.add('on');
  curTxt().font = b.dataset.font;
}));

// 字體樣式
$$('.style-btn').forEach(b => b.addEventListener('click', () => {
  const k = b.dataset.style;
  curTxt()[k] = !curTxt()[k];
  b.style.borderColor = curTxt()[k] ? 'var(--a2)' : 'var(--b)';
  b.style.color = curTxt()[k] ? 'var(--a2)' : 'var(--m)';
}));

// 對齊
$$('.align-btn').forEach(b => b.addEventListener('click', () => {
  $$('.align-btn').forEach(x => x.classList.remove('on'));
  b.classList.add('on');
  curTxt().align = b.dataset.align;
}));

// 垂直書寫對齊（置頂/中/底）
$$('.valign-btn').forEach(b => b.addEventListener('click', () => {
  $$('.valign-btn').forEach(x => x.classList.remove('on'));
  b.classList.add('on');
  curTxt().valign = b.dataset.valign;
}));

/** 依目前是否垂直書寫切換對齊按鈕組 */
function updateAlignVisibility() {
  const isV = curTxt().vertical;
  $('#alignH').style.display = isV ? 'none' : 'grid';
  $('#alignV').style.display = isV ? 'grid' : 'none';
}

// 顏色色票
$$('.sw').forEach(b => b.addEventListener('click', () => {
  $$('.sw').forEach(x => x.classList.remove('on'));
  b.classList.add('on');
  curTxt().color = b.dataset.color;
  $('#txtColor').value = b.dataset.color;
}));

// 動態效果
$$('.effect-btn').forEach(b => b.addEventListener('click', () => {
  $$('.effect-btn').forEach(x => x.classList.remove('on'));
  b.classList.add('on');
  curTxt().effect = b.dataset.effect;
}));

// 解析度
$$('.res-btn').forEach(b => b.addEventListener('click', () => {
  $$('.res-btn').forEach(x => x.classList.remove('on'));
  b.classList.add('on');
  state.resMode = b.dataset.res;
  $('#customWidthRow').style.display = b.dataset.res === 'custom' ? 'flex' : 'none';
  updateResInfo();
}));

$('#customWidth').addEventListener('input', e => {
  state.customWidth = +e.target.value;
  $('#vCustomWidth').textContent = e.target.value;
  updateResInfo();
});

// 長度
$$('.dur-btn').forEach(b => b.addEventListener('click', () => {
  $$('.dur-btn').forEach(x => x.classList.remove('on'));
  b.classList.add('on');
  state.duration = +b.dataset.d;
  $('#frameInfo').textContent = `預計 ${state.duration * FPS} 幀 @ ${FPS}fps`;
}));

// 影片畫質
const QUALITY_INFO = {
  low:      { mul: 0.6,  gifQ: 8, label: '低：檔案小、畫質粗糙' },
  standard: { mul: 1.5,  gifQ: 5, label: '標準：1080p ≈ 4–8 Mbps（適合社群上傳）' },
  high:     { mul: 3.0,  gifQ: 3, label: '高：1080p ≈ 16 Mbps（清晰銳利）' },
  ultra:    { mul: 6.0,  gifQ: 1, label: '極致：1080p ≈ 32 Mbps（檔案大、近似無損）' }
};

$$('.qual-btn').forEach(b => b.addEventListener('click', () => {
  $$('.qual-btn').forEach(x => x.classList.remove('on'));
  b.classList.add('on');
  state.quality = b.dataset.qual;
  $('#qualInfo').textContent = QUALITY_INFO[state.quality].label;
}));

/** 依品質計算 MP4 bitrate（每像素 bit 數）*/
function getBitrate(w, h) {
  const baseRate = 0.4;  // 每像素 bit 數的基準
  const mul = QUALITY_INFO[state.quality].mul;
  const target = w * h * baseRate * mul;
  return Math.max(2e6, Math.min(80e6, target));
}

// 暫停
$('#btnPause').addEventListener('click', () => {
  state.paused = !state.paused;
  $('#btnPause').textContent = state.paused ? '▶ 繼續' : '⏸ 暫停';
  if (state.video) {
    if (state.paused) state.video.pause();
    else state.video.play().catch(() => {});
  }
  if (state.paused) cancelAnimationFrame(state.raf);
  else play();
});

// ═══════════════════════════════════════════
// C4 渲染引擎
// ═══════════════════════════════════════════
function play() {
  cancelAnimationFrame(state.raf);
  let last = 0, t = 0;
  const interval = 1000 / (FPS + state.SP * 0.8);
  const loop = ts => {
    const src = state.isVideo ? state.video : state.img;
    if (state.paused || !src) return;
    // 影片時：每幀都跑（因為 video 持續更新）
    if (state.isVideo) {
      drawFrame(ctx, cv.width, cv.height, t++);
    } else if (ts - last > interval) {
      drawFrame(ctx, cv.width, cv.height, t++);
      last = ts;
    }
    state.raf = requestAnimationFrame(loop);
  };
  state.raf = requestAnimationFrame(loop);
}

function drawFrame(c, w, h, t) {
  const src = state.isVideo ? state.video : state.img;
  if (!src) return;
  c.imageSmoothingEnabled = true;
  c.imageSmoothingQuality = 'high';
  c.clearRect(0, 0, w, h);
  c.drawImage(src, 0, 0, w, h);
  c.imageSmoothingEnabled = false;

  if (state.HUE !== 0 || state.SAT !== 100) applyHueSat(c, w, h);
  FX[state.fx](c, w, h, t);
  state.txts.forEach(tx => {
    if (tx.text) drawText(c, w, h, t, tx);
  });
}

function redrawNow() {
  const src = state.isVideo ? state.video : state.img;
  if (src) drawFrame(ctx, cv.width, cv.height, (performance.now() / 60) | 0);
}

// ═══════════════════════════════════════════
// C5 工具函式
// ═══════════════════════════════════════════
const cl = v => Math.max(0, Math.min(255, v | 0));
const cp = (v, a, b) => Math.max(a, Math.min(b, v));
const SK = w => Math.max(1, w / 680);

function pixelMap(c, w, h, fn) {
  const id = c.getImageData(0, 0, w, h);
  const d = id.data;
  for (let i = 0; i < d.length; i += 4) fn(d, i);
  c.putImageData(id, 0, 0);
}

function scanLines(c, w, h, step, alpha) {
  if (alpha <= 0) return;
  const sk = SK(w);
  const real = Math.max(2, Math.round(step * sk));
  c.fillStyle = `rgba(0,0,0,${alpha})`;
  for (let y = 0; y < h; y += real) c.fillRect(0, y, w, Math.max(1, sk * 0.5));
}

function displaceLines(c, w, h, count, range, maxH, prob, tint) {
  for (let k = 0; k < count; k++) {
    if (Math.random() >= prob) continue;
    const y = 0 | Math.random() * h;
    const lh = 1 + (0 | Math.random() * maxH);
    const li = c.getImageData(0, y, w, lh);
    c.putImageData(li, 0 | (Math.random() - .5) * range, y);
    if (tint) {
      c.fillStyle = tint;
      c.fillRect(0, y, w, lh);
    }
  }
}

function vignette(c, w, h, intensity, innerR, outerR) {
  if (intensity <= 0) return;
  const vg = c.createRadialGradient(w/2, h/2, h*innerR, w/2, h/2, h*outerR);
  vg.addColorStop(0, 'transparent');
  vg.addColorStop(1, `rgba(0,0,0,${Math.min(.5, .3 * intensity)})`);
  c.fillStyle = vg;
  c.fillRect(0, 0, w, h);
}

function rgbSplit(c, w, h, r) {
  if (r < 1) return;
  const im = c.getImageData(0, 0, w, h);
  const ou = new ImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y*w + x) * 4;
      ou.data[i]   = im.data[(y*w + cp(x+r, 0, w-1)) * 4];
      ou.data[i+1] = im.data[i+1];
      ou.data[i+2] = im.data[(y*w + cp(x-r, 0, w-1)) * 4 + 2];
      ou.data[i+3] = 255;
    }
  }
  c.putImageData(ou, 0, 0);
}

function applyHueSat(c, w, h) {
  const id = c.getImageData(0, 0, w, h);
  const d = id.data;
  const hShift = state.HUE / 360;
  const sMul = state.SAT / 100;
  for (let i = 0; i < d.length; i += 4) {
    let r = d[i]/255, g = d[i+1]/255, b = d[i+2]/255;
    const mx = Math.max(r,g,b), mn = Math.min(r,g,b);
    const l = (mx + mn) / 2;
    let h2 = 0, sa = 0;
    if (mx !== mn) {
      const de = mx - mn;
      sa = l > .5 ? de/(2-mx-mn) : de/(mx+mn);
      if      (mx === r) h2 = ((g-b)/de + (g<b ? 6 : 0)) / 6;
      else if (mx === g) h2 = ((b-r)/de + 2) / 6;
      else               h2 = ((r-g)/de + 4) / 6;
    }
    h2 = (h2 + hShift + 1) % 1;
    sa = Math.min(1, sa * sMul);
    const h2r = (p, q, tt) => {
      if (tt < 0) tt += 1; if (tt > 1) tt -= 1;
      return tt < 1/6 ? p+(q-p)*6*tt : tt < .5 ? q : tt < 2/3 ? p+(q-p)*(2/3-tt)*6 : p;
    };
    if (!sa) {
      d[i] = d[i+1] = d[i+2] = cl(l * 255);
    } else {
      const q = l < .5 ? l*(1+sa) : l+sa-l*sa;
      const p = 2*l - q;
      d[i]   = cl(h2r(p, q, h2 + 1/3) * 255);
      d[i+1] = cl(h2r(p, q, h2)       * 255);
      d[i+2] = cl(h2r(p, q, h2 - 1/3) * 255);
    }
  }
  c.putImageData(id, 0, 0);
}

function getZones() {
  const m = state.focusMode;
  const z = { tl: true, tr: true, bl: true, br: true };
  if (m === 'tl') z.tl = false;
  else if (m === 'tr') z.tr = false;
  else if (m === 'bl') z.bl = false;
  else if (m === 'br') z.br = false;
  return z;
}

function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : null;
}

// ═══════════════════════════════════════════
// C6 特效實作
// ═══════════════════════════════════════════
const FX = {
  film(c, w, h, t) {
    const sk = SK(w);
    const nS = state.NO/5, dkSc = state.DK/5, coSc = state.CO/5;

    if (nS > 0) {
      pixelMap(c, w, h, (d, i) => {
        const g = (Math.random() - .5) * 42 * nS;
        d[i] = cl(d[i] + g); d[i+1] = cl(d[i+1] + g); d[i+2] = cl(d[i+2] + g);
      });
    }
    if (coSc > 0) {
      c.fillStyle = `rgba(245,180,60,${.06 * coSc})`;
      c.fillRect(0, 0, w, h);
    }
    vignette(c, w, h, dkSc, 0.3, 0.9);
    if (nS > 0) {
      for (let k = 0; k < (0 | 2 * nS); k++) {
        if (Math.random() < .45) {
          c.strokeStyle = `rgba(255,255,220,${.3 + Math.random() * .5})`;
          c.lineWidth = (Math.random() < .5 ? .5 : 1) * sk;
          const x = Math.random() * w;
          c.beginPath();
          c.moveTo(x, 0);
          c.lineTo(x + (Math.random() - .5) * 8, h);
          c.stroke();
        }
      }
    }
    if (coSc > 0) rgbSplit(c, w, h, Math.round(2 * coSc));
    // 黑邊
    const bH = Math.round(h * .09);
    c.fillStyle = '#000';
    c.fillRect(0, 0, w, bH);
    c.fillRect(0, h - bH, w, bH);
  },

  cyber(c, w, h, t) {
    const sk = SK(w);
    const nS = state.NO/5, coSc = state.CO/5, dkSc = state.DK/5, huSc = state.HU/5;
    const zone = getZones();

    if (coSc > 0) rgbSplit(c, w, h, Math.round(5 * coSc));

    if (nS > 0) {
      for (let i = 0; i < (0 | 5 * nS); i++) {
        if (Math.random() < .75) {
          const y = 0 | Math.random() * h;
          const lh = 1 + (0 | Math.random() * 8);
          const id = c.getImageData(0, y, w, lh);
          c.putImageData(id, 0 | (Math.random() - .5) * 35 * nS, y);
          c.fillStyle = Math.random() < .5 ? `rgba(0,229,255,.2)` : `rgba(255,20,147,.2)`;
          c.fillRect(0, y, w, lh);
        }
      }
    }
    scanLines(c, w, h, 3, .14 * dkSc);

    if (huSc > 0) {
      c.strokeStyle = `rgba(0,229,255,${.7 * huSc})`;
      c.lineWidth = (1 + huSc) * sk;
      const bs = (16 + huSc * 12) * sk;
      const pad = 10 * sk;
      const corners = [];
      if (zone.tl) corners.push([pad, pad, 'tl']);
      if (zone.tr) corners.push([w-pad-bs, pad, 'tr']);
      if (zone.bl) corners.push([pad, h-pad-bs, 'bl']);
      if (zone.br) corners.push([w-pad-bs, h-pad-bs, 'br']);
      corners.forEach(([x, y, p]) => {
        c.beginPath();
        if (p === 'tl')      { c.moveTo(x, y+bs);  c.lineTo(x, y);    c.lineTo(x+bs, y); }
        else if (p === 'tr') { c.moveTo(x, y);     c.lineTo(x+bs, y); c.lineTo(x+bs, y+bs); }
        else if (p === 'bl') { c.moveTo(x, y);     c.lineTo(x, y+bs); c.lineTo(x+bs, y+bs); }
        else                 { c.moveTo(x+bs, y);  c.lineTo(x+bs, y+bs); c.lineTo(x, y+bs); }
        c.stroke();
      });

      c.font = `bold ${(9 + huSc * 4) * sk}px 'Share Tech Mono', monospace`;
      c.fillStyle = `rgba(0,229,255,.85)`;
      if (zone.tl) { c.textAlign = 'left'; c.fillText(`[NEO-TOKYO // ${(0|Math.random()*99).toString().padStart(2,'0')}.77]`, 18*sk, 26*sk); }
      if (zone.tr) { c.textAlign = 'right'; c.fillText(`SYS::${(0|Math.random()*9999).toString().padStart(4,'0')}`, w-18*sk, 26*sk); }
      c.textAlign = 'left';
    }
  },

  retro(c, w, h, t) {
    const sk = SK(w);
    const nS = state.NO/5, coSc = state.CO/5, huSc = state.HU/5;

    if (coSc > 0) {
      pixelMap(c, w, h, (d, i) => {
        d[i]   = cl(d[i]   * 1.1);
        d[i+1] = cl(d[i+1] * .95);
        d[i+2] = cl(d[i+2] * .8);
      });
    }
    if (nS > 0) {
      displaceLines(c, w, h, 0 | 7 * nS, 25 * nS, 4, 1);
      for (let i = 0; i < (0 | 2 * nS); i++) {
        const y = 0 | Math.random() * h;
        c.fillStyle = `rgba(255,255,255,${.2 + Math.random() * .3})`;
        c.fillRect(0, y, w, 2 + (0 | Math.random() * 6));
      }
    }
    scanLines(c, w, h, 2, .15);
    if (coSc > 0) rgbSplit(c, w, h, Math.round(6 * coSc));
    if (coSc > 0) {
      c.fillStyle = `rgba(255,100,0,${.08 * coSc})`;
      c.fillRect(0, 0, w, h);
    }
    if (huSc > 0) {
      const zone = getZones();
      c.fillStyle = `rgba(255,200,50,.85)`;
      c.font = `bold ${(11 + huSc * 4) * sk}px VT323, monospace`;
      const n = new Date();
      if (zone.tl) { c.textAlign = 'left'; c.fillText(`▶ PLAY  SP  ${n.getFullYear()}`, 8*sk, 20*sk); }
      if (zone.tr) { c.textAlign = 'right'; c.fillText(`${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}`, w-8*sk, 20*sk); }
      c.textAlign = 'left';
    }
  },

  err(c, w, h, t) {
    const sk = SK(w);
    const nS = state.NO/5, coSc = state.CO/5, huSc = state.HU/5, dkSc = state.DK/5;

    if (coSc > 0) rgbSplit(c, w, h, Math.round(3 * coSc));
    if (huSc > 0) {
      c.strokeStyle = `rgba(255,20,50,${.9 + Math.sin(t * .5) * .1})`;
      c.lineWidth = Math.max(3, 0 | 10 * huSc);
      c.strokeRect(0, 0, w, h);
    }
    if (nS > 0) {
      displaceLines(c, w, h, 0 | 2 * nS, 30 * nS, 10, .6, `rgba(255,0,0,${.25 + Math.random() * .3})`);
    }
    // 404 浮水印
    const wmSize = h * .35;
    c.save();
    c.globalAlpha = .15 + .08 * Math.abs(Math.sin(t * .3));
    c.font = `bold ${0 | wmSize}px 'Bebas Neue', monospace`;
    c.fillStyle = '#ff2244';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('404', w/2, h/2);
    c.restore();
    // 警示橫幅
    if (huSc > 0) {
      const bh = (28 + huSc * 4) * sk;
      c.fillStyle = (t % 6 < 3) ? 'rgba(255,20,50,.92)' : 'rgba(255,255,255,.92)';
      c.fillRect(0, 0, w, bh);
      c.fillStyle = (t % 6 < 3) ? '#fff' : '#ff2244';
      c.font = `bold ${(10 + huSc * 4) * sk}px monospace`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('⚠ SYSTEM ERROR — 404 NOT FOUND ⚠', w/2, bh/2);
      c.textBaseline = 'alphabetic';
    }
    scanLines(c, w, h, 3, .06 * dkSc);
  },

  cctv(c, w, h, t) {
    const sk = SK(w);
    const nS = state.NO/5, coSc = state.CO/5, dkSc = state.DK/5, huSc = state.HU/5;
    const zone = getZones();

    if (coSc > 0) {
      const m = .6 * coSc;
      pixelMap(c, w, h, (d, i) => {
        const a = (d[i] + d[i+1] + d[i+2]) / 3;
        d[i]   = cl(d[i]   * (1-m) + a * m * .75);
        d[i+1] = cl(d[i+1] * (1-m) + a * m * 1.2);
        d[i+2] = cl(d[i+2] * (1-m) + a * m * .7);
      });
    }
    scanLines(c, w, h, 2, .18 * dkSc);
    if (nS > 0) {
      pixelMap(c, w, h, (d, i) => {
        if (Math.random() >= .3 * nS) return;
        const n = (Math.random() - .5) * 80 * nS;
        d[i] = cl(d[i] + n); d[i+1] = cl(d[i+1] + n); d[i+2] = cl(d[i+2] + n);
      });
    }
    if (huSc > 0) {
      const n = new Date();
      const ts = `${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}:${String((n.getSeconds()+t)%60).padStart(2,'0')}`;
      c.fillStyle = 'rgba(150,255,150,.9)';
      c.font = `bold ${(11 + huSc * 4) * sk}px VT323, monospace`;
      if (zone.tl) {
        c.textAlign = 'left';
        c.fillText('CAM-01', 10*sk, 18*sk);
        c.fillText(`${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')} ${ts}`, 10*sk, 38*sk);
      }
      if (zone.tr) {
        if (t % 8 < 4) {
          c.fillStyle = 'rgba(255,50,50,.95)';
          c.beginPath(); c.arc(w-48*sk, 14*sk, 5*sk, 0, Math.PI*2); c.fill();
        }
        c.fillStyle = 'rgba(255,50,50,.95)';
        c.font = `bold ${(10 + huSc * 4) * sk}px monospace`;
        c.textAlign = 'right';
        c.fillText('● REC', w-10*sk, 18*sk);
      }
      c.textAlign = 'left';

      // 底部資訊列
      if (zone.bl || zone.br) {
        const sbH = (16 + huSc * 8) * sk;
        c.fillStyle = 'rgba(0,20,0,.75)';
        c.fillRect(0, h-sbH, w, sbH);
        c.fillStyle = 'rgba(150,255,150,.85)';
        c.font = `${(9 + huSc * 4) * sk}px VT323, monospace`;
        c.fillText(`LOC: SECTOR 04-A | CH:01/16`, 10*sk, h - sbH/2 + 4*sk);
      }
    }
    vignette(c, w, h, dkSc, 0.3, 0.85);
  },

  hack(c, w, h, t) {
    const sk = SK(w);
    const nS = state.NO/5, coSc = state.CO/5, dkSc = state.DK/5, huSc = state.HU/5;
    const zone = getZones();

    if (dkSc > 0) {
      c.fillStyle = `rgba(0,10,0,${Math.min(.5, .3 + .04 * dkSc)})`;
      c.fillRect(0, 0, w, h);
    }
    if (coSc > 0) {
      c.fillStyle = `rgba(0,80,30,${.08 * coSc})`;
      c.fillRect(0, 0, w, h);
    }
    if (huSc > 0) {
      c.font = `bold ${(11 + huSc * 4) * sk}px monospace`;
      const ch = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&アカサタナハマヤラワ';
      const spots = [];
      if (zone.tl) spots.push([0, w*.3, 0, h*.4]);
      if (zone.tr) spots.push([w*.7, w, 0, h*.4]);
      if (zone.bl) spots.push([0, w*.3, h*.6, h]);
      if (zone.br) spots.push([w*.7, w, h*.6, h]);
      if (spots.length === 0) spots.push([0, w, 0, h]);

      const cnt = (0 | 80 * huSc) * Math.max(1, sk * sk * 0.5);
      for (let i = 0; i < cnt; i++) {
        const sp = spots[0 | Math.random() * spots.length];
        const x = sp[0] + Math.random() * (sp[1] - sp[0]);
        const y = sp[2] + Math.random() * (sp[3] - sp[2]);
        c.fillStyle = `rgba(0,255,65,${.15 + Math.random() * .7})`;
        c.fillText(ch[0 | Math.random() * ch.length], x, y);
      }
    }
    if (huSc > 0 && (zone.tl || zone.tr)) {
      const sbH = (16 + huSc * 8) * sk;
      c.fillStyle = 'rgba(0,20,0,.88)';
      c.fillRect(0, 0, w, sbH);
      c.fillStyle = 'rgba(0,255,65,.95)';
      c.font = `bold ${(9 + huSc * 3) * sk}px monospace`;
      if (zone.tl) { c.textAlign = 'left'; c.fillText('[ROOT@TARGET:~$ EXPLOIT_RUNNING]', 10*sk, sbH/2 + 4*sk); }
      if (zone.tr) { c.textAlign = 'right'; c.fillText(`PID:${String(0 | Math.random() * 9999).padStart(4,'0')}`, w-10*sk, sbH/2 + 4*sk); }
      c.textAlign = 'left';
    }
  }
};

// ═══════════════════════════════════════════
// C7 文字繪製 — 支援多段 + 進階特效 + 垂直書寫
// ═══════════════════════════════════════════
function drawText(c, w, h, t, tx) {
  let raw = tx.text;
  if (!raw) return;

  // 打字機效果
  if (tx.effect === 'type') {
    const totalFrames = state.duration * FPS;
    const progress = (t % totalFrames) / totalFrames;
    const chars = Math.ceil(raw.length * Math.min(1, progress * 1.3));
    raw = raw.slice(0, chars);
    if (t % 4 < 2 && chars < tx.text.length + 1) raw += '_';
  }

  const f = FONTS[tx.font] || FONTS.orbitron;
  c.save();

  // 旋轉
  if (tx.rotate) {
    const cx0 = tx.x * w, cy0 = tx.y * h;
    c.translate(cx0, cy0);
    c.rotate(tx.rotate * Math.PI / 180);
    c.translate(-cx0, -cy0);
  }

  // 字型
  const styles = [];
  if (tx.italic) styles.push('italic');
  styles.push(tx.bold ? 'bold' : f.weight);
  c.font = `${styles.join(' ')} ${tx.size}px ${f.css}`;
  c.textBaseline = 'middle';
  if ('letterSpacing' in c) c.letterSpacing = `${tx.letterSpacing}px`;

  // 透明度
  let alpha = tx.opacity / 100;
  if (tx.effect === 'flicker') {
    if (Math.random() < 0.12) alpha *= 0.25;
    else if (Math.random() < 0.08) alpha *= 0.6;
  }
  c.globalAlpha = alpha;

  // 描邊參數
  const rgb = hexToRgb(tx.color);
  const isLight = rgb && (rgb.r + rgb.g + rgb.b) > 380;
  const strokeColor = isLight ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.7)';
  const strokeW = Math.max(0, tx.size * tx.strokeWidth);

  // Glow / Shadow
  if (tx.glow) {
    c.shadowColor = tx.color;
    c.shadowBlur = tx.glowSize;
    c.shadowOffsetX = 0;
    c.shadowOffsetY = 0;
  } else if (tx.shadow) {
    c.shadowColor = 'rgba(0,0,0,0.7)';
    c.shadowBlur = tx.size * 0.15;
    c.shadowOffsetX = tx.size * 0.06;
    c.shadowOffsetY = tx.size * 0.06;
  }

  const cx = tx.x * w;
  const cy = tx.y * h;

  if (tx.vertical) {
    // ═══════ 垂直書寫模式（多欄直書，由右至左）═══════
    const cols = raw.split('\n');                // 每段原始行 → 一欄
    const colCount = cols.length;
    const colSpacing = tx.size * tx.lineH;      // 欄間距 = 字大小 × 行距倍率

    // 每欄寬度（最寬字元 + 字距），高度（字數 × 字高）
    const charSpacing = tx.size * 1.0;          // 每字垂直間距
    const colHeights = cols.map(col => Array.from(col).length * charSpacing);
    const maxColH = Math.max(...colHeights, 1);

    // 段落框
    const totalW = colSpacing * (colCount - 1);
    const paraLeft = cx - totalW / 2 - tx.size / 2;
    const paraRight = cx + totalW / 2 + tx.size / 2;
    const paraTop = cy - maxColH / 2 - tx.size * 0.3;
    const paraBottom = cy + maxColH / 2 + tx.size * 0.3;

    // 背景色塊
    if (tx.bgEnable) {
      const pad = tx.bgPad;
      const bgRgb = hexToRgb(tx.bgColor) || { r: 0, g: 0, b: 0 };
      c.fillStyle = `rgba(${bgRgb.r},${bgRgb.g},${bgRgb.b},${tx.bgOpacity / 100})`;
      c.fillRect(paraLeft - pad, paraTop - pad,
                 (paraRight - paraLeft) + pad * 2, (paraBottom - paraTop) + pad * 2);
    }
    // 外框
    if (tx.border) {
      c.strokeStyle = tx.color;
      c.lineWidth = tx.borderW;
      const pad = tx.bgPad || 8;
      c.strokeRect(paraLeft - pad, paraTop - pad,
                   (paraRight - paraLeft) + pad * 2, (paraBottom - paraTop) + pad * 2);
    }

    c.textAlign = 'center';

    // 直書傳統：第一行（ci=0）永遠在最右邊，由右至左排列
    // align 影響整體段落在畫布的位置（左/中/右）
    cols.forEach((col, ci) => {
      const chars = Array.from(col);
      // ci=0 在右、ci=N-1 在左（中文/日文直書習慣）
      // 所以該欄的 X = paraRight - tx.size/2 - ci * colSpacing
      const colX = paraRight - tx.size / 2 - ci * colSpacing;

      const colH = chars.length * charSpacing;
      // 依 valign 決定該欄起始 Y（top/middle/bottom）
      const valign = tx.valign || 'middle';
      let startY;
      if (valign === 'top')         startY = paraTop + charSpacing / 2;
      else if (valign === 'bottom') startY = paraBottom - colH + charSpacing / 2;
      else                          startY = cy - colH / 2 + charSpacing / 2;

      chars.forEach((ch, ki) => {
        const y = startY + ki * charSpacing;
        if (strokeW > 0) {
          c.strokeStyle = strokeColor;
          c.lineWidth = strokeW;
          c.lineJoin = 'round';
          c.strokeText(ch, colX, y);
        }
        if (tx.effect === 'rgb') {
          const off = Math.max(2, tx.size * 0.04);
          const wobble = Math.sin(t * 0.3 + ki * 0.5) * off;
          const orig = c.shadowColor;
          c.shadowColor = 'transparent';
          c.globalCompositeOperation = 'screen';
          c.fillStyle = '#ff0040';
          c.fillText(ch, colX + wobble, y);
          c.fillStyle = '#00ffee';
          c.fillText(ch, colX - wobble, y);
          c.globalCompositeOperation = 'source-over';
          c.shadowColor = orig;
        }
        c.fillStyle = tx.color;
        c.fillText(ch, colX, y);
      });
    });

    c.restore();
    return;
  }

  // ═══════ 一般水平書寫 ═══════
  const lines = raw.split('\n');
  const lineWs = lines.map(l => c.measureText(l).width);
  const maxW = Math.max(...lineWs, 1);
  const lineH = tx.size * tx.lineH;
  const totalH = lineH * (lines.length - 1);

  const paraLeft = cx - maxW / 2;
  const paraRight = cx + maxW / 2;
  const paraTop = cy - totalH / 2 - tx.size * 0.5;
  const paraBottom = cy + totalH / 2 + tx.size * 0.5;

  // 背景色塊
  if (tx.bgEnable) {
    const pad = tx.bgPad;
    const bgRgb = hexToRgb(tx.bgColor) || { r: 0, g: 0, b: 0 };
    c.fillStyle = `rgba(${bgRgb.r},${bgRgb.g},${bgRgb.b},${tx.bgOpacity / 100})`;
    c.fillRect(paraLeft - pad, paraTop - pad,
               (paraRight - paraLeft) + pad * 2, (paraBottom - paraTop) + pad * 2);
  }
  // 外框
  if (tx.border) {
    c.strokeStyle = tx.color;
    c.lineWidth = tx.borderW;
    const pad = tx.bgPad || 8;
    c.strokeRect(paraLeft - pad, paraTop - pad,
                 (paraRight - paraLeft) + pad * 2, (paraBottom - paraTop) + pad * 2);
  }

  c.textAlign = 'left';
  lines.forEach((line, i) => {
    if (!line) return;
    const lineY = cy - totalH / 2 + i * lineH;
    const lineW = lineWs[i];

    let lineX;
    if (tx.align === 'left')       lineX = paraLeft;
    else if (tx.align === 'right') lineX = paraRight - lineW;
    else                            lineX = cx - lineW / 2;

    if (strokeW > 0) {
      c.strokeStyle = strokeColor;
      c.lineWidth = strokeW;
      c.lineJoin = 'round';
      c.strokeText(line, lineX, lineY);
    }
    if (tx.effect === 'rgb') {
      const off = Math.max(2, tx.size * 0.04);
      const wobble = Math.sin(t * 0.3 + i * 0.5) * off;
      const orig = c.shadowColor;
      c.shadowColor = 'transparent';
      c.globalCompositeOperation = 'screen';
      c.fillStyle = '#ff0040';
      c.fillText(line, lineX + wobble, lineY);
      c.fillStyle = '#00ffee';
      c.fillText(line, lineX - wobble, lineY);
      c.globalCompositeOperation = 'source-over';
      c.shadowColor = orig;
    }
    c.fillStyle = tx.color;
    c.fillText(line, lineX, lineY);

    if (tx.underline) {
      c.fillRect(lineX, lineY + tx.size * 0.45, lineW, Math.max(1, tx.size * 0.05));
    }
  });

  c.restore();
}

// ═══════════════════════════════════════════
// 文字拖曳（用 Pointer Events）
// ═══════════════════════════════════════════
let dragState = null;

function eventToPos(e) {
  const r = cv.getBoundingClientRect();
  const cx = e.clientX - r.left;
  const cy = e.clientY - r.top;
  return { x: cx / r.width, y: cy / r.height };
}

/** 回傳 hit 到的段落 index，沒有則 -1（從上層往下找）*/
function hitTextTest(e) {
  if (!state.img && !state.video) return -1;
  const p = eventToPos(e);
  for (let i = state.txts.length - 1; i >= 0; i--) {
    const tx = state.txts[i];
    if (!tx.text) continue;
    const lineCount = tx.text.split('\n').length;
    const tolX = Math.max(0.1, tx.size * Math.max(...tx.text.split('\n').map(s=>s.length)) * 0.3 / cv.width);
    const tolY = Math.max(0.05, tx.size * lineCount * tx.lineH * 0.7 / cv.height);
    if (Math.abs(p.x - tx.x) < tolX && Math.abs(p.y - tx.y) < tolY) return i;
  }
  return -1;
}

cv.addEventListener('pointerdown', e => {
  const idx = hitTextTest(e);
  if (idx === -1) return;
  // 自動選中該段
  if (idx !== state.selectedTxt) {
    state.selectedTxt = idx;
    syncEditorFromCurrent();
    renderTxtList();
  }
  const p = eventToPos(e);
  dragState = { offX: p.x - curTxt().x, offY: p.y - curTxt().y };
  cv.setPointerCapture(e.pointerId);
  cv.style.cursor = 'grabbing';
  e.preventDefault();
});

cv.addEventListener('pointermove', e => {
  if (!dragState) return;
  const p = eventToPos(e);
  curTxt().x = Math.max(0, Math.min(1, p.x - dragState.offX));
  curTxt().y = Math.max(0, Math.min(1, p.y - dragState.offY));
  $('#txtX').value = Math.round(curTxt().x * 100);
  $('#txtY').value = Math.round(curTxt().y * 100);
  $('#vTxtX').textContent = Math.round(curTxt().x * 100) + '%';
  $('#vTxtY').textContent = Math.round(curTxt().y * 100) + '%';
});

cv.addEventListener('pointerup', () => {
  dragState = null;
  cv.style.cursor = '';
});
cv.addEventListener('pointercancel', () => { dragState = null; cv.style.cursor = ''; });

// 雙擊 = inline 編輯
cv.addEventListener('dblclick', e => {
  const idx = hitTextTest(e);
  if (idx === -1) return;
  state.selectedTxt = idx;
  syncEditorFromCurrent();
  renderTxtList();
  openInlineEditor();
});

/** 在畫布上文字位置開啟 inline 編輯框 */
function openInlineEditor() {
  closeInlineEditor();
  const tx = curTxt();
  const r = cv.getBoundingClientRect();
  const wrap = $('#dz');
  const wrapR = wrap.getBoundingClientRect();

  // 計算文字螢幕位置（畫布座標 → 螢幕座標）
  const sx = r.left + tx.x * r.width;
  const sy = r.top + tx.y * r.height;
  const sw = Math.max(120, tx.size * 0.4 * tx.text.length * (r.width / cv.width));
  const sh = Math.max(40, tx.size * tx.text.split('\n').length * tx.lineH * (r.height / cv.height));

  const ed = document.createElement('textarea');
  ed.className = 'inline-editor';
  ed.value = tx.text;
  ed.style.left = (sx - wrapR.left - sw / 2) + 'px';
  ed.style.top  = (sy - wrapR.top - sh / 2) + 'px';
  ed.style.width = sw + 'px';
  ed.style.height = sh + 'px';
  ed.style.fontSize = Math.min(20, tx.size * (r.width / cv.width)) + 'px';
  wrap.appendChild(ed);

  ed.focus();
  ed.select();

  ed.addEventListener('input', () => {
    tx.text = ed.value;
    $('#txtText').value = ed.value;
    renderTxtList();
  });
  // Esc 或失焦關閉
  ed.addEventListener('blur', closeInlineEditor);
  ed.addEventListener('keydown', evt => {
    if (evt.key === 'Escape') closeInlineEditor();
  });
}
function closeInlineEditor() {
  const ed = document.querySelector('.inline-editor');
  if (ed) ed.remove();
}

// ═══════════════════════════════════════════
// C8 匯出
// ═══════════════════════════════════════════
function getOutputSize() {
  const src = state.isVideo ? state.video : state.img;
  if (!src) return { w: cv.width, h: cv.height };
  const natW = state.isVideo ? src.videoWidth : src.naturalWidth;
  const natH = state.isVideo ? src.videoHeight : src.naturalHeight;

  if (state.resMode === 'original') return { w: natW, h: natH };
  if (state.resMode === 'custom') {
    const w = state.customWidth;
    return { w, h: Math.round(natH * w / natW) };
  }
  return { w: cv.width, h: cv.height };
}

function updateResInfo() {
  const src = state.isVideo ? state.video : state.img;
  if (!src) {
    $('#resInfo').textContent = '請先上傳圖片或影片';
    return;
  }
  const { w, h } = getOutputSize();
  const tags = { original: '原始解析度', recommended: '適合 Threads / 社群', custom: '自訂寬度' };
  $('#resInfo').textContent = `${w} × ${h} px · ${tags[state.resMode]}`;
}

function showProgress(p, txt) {
  $('#progBar').style.display = 'block';
  $('#progText').style.display = 'block';
  $('#progFill').style.width = p + '%';
  $('#progText').textContent = txt;
  if (p >= 100) {
    setTimeout(() => {
      $('#progBar').style.display = 'none';
      $('#progText').style.display = 'none';
    }, 2500);
  }
}

function disableExport(v) {
  $('#btnPng').disabled = v;
  $('#btnGif').disabled = v;
  $('#btnMp4').disabled = v;
}

// PNG
$('#btnPng').addEventListener('click', () => {
  if (!state.img && !state.video) return;
  const { w, h } = getOutputSize();

  if (state.resMode === 'recommended') {
    cv.toBlob(b => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(b);
      a.download = `glitch_${state.fx}_${w}x${h}.png`;
      a.click();
      showProgress(100, 'PNG 完成！');
    }, 'image/png');
    return;
  }

  const off = document.createElement('canvas');
  off.width = w; off.height = h;
  drawFrame(off.getContext('2d'), w, h, 15);
  off.toBlob(b => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b);
    a.download = `glitch_${state.fx}_${w}x${h}.png`;
    a.click();
    showProgress(100, `PNG ${w}×${h} 完成！`);
  }, 'image/png');
});

// GIF worker (繞 CORS)
let gifWorkerURL = null;
async function getGifWorker() {
  if (gifWorkerURL) return gifWorkerURL;
  try {
    const res = await fetch('https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.worker.js');
    const code = await res.text();
    const blob = new Blob([code], { type: 'application/javascript' });
    gifWorkerURL = URL.createObjectURL(blob);
    return gifWorkerURL;
  } catch (e) {
    return 'https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.worker.js';
  }
}

// GIF
$('#btnGif').addEventListener('click', async () => {
  if (!state.img && !state.video) return;
  disableExport(true);
  cancelAnimationFrame(state.raf);
  const { w, h } = getOutputSize();
  showProgress(0, `準備 GIF (${w}×${h})...`);
  try {
    const workerURL = await getGifWorker();
    const off = document.createElement('canvas');
    off.width = w; off.height = h;
    const offCtx = off.getContext('2d');
    const g = new GIF({ workers: 4, quality: QUALITY_INFO[state.quality].gifQ, width: w, height: h, workerScript: workerURL });

    let finished = false;
    const wd = setTimeout(() => {
      if (!finished) { showProgress(100, '⚠ 超時'); disableExport(false); play(); }
    }, Math.max(60000, w * h * 0.05));

    g.on('progress', p => showProgress(50 + (0|p*50), 'GIF 壓縮中...'));
    g.on('finished', b => {
      finished = true;
      clearTimeout(wd);
      const suffix = state.isVideo ? '_video' : '';
      const a = document.createElement('a');
      a.href = URL.createObjectURL(b);
      a.download = `glitch_${state.fx}${suffix}_${w}x${h}.gif`;
      a.click();
      showProgress(100, '完成！');
      disableExport(false);
      play();
    });

    if (state.isVideo) {
      // ─── 影片模式：以剪輯區間取樣 ───
      const v = state.video;
      const startT = state.trimStart;
      const trimDur = state.trimEnd - startT;
      const total = Math.min(150, Math.ceil(trimDur * FPS));
      v.pause();
      v.loop = false;

      for (let f = 0; f < total; f++) {
        const targetTime = startT + (f / total) * trimDur;
        v.currentTime = targetTime;
        await new Promise(r => v.addEventListener('seeked', r, { once: true }));
        drawFrame(offCtx, w, h, f);
        g.addFrame(off, { copy: true, delay: 1000 / FPS | 0 });
        showProgress(0 | f / total * 50, `取樣 ${f+1}/${total}`);
      }
      v.loop = true;
    } else {
      // ─── 圖片模式：依 state.duration ───
      const total = state.duration * FPS;
      for (let f = 0; f < total; f++) {
        drawFrame(offCtx, w, h, f);
        g.addFrame(off, { copy: true, delay: 1000 / FPS | 0 });
        showProgress(0 | f / total * 50, `渲染 ${f+1}/${total}`);
        await new Promise(r => setTimeout(r, 0));
      }
    }

    g.render();
  } catch (e) {
    showProgress(100, '⚠ ' + e.message);
    disableExport(false);
    play();
  }
});

// MP4
$('#btnMp4').addEventListener('click', async () => {
  if (!state.img && !state.video) return;
  disableExport(true);
  cancelAnimationFrame(state.raf);
  const { w, h } = getOutputSize();

  const off = document.createElement('canvas');
  off.width = w; off.height = h;
  const offCtx = off.getContext('2d');

  const mime = MediaRecorder.isTypeSupported('video/mp4') ? 'video/mp4'
             : MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9'
             : 'video/webm';
  const bitrate = getBitrate(w, h);
  const ext = mime.startsWith('video/mp4') ? 'mp4' : 'webm';

  // ═══════ 影片模式：跟著影片時間軸錄製 ═══════
  if (state.isVideo) {
    const v = state.video;
    const startT = state.trimStart;
    const endT   = state.trimEnd;
    const trimDur = endT - startT;
    showProgress(0, `MP4 錄製 (${w}×${h}, ${trimDur.toFixed(1)}s)...`);

    v.pause();
    v.loop = false;

    // 等影片 seek 到起點
    v.currentTime = startT;
    await new Promise(r => v.addEventListener('seeked', r, { once: true }));

    const stream = off.captureStream(30);
    const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: bitrate });
    const chunks = [];
    recorder.ondataavailable = e => e.data.size && chunks.push(e.data);

    let drawingRaf = null;
    let stopped = false;

    const finalize = () => {
      if (stopped) return;
      stopped = true;
      cancelAnimationFrame(drawingRaf);
      v.loop = true;
      try { recorder.stop(); } catch(e) {}
    };

    recorder.onstop = () => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob(chunks, { type: mime }));
      a.download = `glitch_${state.fx}_video_${w}x${h}.${ext}`;
      a.click();
      showProgress(100, `完成！(${ext.toUpperCase()})`);
      disableExport(false);
      play();
    };

    // Watchdog：超過剪輯長度 + 5 秒還沒完成，強制停止
    const watchdog = setTimeout(() => {
      console.warn('[mp4] watchdog timeout - force stop');
      finalize();
    }, (trimDur * 1000) + 5000);

    // 持續繪製 + 監控時間
    let frameCount = 0;
    const drawLoop = () => {
      drawFrame(offCtx, w, h, frameCount++);
      const cur = v.currentTime;
      const elapsed = cur - startT;
      const progress = Math.min(99, (elapsed / trimDur) * 100 | 0);
      showProgress(progress, `錄製 ${elapsed.toFixed(1)} / ${trimDur.toFixed(1)}s`);

      // 主動偵測：到達剪輯結束點就停止（不再依賴 ended 事件）
      if (cur >= endT - 0.05 || v.ended) {
        clearTimeout(watchdog);
        // 多畫一幀確保最後一幀被捕獲
        setTimeout(() => {
          drawFrame(offCtx, w, h, frameCount++);
          setTimeout(finalize, 100);
        }, 50);
        return;
      }
      drawingRaf = requestAnimationFrame(drawLoop);
    };

    recorder.start();
    drawLoop();
    await v.play();
    return;
  }

  // ═══════ 圖片模式：原本的兩階段預渲染 ═══════
  const total = state.duration * FPS;
  showProgress(0, `MP4 預渲染 (${w}×${h})...`);

  const frames = [];
  const tmp = document.createElement('canvas');
  tmp.width = w; tmp.height = h;
  const tmpCtx = tmp.getContext('2d');
  for (let f = 0; f < total; f++) {
    drawFrame(tmpCtx, w, h, f);
    frames.push(await createImageBitmap(tmp));
    showProgress(0 | f / total * 60, `渲染 ${f+1}/${total}`);
    if (f % 3 === 0) await new Promise(r => setTimeout(r, 0));
  }

  showProgress(60, 'MP4 編碼...');
  const stream = off.captureStream(0);
  const track = stream.getVideoTracks()[0];
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: bitrate });
  const chunks = [];
  rec.ondataavailable = e => e.data.size && chunks.push(e.data);
  rec.onstop = () => {
    frames.forEach(b => b.close && b.close());
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(chunks, { type: mime }));
    a.download = `glitch_${state.fx}_${w}x${h}.${ext}`;
    a.click();
    showProgress(100, `完成！(${ext.toUpperCase()})`);
    disableExport(false);
    play();
  };
  rec.start();
  const frameMs = 1000 / FPS;
  for (let f = 0; f < total; f++) {
    const target = performance.now() + frameMs;
    offCtx.drawImage(frames[f], 0, 0);
    if (track.requestFrame) track.requestFrame();
    showProgress(60 + (0|f/total*35), `編碼 ${f+1}/${total}`);
    const wait = target - performance.now();
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
  }
  await new Promise(r => setTimeout(r, frameMs * 2));
  showProgress(98, '封裝中...');
  rec.stop();
});

// GLITCH STUDIO loaded
