// shared/elements.js — 由 index.js 搬出(階段 3-B),內容未改動
// 注意:document.getElementById 在模組載入時執行,main.js 於 DOM ready 後才動態 import 本檔。

const els = {
  stage: document.getElementById("stage"),
  stageBg: document.getElementById("stageBg"),
  characters: document.getElementById("characters"),
  stageCg: document.getElementById("stageCg"),
  choicesOverlay: document.getElementById("choicesOverlay"),
  dialogBox: document.getElementById("dialogBox"),
  dialogSpeaker: document.getElementById("dialogSpeaker"),
  dialogText: document.getElementById("dialogText"),
  dialogIndicator: document.getElementById("dialogIndicator"),
  dialogProgress: document.getElementById("dialogProgress"),
  scriptArea: document.getElementById("scriptArea"),
  lineCount: document.getElementById("lineCount"),
};

export { els };
