/* =================== 資料 =================== */
const EMOTES = [{"cn":"/驚訝","en":"/surprised","category":"情緒表情"},{"cn":"/不滿","en":"/angry","category":"情緒表情"},{"cn":"/憤怒","en":"/furious","category":"情緒表情"},{"cn":"/害羞","en":"/blush","category":"情緒表情"},{"cn":"/行禮","en":"/bow","category":"互動動作"},{"cn":"/加油","en":"/cheer","category":"互動動作"},{"cn":"/拍手","en":"/clap","category":"互動動作"},{"cn":"/招手","en":"/beckon","category":"互動動作"},{"cn":"/安慰","en":"/comfort","category":"互動動作"},{"cn":"/哭泣","en":"/cry","category":"互動動作"},{"cn":"/跳舞","en":"/dance","category":"舞蹈動作"},{"cn":"/質疑","en":"/doubt","category":"情緒表情"},{"cn":"/打盹","en":"/doze","category":"互動動作"},{"cn":"/後悔","en":"/fume","category":"情緒表情"},{"cn":"/道別","en":"/goodbye","category":"互動動作"},{"cn":"/揮手","en":"/wave","category":"互動動作"},{"cn":"/莫名","en":"/huh","category":"情緒表情"},{"cn":"/高興","en":"/joy","category":"情緒表情"},{"cn":"/下跪","en":"/kneel","category":"互動動作"},{"cn":"/輕笑","en":"/chuckle","category":"互動動作"},{"cn":"/大笑","en":"/laugh","category":"互動動作"},{"cn":"/張望","en":"/lookout","category":"互動動作"},{"cn":"/展示","en":"/me","category":"互動動作"},{"cn":"/搖頭","en":"/no","category":"互動動作"},{"cn":"/否定","en":"/deny","category":"互動動作"},{"cn":"/慌亂","en":"/panic","category":"情緒表情"},{"cn":"/指向","en":"/point","category":"互動動作"},{"cn":"/戳指","en":"/poke","category":"互動動作"},{"cn":"/稱讚","en":"/congratulate","category":"互動動作"},{"cn":"/激勵","en":"/psych","category":"互動動作"},{"cn":"/敬禮","en":"/salute","category":"互動動作"},{"cn":"/震驚","en":"/shocked","category":"情緒表情"},{"cn":"/聳肩","en":"/shrug","category":"互動動作"},{"cn":"/鼓勵","en":"/rally","category":"互動動作"},{"cn":"/安撫","en":"/soothe","category":"互動動作"},{"cn":"/迷糊","en":"/stagger","category":"情緒表情"},{"cn":"/伸展","en":"/stretch","category":"互動動作"},{"cn":"/慍怒","en":"/sulk","category":"情緒表情"},{"cn":"/思考","en":"/think","category":"互動動作"},{"cn":"/失望","en":"/upset","category":"情緒表情"},{"cn":"/歡迎","en":"/welcome","category":"互動動作"},{"cn":"/點頭","en":"/yes","category":"互動動作"},{"cn":"/肯定","en":"/thumbsup","category":"互動動作"},{"cn":"/自視","en":"/examineself","category":"互動動作"},{"cn":"/擺造型","en":"/pose","category":"互動動作"},{"cn":"/飛吻","en":"/blowkiss","category":"互動動作"},{"cn":"/下跪認錯","en":"/grovel","category":"互動動作"},{"cn":"/欣喜若狂","en":"/happy","category":"情緒表情"},{"cn":"/大失所望","en":"/disappointed","category":"情緒表情"},{"cn":"/坐下","en":"/sit","category":"互動動作"},{"cn":"/引用","en":"/airquotes","category":"互動動作"},{"cn":"/祈禱","en":"/pray","category":"互動動作"},{"cn":"/帝國式軍禮","en":"/imperialsalute","category":"互動動作"},{"cn":"/平常","en":"/straightface","category":"情緒表情"},{"cn":"/微笑","en":"/smile","category":"情緒表情"},{"cn":"/笑顏","en":"/grin","category":"情緒表情"},{"cn":"/自信","en":"/smirk","category":"情緒表情"},{"cn":"/無畏","en":"/taunt","category":"情緒表情"},{"cn":"/閉目","en":"/shuteyes","category":"情緒表情"},{"cn":"/悲傷","en":"/sad","category":"情緒表情"},{"cn":"/恐怖","en":"/scared","category":"情緒表情"},{"cn":"/意外","en":"/amazed","category":"情緒表情"},{"cn":"/痛苦","en":"/ouch","category":"情緒表情"},{"cn":"/反感","en":"/annoyed","category":"情緒表情"},{"cn":"/吃驚","en":"/alert","category":"情緒表情"},{"cn":"/擔心","en":"/worried","category":"情緒表情"},{"cn":"/軍禮","en":"/gcsalute","category":"互動動作"},{"cn":"/投擲","en":"/throw","category":"戰鬥姿勢"},{"cn":"/改變姿勢","en":"/changepose","category":"互動物品"},{"cn":"/踢踏舞","en":"/stepdance","category":"舞蹈動作"},{"cn":"/豐饒之舞","en":"/harvestdance","category":"舞蹈動作"},{"cn":"/宮廷之舞","en":"/balldance","category":"舞蹈動作"},{"cn":"/紳士之舞","en":"/mandervilledance","category":"舞蹈動作"},{"cn":"/撫摸","en":"/stroke","category":"互動動作"},{"cn":"/遞交","en":"/handover","category":"互動動作"},{"cn":"/火盆舞","en":"/bombdance","category":"舞蹈動作"},{"cn":"/勝利歡呼","en":"/hurray","category":"互動動作"},{"cn":"/甩巴掌","en":"/slap","category":"互動動作"},{"cn":"/擁抱","en":"/hug","category":"互動動作"},{"cn":"/深情擁抱","en":"/embrace","category":"互動動作"},{"cn":"/紳士風度","en":"/hildibrand","category":"戰鬥姿勢"},{"cn":"/對拳","en":"/fistbump","category":"互動動作"},{"cn":"/薩維奈舞","en":"/thavdance","category":"舞蹈動作"},{"cn":"/黃金之舞","en":"/golddance","category":"舞蹈動作"},{"cn":"/太陽之舞","en":"/sundance","category":"舞蹈動作"},{"cn":"/準備戰鬥","en":"/battlestance","category":"戰鬥姿勢"},{"cn":"/歡呼勝利","en":"/victorypose","category":"互動動作"},{"cn":"/後空翻","en":"/backflip","category":"戰鬥姿勢"},{"cn":"/抱拳禮","en":"/easterngreeting","category":"互動動作"},{"cn":"/靈光一現","en":"/eureka","category":"戰鬥姿勢"},{"cn":"/莫古莫古舞","en":"/mogdance","category":"舞蹈動作"},{"cn":"/太棒了","en":"/haurchefant","category":"戰鬥姿勢"},{"cn":"/熱身","en":"/easternstretch","category":"戰鬥姿勢"},{"cn":"/東方傳統舞蹈","en":"/easterndance","category":"舞蹈動作"},{"cn":"/戰隊演武正紅一式","en":"/rangerpose1r","category":"戰鬥姿勢"},{"cn":"/戰隊演武正黑二式","en":"/rangerpose2r","category":"戰鬥姿勢"},{"cn":"/戰隊演武正黃三式","en":"/rangerpose3r","category":"戰鬥姿勢"},{"cn":"/飛眼","en":"/wink","category":"互動動作"},{"cn":"/戰隊演武逆紅一式","en":"/rangerpose1l","category":"戰鬥姿勢"},{"cn":"/戰隊演武逆黑二式","en":"/rangerpose2l","category":"戰鬥姿勢"},{"cn":"/戰隊演武逆黃三式","en":"/rangerpose3l","category":"戰鬥姿勢"},{"cn":"/捂臉","en":"/facepalm","category":"互動動作"},{"cn":"/斬鐵劍","en":"/zantetsuken","category":"戰鬥姿勢"},{"cn":"/肉體之美","en":"/flex","category":"戰鬥姿勢"},{"cn":"/默哀","en":"/respect","category":"互動動作"},{"cn":"/陰險","en":"/sneer","category":"情緒表情"},{"cn":"/撒嬌","en":"/prettyplease","category":"互動動作"},{"cn":"/裝死","en":"/playdead","category":"戰鬥姿勢"},{"cn":"/日月之舞","en":"/moonlift","category":"舞蹈動作"},{"cn":"/表達愛意","en":"/dote","category":"互動動作"},{"cn":"/托眼鏡","en":"/spectacles","category":"互動動作"},{"cn":"/小黃鶯之舞","en":"/songbird","category":"舞蹈動作"},{"cn":"/浮水","en":"/waterfloat","category":"互動物品"},{"cn":"/水中翻跟斗","en":"/waterflip","category":"互動物品"},{"cn":"/嘟嘴","en":"/puckerup","category":"互動動作"},{"cn":"/蓄力迸發","en":"/powerup","category":"戰鬥姿勢"},{"cn":"/行東方禮","en":"/easternbow","category":"互動動作"},{"cn":"/深蹲","en":"/squats","category":"戰鬥姿勢"},{"cn":"/伏地挺身","en":"/pushups","category":"戰鬥姿勢"},{"cn":"/仰臥起坐","en":"/situps","category":"戰鬥姿勢"},{"cn":"/深呼吸","en":"/breathcontrol","category":"戰鬥姿勢"},{"cn":"/說話","en":"/converse","category":"互動動作"},{"cn":"/認真","en":"/concentrate","category":"情緒表情"},{"cn":"/困惑","en":"/disturbed","category":"情緒表情"},{"cn":"/柔和","en":"/simper","category":"情緒表情"},{"cn":"/滿足","en":"/beam","category":"情緒表情"},{"cn":"/立正","en":"/attention","category":"互動動作"},{"cn":"/稍息","en":"/atease","category":"互動動作"},{"cn":"/練拳","en":"/box","category":"戰鬥姿勢"},{"cn":"/祝禱","en":"/ritualprayer","category":"互動動作"},{"cn":"/害怕","en":"/tremble","category":"情緒表情"},{"cn":"/單膝跪地","en":"/winded","category":"互動動作"},{"cn":"/大吃一驚","en":"/aback","category":"情緒表情"},{"cn":"/打招呼","en":"/greet","category":"互動動作"},{"cn":"/方形步","en":"/boxstep","category":"舞蹈動作"},{"cn":"/側步","en":"/sidestep","category":"舞蹈動作"},{"cn":"/究極","en":"/ultima","category":"戰鬥姿勢"},{"cn":"/胡鷹之舞","en":"/yoldance","category":"舞蹈動作"},{"cn":"/撩水","en":"/splash","category":"互動物品"},{"cn":"/好熱","en":"/sweat","category":"情緒表情"},{"cn":"/好冷","en":"/shiver","category":"情緒表情"},{"cn":"/說明","en":"/elucidate","category":"互動動作"},{"cn":"/思索","en":"/ponder","category":"情緒表情"},{"cn":"/左飛眼","en":"/leftwink","category":"互動動作"},{"cn":"/幻想舞步","en":"/getfantasy","category":"舞蹈動作"},{"cn":"/波波托步","en":"/popotostep","category":"舞蹈動作"},{"cn":"/哼歌","en":"/hum","category":"互動動作"},{"cn":"/確認","en":"/confirm","category":"互動動作"},{"cn":"/說明計劃","en":"/scheme","category":"互動動作"},{"cn":"/忍耐","en":"/endure","category":"情緒表情"},{"cn":"/神典石","en":"/tomestone","category":"互動動作"},{"cn":"/趾踵步","en":"/heeltoe","category":"舞蹈動作"},{"cn":"/古菩步","en":"/goobbuedo","category":"舞蹈動作"},{"cn":"/心意","en":"/gratuity","category":"互動動作"},{"cn":"/振作精神","en":"/fistpump","category":"互動動作"},{"cn":"/提醒","en":"/reprimand","category":"互動動作"},{"cn":"/優雅仙人刺","en":"/sabotender","category":"舞蹈動作"},{"cn":"/紳士舞步","en":"/mandervillemambo","category":"舞蹈動作"},{"cn":"/啦哩吼","en":"/laliho","category":"互動動作"},{"cn":"/歐米茄M架勢","en":"/simulationm","category":"戰鬥姿勢"},{"cn":"/歐米茄F架勢","en":"/simulationf","category":"戰鬥姿勢"},{"cn":"/乾杯","en":"/toast","category":"互動物品"},{"cn":"/背靠","en":"/lean","category":"互動物品"},{"cn":"/頭痛","en":"/headache","category":"情緒表情"},{"cn":"/打響指","en":"/snap","category":"互動動作"},{"cn":"/吃麵包","en":"/bread","category":"互動物品"},{"cn":"/看書","en":"/read","category":"互動動作"},{"cn":"/堅持主張","en":"/insist","category":"互動動作"},{"cn":"/疑問","en":"/consider","category":"情緒表情"},{"cn":"/嘿喲","en":"/wasshoi","category":"互動動作"},{"cn":"/花雨","en":"/flowershower","category":"互動物品"},{"cn":"/火焰之舞","en":"/flamedance","category":"舞蹈動作"},{"cn":"/擊掌","en":"/highfive","category":"互動動作"},{"cn":"/巡視","en":"/guard","category":"互動動作"},{"cn":"/詛咒","en":"/malevolence","category":"戰鬥姿勢"},{"cn":"/蜜蜂之舞","en":"/beesknees","category":"舞蹈動作"},{"cn":"/啦哩吼舞","en":"/lalihop","category":"舞蹈動作"},{"cn":"/吃飯糰","en":"/eatriceball","category":"互動物品"},{"cn":"/吃蘋果","en":"/eatapple","category":"互動物品"},{"cn":"/搓手","en":"/wringhands","category":"互動動作"},{"cn":"/掃地","en":"/sweep","category":"互動物品"},{"cn":"/黑色陸行鳥之筆","en":"/paintblack","category":"互動物品"},{"cn":"/紅色陸行鳥之筆","en":"/paintred","category":"互動物品"},{"cn":"/黃色陸行鳥之筆","en":"/paintyellow","category":"互動物品"},{"cn":"/藍色陸行鳥之筆","en":"/paintblue","category":"互動物品"},{"cn":"/假笑","en":"/fakesmile","category":"情緒表情"},{"cn":"/默劇","en":"/pantomime","category":"舞蹈動作"},{"cn":"/不解","en":"/vexed","category":"情緒表情"},{"cn":"/噓","en":"/shush","category":"互動動作"},{"cn":"/吃披薩","en":"/eatpizza","category":"互動物品"},{"cn":"/比對文獻","en":"/reference","category":"互動動作"},{"cn":"/兩眼放光","en":"/wow","category":"情緒表情"},{"cn":"/嚇唬人","en":"/frighten","category":"互動動作"},{"cn":"/吃南瓜餅乾","en":"/eatpumpkincookie","category":"互動物品"},{"cn":"/比心","en":"/loveheart","category":"互動動作"},{"cn":"/搖雪克杯","en":"/shakedrink","category":"互動物品"},{"cn":"/澆水","en":"/water","category":"互動物品"},{"cn":"/魅惑擁抱","en":"/charmed","category":"互動動作"},{"cn":"/聲援小紫","en":"/cheerwaveviolet","category":"互動動作"},{"cn":"/聲援小白","en":"/cheeronbright","category":"互動動作"}];

const CHANNELS = [
  { name: '感情表現', cmd: '/em' },
  { name: '一般說話', cmd: '/s'  },
  { name: '呼喊',     cmd: '/y'  },
  { name: '範圍喊叫', cmd: '/sh' },
  { name: '小隊',     cmd: '/p'  },
  { name: '團隊',     cmd: '/a'  },
  { name: '對自己',   cmd: '/e'  },
  { name: '密語當前目標', cmd: '/t <t>' },
  { name: '跨服貝 1', cmd: '/cwl1' },
  { name: '跨服貝 2', cmd: '/cwl2' },
  { name: '跨服貝 3', cmd: '/cwl3' },
  { name: '跨服貝 4', cmd: '/cwl4' },
  { name: '跨服貝 5', cmd: '/cwl5' },
  { name: '跨服貝 6', cmd: '/cwl6' },
  { name: '跨服貝 7', cmd: '/cwl7' },
  { name: '跨服貝 8', cmd: '/cwl8' }
];

const CATEGORIES = ['全部', '情緒表情', '互動動作', '舞蹈動作', '戰鬥姿勢', '互動物品', '其他'];
const MAX_LINES = 15;

// 已知頻道指令的正則（用於識別行首是否已有頻道）
// /t <t> 要優先匹配（含 <t>），其次才是 /t Alice 這種
const CHANNEL_PREFIX_RE = /^(\/(?:em|s|y|sh|p|a|e|cwl[1-8]|cwlinkshell[1-8]|linkshell[1-8]|l[1-8]|say|yell|shout|party|alliance|freecompany|fc|echo|tell)\b|\/t\s*<t>|\/t\b)/;

/* =================== 狀態 =================== */
const state = {
  selectedCategory: '全部',
  emoteSearch: '',
  waitValue: '2',
  motion: false
};

/* =================== 元素 =================== */
const $ = (id) => document.getElementById(id);
const editor = $('macroEditor');
const lineCountEl = $('lineCount');
const channelGrid = $('channelGrid');
const emoteGrid = $('emoteGrid');
const emoteSearch = $('emoteSearch');
const catTabs = $('catTabs');
const motionCheck = $('motionCheck');
const motionToggle = $('motionToggle');
const waitCustom = $('waitCustom');
const scopeIndicator = $('scopeIndicator');
const scopeText = $('scopeText');
const toast = $('toast');

/* =================== 工具：行操作 =================== */
function getEditorLines() {
  return editor.value.split('\n');
}
function setEditorLines(lines) {
  editor.value = lines.join('\n');
  updateLineCount();
}

/* 把當前選取範圍轉成「行範圍」[startLine, endLine]，inclusive */
function getSelectionLineRange() {
  const text = editor.value;
  const start = editor.selectionStart;
  const end = editor.selectionEnd;
  if (start === end) return null;  // 沒選取

  // 算 start 是第幾行
  const before = text.slice(0, start);
  const startLine = (before.match(/\n/g) || []).length;

  // 算 end 是第幾行（如果 end 剛好在換行符後一個位置，那它其實沒涵蓋下一行）
  const beforeEnd = text.slice(0, end);
  let endLine = (beforeEnd.match(/\n/g) || []).length;
  // 如果 end 剛好在某行的開頭（即 text[end-1] === '\n'），不應該包含這一行
  if (end > 0 && text[end - 1] === '\n' && end > start) {
    endLine -= 1;
  }
  if (endLine < startLine) endLine = startLine;
  return [startLine, endLine];
}

/* 更新「作用範圍」提示 */
function updateScopeIndicator() {
  const range = getSelectionLineRange();
  if (range) {
    const [s, e] = range;
    if (s === e) {
      scopeText.textContent = `已選取第 ${s + 1} 行 — 變動只套用於此行`;
    } else {
      scopeText.textContent = `已選取第 ${s + 1}~${e + 1} 行 — 變動只套用於這 ${e - s + 1} 行`;
    }
    scopeIndicator.classList.remove('global');
  } else {
    scopeText.textContent = '未選取 — 變動將套用至所有行';
    scopeIndicator.classList.add('global');
  }
}

/* 取得「作用範圍」的行索引陣列（用於統一頻道、批次 wait） */
function getActiveLineIndices() {
  const range = getSelectionLineRange();
  const lines = getEditorLines();
  if (range) {
    const [s, e] = range;
    return Array.from({ length: e - s + 1 }, (_, i) => s + i);
  } else {
    return Array.from({ length: lines.length }, (_, i) => i);
  }
}

/* 行數計數器 */
function updateLineCount() {
  // 空文字 = 0 行；非空算 \n + 1，但結尾換行不算
  let n;
  if (editor.value === '') {
    n = 0;
  } else {
    n = editor.value.split('\n').length;
    // 結尾是 \n？最後一行算空白行
    // FF14 巨集會忽略空白行，這裡為視覺一致也忽略
  }
  // 過濾掉純空白行
  const nonEmpty = editor.value.split('\n').filter(l => l.trim().length > 0).length;
  lineCountEl.textContent = `${nonEmpty} / ${MAX_LINES} 行`;
  lineCountEl.classList.toggle('warn', nonEmpty >= 12 && nonEmpty < MAX_LINES);
  lineCountEl.classList.toggle('danger', nonEmpty > MAX_LINES);
}

/* =================== 頻道按鈕 =================== */
function renderChannels() {
  channelGrid.innerHTML = '';
  CHANNELS.forEach((c) => {
    const btn = document.createElement('button');
    btn.className = 'chan-btn';
    btn.innerHTML = `<div class="name">${c.name}</div><div class="cmd">${c.cmd}</div>`;
    btn.onclick = () => unifyChannel(c.cmd);
    channelGrid.appendChild(btn);
  });
}

function unifyChannel(channelCmd) {
  const indices = getActiveLineIndices();
  const lines = getEditorLines();
  let changed = 0;
  let skippedEmote = 0;
  indices.forEach((i) => {
    const line = lines[i];
    if (line === undefined) return;
    if (line.trim() === '') return;  // 空白行不動

    // 檢查行首是否是已知頻道
    const chMatch = line.match(CHANNEL_PREFIX_RE);
    if (chMatch) {
      // 已有頻道 → 替換
      const stripped = line.slice(chMatch[0].length).trimStart();
      lines[i] = channelCmd + ' ' + stripped;
      changed++;
    } else if (line.trimStart().startsWith('/')) {
      // 行首是 / 但不是頻道（多半是動作如 /擁抱）→ 不動
      skippedEmote++;
    } else {
      // 純文字 → 加上頻道
      lines[i] = channelCmd + ' ' + line.trimStart();
      changed++;
    }
  });
  setEditorLines(lines);
  if (changed === 0 && skippedEmote === 0) {
    showToast('沒有可套用的行', true);
  } else {
    const range = getSelectionLineRange();
    let msg = `已將${range ? '選取的' : ''}${changed} 行統一為 ${channelCmd}`;
    if (skippedEmote > 0) msg += `（${skippedEmote} 行動作指令跳過）`;
    showToast(msg);
  }
}

/* 清空頻道（保留動作行的 / 開頭，例如 /擁抱） */
function clearAllChannels() {
  const indices = getActiveLineIndices();
  const lines = getEditorLines();
  let changed = 0;
  indices.forEach((i) => {
    const line = lines[i];
    if (line === undefined) return;
    if (line.trim() === '') return;
    const m = line.match(CHANNEL_PREFIX_RE);
    if (m) {
      lines[i] = line.slice(m[0].length).trimStart();
      changed++;
    }
  });
  setEditorLines(lines);
  if (changed === 0) {
    showToast('沒有頻道前綴可清空', true);
  } else {
    const range = getSelectionLineRange();
    showToast(`已清除${range ? '選取的' : ''} ${changed} 行的頻道前綴`);
  }
}

/* =================== 等待 wait.X =================== */
function highlightActiveSec() {
  document.querySelectorAll('.wait-num').forEach((b) => {
    b.classList.toggle('active', b.dataset.secs === state.waitValue);
  });
}

function updateSecLabels() {
  const v = state.waitValue;
  const bs = $('batchSecLabel');
  if (bs) bs.textContent = v;
}

document.querySelectorAll('.wait-num').forEach((b) => {
  b.onclick = () => {
    state.waitValue = b.dataset.secs;
    waitCustom.value = '';
    highlightActiveSec();
    updateSecLabels();
  };
});

waitCustom.addEventListener('input', (e) => {
  const v = e.target.value.trim();
  if (v) {
    state.waitValue = v;
    document.querySelectorAll('.wait-num').forEach((b) => b.classList.remove('active'));
  } else {
    state.waitValue = '2';
    highlightActiveSec();
  }
  updateSecLabels();
});

/* 在作用範圍每行末加上 <wait.X> */
/* 判斷是否為「倒數行」(內容只有「數字 [<se.X>] <wait.1>」) — 用於防呆 */
function isCountdownLine(line) {
  return /^\s*\d+(\s+<se\.\d+>)?\s+<wait\.1>\s*$/.test(line);
}

$('applyBatchWait').onclick = () => {
  const v = state.waitValue || '2';
  const indices = getActiveLineIndices();
  const lines = getEditorLines();
  let changed = 0;
  let skippedCountdown = 0;
  indices.forEach((i) => {
    const line = lines[i];
    if (line === undefined) return;
    if (line.trim() === '') return;
    if (isCountdownLine(line)) {
      skippedCountdown++;
      return;
    }
    // 移除既有尾端 <wait.X>
    const stripped = line.replace(/\s*<wait\.[^>]+>\s*$/, '');
    lines[i] = stripped + ' <wait.' + v + '>';
    changed++;
  });
  setEditorLines(lines);
  if (changed === 0 && skippedCountdown === 0) {
    showToast('沒有可套用的行', true);
  } else {
    const range = getSelectionLineRange();
    let msg = `已在${range ? '選取的' : '所有'} ${changed} 行末加上 <wait.${v}>`;
    if (skippedCountdown > 0) msg += `（${skippedCountdown} 行倒數行跳過）`;
    showToast(msg);
  }
};

/* 清空全部 wait（無視選取，全文清空；倒數行的 wait.1 保留） */
$('clearAllWait').onclick = () => {
  const lines = getEditorLines();
  let count = 0;
  let skippedCountdown = 0;
  lines.forEach((line, i) => {
    if (isCountdownLine(line)) {
      skippedCountdown++;
      return;  // 倒數行的 wait.1 不動
    }
    if (/\s*<wait\.[^>]+>\s*$/.test(line)) {
      lines[i] = line.replace(/\s*<wait\.[^>]+>\s*$/, '');
      count++;
    }
  });
  setEditorLines(lines);
  if (count === 0 && skippedCountdown === 0) {
    showToast('沒有 <wait.X> 可清空', true);
  } else {
    let msg = `已清空 ${count} 個 <wait.X>`;
    if (skippedCountdown > 0) msg += `（${skippedCountdown} 行倒數行保留）`;
    showToast(msg);
  }
};

$('clearAllChannels').onclick = clearAllChannels;

/* =================== 清空 / 複製 =================== */
$('clearBtn').onclick = () => {
  if (editor.value.trim() === '') {
    showToast('已是空的', true);
    return;
  }
  editor.value = '';
  updateLineCount();
  editor.focus();
  showToast('已清空全部');
};
$('copyBtn').onclick = async () => {
  const text = editor.value
    .split('\n')
    .filter(l => l.trim() !== '')
    .join('\n');
  if (!text) {
    showToast('沒有內容可複製', true);
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    showToast('已複製到剪貼簿');
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast('已複製到剪貼簿');
  }
};

function insertAtCursor(insert) {
  const start = editor.selectionStart || 0;
  const end = editor.selectionEnd || 0;
  const before = editor.value.slice(0, start);
  const after = editor.value.slice(end);
  editor.value = before + insert + after;
  const newPos = start + insert.length;
  editor.focus();
  editor.setSelectionRange(newPos, newPos);
  updateLineCount();
}

/* 在文字框末尾新增一行 */
function appendNewLine(text) {
  const cur = editor.value;
  let prefix = '';
  if (cur.length > 0 && !cur.endsWith('\n')) {
    prefix = '\n';
  }
  editor.value = cur + prefix + text;
  updateLineCount();
  editor.focus();
  // 把游標移到末尾
  const pos = editor.value.length;
  editor.setSelectionRange(pos, pos);
}

/* =================== 情感動作面板 =================== */
function renderCatTabs() {
  catTabs.innerHTML = '';
  CATEGORIES.forEach((c) => {
    const t = document.createElement('button');
    t.className = 'cat-tab' + (c === state.selectedCategory ? ' active' : '');
    t.textContent = c;
    t.onclick = () => {
      state.selectedCategory = c;
      renderCatTabs();
      renderEmotes();
    };
    catTabs.appendChild(t);
  });
}

function renderEmotes() {
  emoteGrid.innerHTML = '';
  const q = state.emoteSearch.trim().toLowerCase();
  let list = EMOTES;
  if (state.selectedCategory !== '全部') {
    list = list.filter((e) => e.category === state.selectedCategory);
  }
  if (q) {
    list = list.filter((e) =>
      e.cn.toLowerCase().includes(q) || e.en.toLowerCase().includes(q)
    );
  }
  if (list.length === 0) {
    emoteGrid.innerHTML = '<div class="emote-empty">◇ 沒有找到符合的動作 ◇</div>';
    return;
  }
  list.forEach((e) => {
    const b = document.createElement('button');
    b.className = 'emote-btn';
    b.innerHTML = `${e.cn.replace('/', '')}<span class="en">${e.en}</span>`;
    b.title = `${e.cn} (${e.en})`;
    b.onclick = () => {
      const cmdLine = e.cn + (state.motion ? ' motion' : '');
      appendNewLine(cmdLine);
      showToast(`已新增：${cmdLine}`);
    };
    emoteGrid.appendChild(b);
  });
}

emoteSearch.addEventListener('input', (e) => {
  state.emoteSearch = e.target.value;
  renderEmotes();
});

motionCheck.addEventListener('change', (e) => {
  state.motion = e.target.checked;
  motionToggle.classList.toggle('checked', state.motion);
});

/* 浮動視窗摺疊 */
$('emoteFloaterHeader').onclick = (e) => {
  if (e.target.closest('.emote-floater-toggle')) return;
  if (e.target.closest('.emote-resize-handle')) return;
  $('emoteFloater').classList.toggle('collapsed');
};
$('emoteFloaterToggle').onclick = (e) => {
  e.stopPropagation();
  $('emoteFloater').classList.toggle('collapsed');
};

/* 浮動視窗 resize（左邊、底部、左下角） */
(function setupEmoteResize() {
  const fl = $('emoteFloater');
  if (!fl) return;
  const handles = [
    { el: $('emoteResizeLeft'), dir: 'x' },
    { el: $('emoteResizeBottom'), dir: 'y' },
    { el: $('emoteResizeCorner'), dir: 'xy' },
  ];

  handles.forEach(({ el, dir }) => {
    if (!el) return;
    el.addEventListener('mousedown', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const startX = ev.clientX;
      const startY = ev.clientY;
      const r = fl.getBoundingClientRect();
      const startW = r.width;
      const startH = r.height;
      document.body.classList.add('emote-resizing');

      function onMove(e) {
        if (dir.includes('x')) {
          // 視窗釘在右邊，拖左 handle 往左拉 → 寬度增加（dx 為負時 width 增加）
          const dx = e.clientX - startX;
          const newW = Math.max(240, Math.min(window.innerWidth - 48, startW - dx));
          fl.style.width = newW + 'px';
        }
        if (dir.includes('y')) {
          const dy = e.clientY - startY;
          const newH = Math.max(200, Math.min(window.innerHeight - 48, startH + dy));
          fl.style.height = newH + 'px';
        }
      }
      function onUp() {
        document.body.classList.remove('emote-resizing');
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        // 儲存大小
        try {
          localStorage.setItem('emoteFloaterSize', JSON.stringify({
            w: fl.style.width || '',
            h: fl.style.height || ''
          }));
        } catch {}
      }
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });

    // touch 支援
    el.addEventListener('touchstart', (ev) => {
      if (ev.touches.length !== 1) return;
      ev.preventDefault();
      ev.stopPropagation();
      const t = ev.touches[0];
      const startX = t.clientX;
      const startY = t.clientY;
      const r = fl.getBoundingClientRect();
      const startW = r.width;
      const startH = r.height;
      document.body.classList.add('emote-resizing');

      function onMove(e) {
        if (e.touches.length !== 1) return;
        const t = e.touches[0];
        if (dir.includes('x')) {
          const dx = t.clientX - startX;
          const newW = Math.max(240, Math.min(window.innerWidth - 48, startW - dx));
          fl.style.width = newW + 'px';
        }
        if (dir.includes('y')) {
          const dy = t.clientY - startY;
          const newH = Math.max(200, Math.min(window.innerHeight - 48, startH + dy));
          fl.style.height = newH + 'px';
        }
      }
      function onEnd() {
        document.body.classList.remove('emote-resizing');
        document.removeEventListener('touchmove', onMove);
        document.removeEventListener('touchend', onEnd);
        try {
          localStorage.setItem('emoteFloaterSize', JSON.stringify({
            w: fl.style.width || '',
            h: fl.style.height || ''
          }));
        } catch {}
      }
      document.addEventListener('touchmove', onMove, { passive: false });
      document.addEventListener('touchend', onEnd);
    }, { passive: false });
  });

  // 還原儲存的大小
  try {
    const raw = localStorage.getItem('emoteFloaterSize');
    if (raw) {
      const { w, h } = JSON.parse(raw);
      if (w) fl.style.width = w;
      if (h) fl.style.height = h;
    }
  } catch {}
})();

/* =================== 自動完成 =================== */
const ac = {
  popup: null,
  items: [],
  selectedIdx: 0,
  matchStart: -1,
  matchEnd: -1,
  query: ''
};

// 追蹤「剛剛補完的動作」狀態 — 用於 Tab 加 motion / Backspace 刪 motion
const lastCompletion = {
  active: false,        // 是否處於「剛補完」狀態
  emoteEnd: -1,         // 動作名稱 (e.g. /擁抱) 結尾在 editor.value 的位置
  withMotion: false,    // 已有 motion 後綴
  motionEnd: -1         // ' motion' 結尾位置（若有）
};

function clearLastCompletion() {
  lastCompletion.active = false;
  lastCompletion.emoteEnd = -1;
  lastCompletion.withMotion = false;
  lastCompletion.motionEnd = -1;
}

// 追蹤「剛換行繼承前綴」狀態 — Backspace 一次刪整個前綴
const lastInherit = {
  active: false,
  prefixStart: -1,     // 前綴在 editor.value 的開始位置（換行符之後）
  prefixEnd: -1        // 前綴結尾（含尾端空格）
};

function clearLastInherit() {
  lastInherit.active = false;
  lastInherit.prefixStart = -1;
  lastInherit.prefixEnd = -1;
}

function detectEmoteToken() {
  const pos = editor.selectionStart || 0;
  const text = editor.value;
  let slashIdx = -1;
  for (let i = pos - 1; i >= 0; i--) {
    const ch = text[i];
    if (ch === '/') { slashIdx = i; break; }
    if (ch === ' ' || ch === '\t' || ch === '\n') break;
  }
  if (slashIdx < 0) return null;
  if (slashIdx > 0) {
    const prev = text[slashIdx - 1];
    if (prev !== ' ' && prev !== '\t' && prev !== '\n') return null;
  }
  const query = text.slice(slashIdx + 1, pos);
  if (query.length < 1) return null;
  if (/[\s<>]/.test(query)) return null;
  return { start: slashIdx, end: pos, query };
}

function filterEmotes(query) {
  const q = query.toLowerCase();
  const results = [];
  for (const e of EMOTES) {
    const cnNoSlash = e.cn.slice(1);
    const enNoSlash = e.en.slice(1);
    let score = -1, matchType = null;
    if (cnNoSlash.startsWith(query)) { score = 0; matchType = 'cn-prefix'; }
    else if (enNoSlash.toLowerCase().startsWith(q)) { score = 1; matchType = 'en-prefix'; }
    else if (cnNoSlash.includes(query)) { score = 2; matchType = 'cn-contain'; }
    else if (enNoSlash.toLowerCase().includes(q)) { score = 3; matchType = 'en-contain'; }
    if (score >= 0) results.push({ ...e, _score: score, _matchType: matchType });
  }
  results.sort((a, b) => a._score - b._score);
  return results.slice(0, 12);
}

function showAutoComplete(tokenInfo) {
  closeAutoComplete();
  const matched = filterEmotes(tokenInfo.query);
  if (matched.length === 0) return;

  ac.matchStart = tokenInfo.start;
  ac.matchEnd = tokenInfo.end;
  ac.query = tokenInfo.query;
  ac.items = matched;
  ac.selectedIdx = 0;

  const popup = document.createElement('div');
  popup.className = 'autocomplete-popup';
  ac.popup = popup;

  matched.forEach((e, idx) => {
    const item = document.createElement('div');
    item.className = 'ac-item' + (idx === 0 ? ' selected' : '');
    item.dataset.idx = idx;
    item.innerHTML = `
      <span class="ac-cn">${highlightMatch(e.cn, tokenInfo.query, e._matchType)}</span>
      <span class="ac-en">${highlightMatch(e.en, tokenInfo.query, e._matchType)}</span>
    `;
    item.onmouseenter = () => { ac.selectedIdx = idx; updateSelected(); };
    item.onmousedown = (ev) => { ev.preventDefault(); ac.selectedIdx = idx; acceptAutoComplete(); };
    popup.appendChild(item);
  });

  const hint = document.createElement('div');
  hint.className = 'ac-hint';
  hint.innerHTML = '<kbd>↑↓</kbd> 選項　<kbd>Tab</kbd>/<kbd>Enter</kbd> 補全　<kbd>Esc</kbd> 關閉';
  popup.appendChild(hint);

  document.body.appendChild(popup);
  positionAutoComplete();
  // 第二次定位 — 確保 popup 渲染後尺寸正確（用於上下方判斷）
  requestAnimationFrame(positionAutoComplete);
}

/**
 * 取得 textarea 中游標的實際 (left, top, height) 像素位置（相對於 viewport）。
 * 透過建立鏡像 div 計算。
 */
function getTextareaCaretCoords(ta) {
  const cs = window.getComputedStyle(ta);
  // 鏡像 div
  const div = document.createElement('div');
  const properties = [
    'boxSizing','width','height','overflowX','overflowY',
    'borderTopWidth','borderRightWidth','borderBottomWidth','borderLeftWidth',
    'borderStyle','paddingTop','paddingRight','paddingBottom','paddingLeft',
    'fontStyle','fontVariant','fontWeight','fontStretch','fontSize','fontSizeAdjust',
    'lineHeight','fontFamily','textAlign','textTransform','textIndent','textDecoration',
    'letterSpacing','wordSpacing','tabSize','MozTabSize','whiteSpace','wordWrap'
  ];
  properties.forEach((p) => { div.style[p] = cs[p]; });
  div.style.position = 'absolute';
  div.style.visibility = 'hidden';
  div.style.whiteSpace = 'pre-wrap';
  div.style.wordWrap = 'break-word';
  div.style.top = '0';
  div.style.left = '-9999px';

  // 把游標位置之前的文字塞進去
  const pos = ta.selectionStart;
  const value = ta.value.substring(0, pos);
  // 處理結尾換行（避免最後一個 \n 被忽略高度）
  div.textContent = value;
  // 加一個 span 標記游標位置
  const span = document.createElement('span');
  span.textContent = ta.value.substring(pos) || '.';
  div.appendChild(span);

  document.body.appendChild(div);
  const spanRect = span.getBoundingClientRect();
  const taRect = ta.getBoundingClientRect();
  // span 在 div 內的相對位置 = 游標在 ta 內的相對位置
  // 但因為 div 是 absolute 在外面的，要算 div 內的 offset
  const divRect = div.getBoundingClientRect();
  const offsetTop = spanRect.top - divRect.top;
  const offsetLeft = spanRect.left - divRect.left;
  const lineHeight = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2;
  document.body.removeChild(div);

  return {
    top: taRect.top + offsetTop - ta.scrollTop,   // 游標所在行的「上緣」
    left: taRect.left + offsetLeft - ta.scrollLeft,
    lineHeight: lineHeight
  };
}

function positionAutoComplete() {
  if (!ac.popup) return;
  const taRect = editor.getBoundingClientRect();
  const caret = getTextareaCaretCoords(editor);
  const popupHeight = ac.popup.offsetHeight || 240;
  const popupWidth = ac.popup.offsetWidth || 280;
  const margin = 6;

  // 預計放在游標行下方
  let top = caret.top + caret.lineHeight + margin;
  let left = caret.left;

  // 如果下方放不下，改放上方
  if (top + popupHeight > window.innerHeight - 12) {
    top = caret.top - popupHeight - margin;
  }
  // 上方也放不下（極端情況），就強制放在可視範圍頂端
  if (top < 12) top = 12;

  // 左邊不要超出 textarea 範圍太多 / 不要超出視窗右邊
  if (left + popupWidth > window.innerWidth - 12) {
    left = window.innerWidth - popupWidth - 12;
  }
  if (left < taRect.left) left = taRect.left;
  if (left < 12) left = 12;

  // popup 是 fixed 定位，不需要加 scrollY/scrollX
  ac.popup.style.position = 'fixed';
  ac.popup.style.top = top + 'px';
  ac.popup.style.left = left + 'px';
}

function highlightMatch(label, query, matchType) {
  const isEn = matchType && matchType.startsWith('en');
  const safe = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  if (isEn) {
    if (label.startsWith('/')) {
      const lower = label.toLowerCase();
      const qLower = query.toLowerCase();
      const pos = lower.indexOf(qLower, 1);
      if (pos > 0) {
        return safe(label.slice(0, pos)) +
               '<span class="ac-match">' + safe(label.slice(pos, pos + query.length)) + '</span>' +
               safe(label.slice(pos + query.length));
      }
    }
    return safe(label);
  } else {
    if (label.startsWith('/')) {
      const pos = label.indexOf(query, 1);
      if (pos > 0) {
        return safe(label.slice(0, pos)) +
               '<span class="ac-match">' + safe(label.slice(pos, pos + query.length)) + '</span>' +
               safe(label.slice(pos + query.length));
      }
    }
    return safe(label);
  }
}

function updateSelected() {
  if (!ac.popup) return;
  ac.popup.querySelectorAll('.ac-item').forEach((el, i) => {
    el.classList.toggle('selected', i === ac.selectedIdx);
  });
  const sel = ac.popup.querySelector('.ac-item.selected');
  if (sel) sel.scrollIntoView({ block: 'nearest' });
}

function moveAutoComplete(delta) {
  if (!ac.popup || ac.items.length === 0) return;
  ac.selectedIdx = (ac.selectedIdx + delta + ac.items.length) % ac.items.length;
  updateSelected();
}

function acceptAutoComplete() {
  if (!ac.popup) return;
  const chosen = ac.items[ac.selectedIdx];
  if (!chosen) return;
  const text = editor.value;
  const before = text.slice(0, ac.matchStart);
  const after = text.slice(ac.matchEnd);
  const withMotion = state.motion;
  const insertion = chosen.cn + (withMotion ? ' motion' : '');
  editor.value = before + insertion + after;
  const newPos = before.length + insertion.length;
  closeAutoComplete();
  updateLineCount();
  editor.focus();
  editor.setSelectionRange(newPos, newPos);

  // 記錄「剛補完」狀態
  lastCompletion.active = true;
  lastCompletion.emoteEnd = before.length + chosen.cn.length;  // /擁抱 結尾
  lastCompletion.withMotion = withMotion;
  lastCompletion.motionEnd = withMotion ? newPos : -1;

  showToast(`已補全為 ${chosen.cn}${withMotion ? ' motion' : ''}`);
}

function closeAutoComplete() {
  if (ac.popup) { ac.popup.remove(); ac.popup = null; }
  ac.items = [];
  ac.selectedIdx = 0;
}

window.addEventListener('scroll', () => { if (ac.popup) positionAutoComplete(); }, true);
window.addEventListener('resize', () => { if (ac.popup) positionAutoComplete(); });

/* =================== 編輯器事件 =================== */
editor.addEventListener('input', () => {
  updateLineCount();
  // 任何輸入都讓「剛補完」狀態失效（除非是補完本身）
  if (!_skipNextInput) {
    clearLastCompletion();
    clearLastInherit();
  }
  _skipNextInput = false;
  const tok = detectEmoteToken();
  if (tok) showAutoComplete(tok);
  else closeAutoComplete();
});
editor.addEventListener('click', () => {
  clearLastCompletion();
  clearLastInherit();
  updateScopeIndicator();
  const tok = detectEmoteToken();
  if (tok) showAutoComplete(tok);
  else closeAutoComplete();
});
editor.addEventListener('keyup', (e) => {
  updateScopeIndicator();
  if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(e.key) && !ac.popup) {
    const tok = detectEmoteToken();
    if (tok) showAutoComplete(tok);
  }
});
editor.addEventListener('select', updateScopeIndicator);
editor.addEventListener('blur', () => {
  setTimeout(() => closeAutoComplete(), 150);
  clearLastCompletion();
  clearLastInherit();
});

let _skipNextInput = false;

editor.addEventListener('keydown', (e) => {
  // popup 開啟時優先處理
  if (ac.popup) {
    if (e.key === 'ArrowDown') { e.preventDefault(); moveAutoComplete(1); return; }
    if (e.key === 'ArrowUp')   { e.preventDefault(); moveAutoComplete(-1); return; }
    if (e.key === 'Tab' || e.key === 'Enter') {
      e.preventDefault();
      acceptAutoComplete();
      _skipNextInput = true;
      return;
    }
    if (e.key === 'Escape')    { e.preventDefault(); closeAutoComplete(); return; }
  }

  // 「剛換行繼承」狀態下的 Backspace：一次刪整個前綴
  if (lastInherit.active &&
      e.key === 'Backspace' &&
      !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
    const pos = editor.selectionStart;
    const sel = editor.selectionEnd;
    if (pos === sel && pos === lastInherit.prefixEnd) {
      e.preventDefault();
      const text = editor.value;
      const before = text.slice(0, lastInherit.prefixStart);
      const after = text.slice(lastInherit.prefixEnd);
      editor.value = before + after;
      editor.setSelectionRange(lastInherit.prefixStart, lastInherit.prefixStart);
      clearLastInherit();
      _skipNextInput = true;
      updateLineCount();
      showToast('已刪除繼承的頻道前綴');
      return;
    }
  }

  // Enter 換行繼承頻道（在行末或行中按 Enter 都繼承）
  if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
    const pos = editor.selectionStart;
    const sel = editor.selectionEnd;
    if (pos === sel) {
      // 找出當前游標所在行的內容
      const text = editor.value;
      // 當前行起始位置 = 上一個 \n + 1（或 0）
      const lineStart = text.lastIndexOf('\n', pos - 1) + 1;
      const currentLineToCursor = text.slice(lineStart, pos);
      // 偵測該行開頭是否有「已知頻道前綴」
      const m = currentLineToCursor.match(CHANNEL_PREFIX_RE);
      if (m) {
        // 有頻道 → 換行後繼承「頻道 + 空格」
        e.preventDefault();
        const channelPrefix = m[0] + ' ';
        const before = text.slice(0, pos);
        const after = text.slice(sel);
        const insertion = '\n' + channelPrefix;
        editor.value = before + insertion + after;
        const newPos = pos + insertion.length;
        editor.setSelectionRange(newPos, newPos);

        // 設定 lastInherit 狀態，讓接下來一次 Backspace 可整個刪
        lastInherit.active = true;
        lastInherit.prefixStart = pos + 1;  // \n 之後
        lastInherit.prefixEnd = newPos;     // 前綴 + 空格的結尾

        clearLastCompletion();
        _skipNextInput = true;
        updateLineCount();
        return;
      }
    }
  }

  // 「剛補完」狀態下的特殊鍵
  if (lastCompletion.active) {
    const pos = editor.selectionStart;
    const sel = editor.selectionEnd;

    // Tab：加 motion（如果還沒加）
    if (e.key === 'Tab' && !e.shiftKey) {
      // 游標必須在 emoteEnd（剛補完的位置）才觸發
      if (pos === sel && pos === lastCompletion.emoteEnd && !lastCompletion.withMotion) {
        e.preventDefault();
        const text = editor.value;
        const before = text.slice(0, lastCompletion.emoteEnd);
        const after = text.slice(lastCompletion.emoteEnd);
        const insertion = ' motion';
        editor.value = before + insertion + after;
        const newPos = lastCompletion.emoteEnd + insertion.length;
        editor.setSelectionRange(newPos, newPos);
        // 更新狀態（仍處於「剛補完」狀態，但已加 motion）
        lastCompletion.withMotion = true;
        lastCompletion.motionEnd = newPos;
        _skipNextInput = true;
        updateLineCount();
        showToast('已加上 motion');
        return;
      }
    }

    // Backspace：當游標在 motion 結尾、有 motion 時，整個 ' motion' 一次刪掉
    if (e.key === 'Backspace' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      if (pos === sel && lastCompletion.withMotion && pos === lastCompletion.motionEnd) {
        e.preventDefault();
        const text = editor.value;
        const before = text.slice(0, lastCompletion.emoteEnd);
        const after = text.slice(lastCompletion.motionEnd);
        editor.value = before + after;
        const newPos = lastCompletion.emoteEnd;
        editor.setSelectionRange(newPos, newPos);
        // 更新狀態（仍是「剛補完」但沒 motion）
        lastCompletion.withMotion = false;
        lastCompletion.motionEnd = -1;
        _skipNextInput = true;
        updateLineCount();
        showToast('已移除 motion');
        return;
      }
    }

    // Delete：當游標在 emote 結尾且有 motion 時，整個 ' motion' 一次刪掉
    if (e.key === 'Delete' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      if (pos === sel && lastCompletion.withMotion && pos === lastCompletion.emoteEnd) {
        e.preventDefault();
        const text = editor.value;
        const before = text.slice(0, lastCompletion.emoteEnd);
        const after = text.slice(lastCompletion.motionEnd);
        editor.value = before + after;
        editor.setSelectionRange(lastCompletion.emoteEnd, lastCompletion.emoteEnd);
        lastCompletion.withMotion = false;
        lastCompletion.motionEnd = -1;
        _skipNextInput = true;
        updateLineCount();
        showToast('已移除 motion');
        return;
      }
    }

    // 其他按鍵：解除「剛補完」狀態
    if (e.key !== 'Shift' && e.key !== 'Control' && e.key !== 'Alt' && e.key !== 'Meta') {
      clearLastCompletion();
    }
  }

  // 任何不是「修飾鍵 / 方向鍵 / Backspace」的鍵 → 解除 lastInherit 狀態
  // （讓使用者開始打字後，Backspace 就只刪一個字而不是整個前綴）
  if (lastInherit.active) {
    if (e.key !== 'Shift' && e.key !== 'Control' && e.key !== 'Alt' && e.key !== 'Meta' &&
        e.key !== 'Backspace') {
      // 任何方向鍵或打字都會清除狀態
      clearLastInherit();
    }
  }

  // Tab 加 wait（行末，非劇內、無 popup、未選取）
  // 也處理 t + Tab → <t>
  if (e.key === 'Tab' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
    const pos = editor.selectionStart;
    const sel = editor.selectionEnd;
    if (pos === sel) {
      // 一律阻止 Tab 預設行為（避免失焦）
      e.preventDefault();
      const text = editor.value;

      // 優先處理：t + Tab → <t>
      // 條件：游標前一字元是 't'，且 't' 之前不是英文字母（避免 it、at、bot 誤觸）
      if (pos > 0 && text[pos - 1] === 't') {
        const beforeT = pos >= 2 ? text[pos - 2] : '';
        const isStandaloneT = (pos === 1) || /[\s\n>]/.test(beforeT) || beforeT === '';
        if (isStandaloneT) {
          // 把 't' 換成 '<t>'
          const before = text.slice(0, pos - 1);
          const after = text.slice(pos);
          const insertion = '<t>';
          editor.value = before + insertion + after;
          const newPos = (pos - 1) + insertion.length;
          editor.setSelectionRange(newPos, newPos);
          clearLastCompletion();
          clearLastInherit();
          _skipNextInput = true;
          updateLineCount();
          showToast('已插入 <t>');
          return;
        }
      }

      // 否則：檢查是否處於「行末」(下一個字元為換行或文字結尾)
      const isLineEnd = (pos === text.length) || (text[pos] === '\n');
      if (!isLineEnd) {
        // 不是行末 — 什麼都不做
        return;
      }
      // 找出當前行的內容
      const lineStart = text.lastIndexOf('\n', pos - 1) + 1;
      const currentLine = text.slice(lineStart, pos);
      // 行內容非空才加（避免空白行加 wait）
      if (currentLine.trim() === '') {
        return;
      }
      // 防呆：倒數行已有 <wait.1>，不再加
      if (isCountdownLine(currentLine)) {
        showToast('倒數行已有 <wait.1>', true);
        return;
      }
      const secs = state.waitValue || '2';
      const insertion = ' <wait.' + secs + '>';
      const before = text.slice(0, pos);
      const after = text.slice(pos);
      editor.value = before + insertion + after;
      const newPos = pos + insertion.length;
      editor.setSelectionRange(newPos, newPos);

      clearLastCompletion();
      clearLastInherit();
      _skipNextInput = true;
      updateLineCount();
      showToast(`已加上 <wait.${secs}>`);
      return;
    }
  }
});

/* 滑鼠拖曳選取後也要更新 scope */
editor.addEventListener('mouseup', () => {
  updateScopeIndicator();
  clearLastCompletion();
  clearLastInherit();
});

/* =================== Toast =================== */
let toastTimer = null;
function showToast(msg, isError = false) {
  toast.textContent = msg;
  toast.style.borderColor = isError ? '#ff7a9c' : 'var(--aether-blue)';
  toast.style.color = isError ? '#ff7a9c' : 'var(--aether-blue)';
  toast.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
}

/* =================== 啟動 =================== */
/* =================== UI 大小切換 =================== */
function applyUiScale(scale) {
  const html = document.documentElement;
  html.classList.remove('ui-large', 'ui-xlarge');
  if (scale === 'large') html.classList.add('ui-large');
  else if (scale === 'xlarge') html.classList.add('ui-xlarge');
  // 更新按鈕狀態
  document.querySelectorAll('.ui-scale-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.scale === scale);
  });
  try {
    localStorage.setItem('uiScale', scale);
  } catch {}
}

document.querySelectorAll('.ui-scale-btn').forEach((b) => {
  b.onclick = () => {
    applyUiScale(b.dataset.scale);
  };
});

/* =================== 小工具系統 =================== */
// 每個小工具：name 顯示名、desc 說明、template 用 {0} {1} ... 對應 fields 順序、fields 欄位定義
const MINI_TOOLS = [
  {
    id: 'gs-change',
    name: '一鍵換裝',
    desc: '切換指定編號的套裝；可選擇套用投影範本。',
    template: '/gs change {0}{1}',  // {0} 套裝編號 {1} 投影範本（含前置空格的整段）
    fields: [
      { key: 'gearset', label: '套裝編號', required: true, placeholder: '1~30', type: 'number' },
      { key: 'glamour', label: '投影範本編號', required: false, placeholder: '選填，1~20', type: 'number', prefix: ' ' }
    ]
  },
  {
    id: 'roleplaying',
    name: '角色扮演中',
    desc: '切換角色扮演狀態（顯示在角色名稱下方）。留空則依當前狀態切換。',
    template: '/roleplaying{0}',
    fields: [
      { key: 'mode', label: '模式', required: false, type: 'select', options: [
        { value: '', label: '切換（依當前狀態）' },
        { value: 'on', label: '開啟 (on)' },
        { value: 'off', label: '關閉 (off)' }
      ], prefix: ' ' }
    ]
  },
  {
    id: 'lookingforparty',
    name: '希望組隊',
    desc: '切換「希望組隊」狀態。留空則依當前狀態切換。',
    template: '/lookingforparty{0}',
    fields: [
      { key: 'mode', label: '模式', required: false, type: 'select', options: [
        { value: '', label: '切換（依當前狀態）' },
        { value: 'on', label: '開啟 (on)' },
        { value: 'off', label: '關閉 (off)' }
      ], prefix: ' ' }
    ]
  },
  {
    id: 'lookingformeld',
    name: '接受鑲嵌魔晶石請求',
    desc: '切換「接受鑲嵌魔晶石請求」狀態。留空則依當前狀態切換。',
    template: '/lookingformeld{0}',
    fields: [
      { key: 'mode', label: '模式', required: false, type: 'select', options: [
        { value: '', label: '切換（依當前狀態）' },
        { value: 'on', label: '開啟 (on)' },
        { value: 'off', label: '關閉 (off)' }
      ], prefix: ' ' }
    ]
  },
  {
    id: 'countdown',
    name: '倒數秒數',
    desc: '產生倒數行（如 5 4 3 2 1），每行附帶 <wait.1>；可選音效（每行末加 <se.X>）。',
    fields: [
      { key: 'secs', label: '從幾秒倒數', required: true, placeholder: '例：3 或 5', type: 'number' },
      { key: 'se', label: '音效', required: false, type: 'select', options: [
        { value: '', label: '無音效' },
        { value: '1', label: '<se.1>' },
        { value: '2', label: '<se.2>' },
        { value: '3', label: '<se.3>' },
        { value: '4', label: '<se.4>' },
        { value: '5', label: '<se.5>' },
        { value: '6', label: '<se.6>' },
        { value: '7', label: '<se.7>' },
        { value: '8', label: '<se.8>' },
        { value: '9', label: '<se.9>' },
        { value: '10', label: '<se.10>' },
        { value: '11', label: '<se.11>' },
        { value: '12', label: '<se.12>' },
        { value: '13', label: '<se.13>' },
        { value: '14', label: '<se.14>' },
        { value: '15', label: '<se.15>' },
        { value: '16', label: '<se.16>' }
      ]}
    ],
    customSubmit: (inputs) => {
      const raw = (inputs.secs.value || '').trim();
      const n = parseInt(raw, 10);
      if (!n || n < 1) {
        showToast('請輸入大於 0 的整數', true);
        return;
      }
      if (n > 30) {
        showToast('倒數秒數不能超過 30', true);
        return;
      }
      const seVal = (inputs.se.value || '').trim();
      const seSegment = seVal ? ` <se.${seVal}>` : '';
      // 產生 n, n-1, ..., 1 每行加 <se.X> <wait.1>（wait 永遠在最後）
      const lines = [];
      for (let i = n; i >= 1; i--) {
        lines.push(`${i}${seSegment} <wait.1>`);
      }
      const block = lines.join('\n');
      const cur = editor.value;
      let prefix = '';
      if (cur.length > 0 && !cur.endsWith('\n')) prefix = '\n';
      editor.value = cur + prefix + block;
      updateLineCount();
      editor.focus();
      const pos = editor.value.length;
      editor.setSelectionRange(pos, pos);
      showToast(`已新增 ${n} 行倒數${seVal ? ` (含 <se.${seVal}>)` : ''}`);
    }
  }
];

const miniToolsGrid = $('miniToolsGrid');
const miniToolForm = $('miniToolForm');
let activeMiniTool = null;

function renderMiniTools() {
  miniToolsGrid.innerHTML = '';
  MINI_TOOLS.forEach((tool) => {
    const btn = document.createElement('button');
    btn.className = 'mini-tool-btn';
    btn.textContent = tool.name;
    btn.dataset.id = tool.id;
    btn.onclick = () => openMiniTool(tool.id);
    miniToolsGrid.appendChild(btn);
  });
}

function openMiniTool(id) {
  if (activeMiniTool === id) {
    closeMiniTool();
    return;
  }
  activeMiniTool = id;
  const tool = MINI_TOOLS.find((t) => t.id === id);
  if (!tool) return;

  // 標記按鈕 active
  document.querySelectorAll('.mini-tool-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.id === id);
  });

  // 渲染表單
  miniToolForm.innerHTML = '';
  miniToolForm.classList.add('active');

  const title = document.createElement('div');
  title.className = 'mini-tool-form-title';
  title.textContent = tool.name;
  miniToolForm.appendChild(title);

  if (tool.desc) {
    const desc = document.createElement('div');
    desc.className = 'mini-tool-form-desc';
    desc.textContent = tool.desc;
    miniToolForm.appendChild(desc);
  }

  const fieldsRow = document.createElement('div');
  fieldsRow.className = 'mini-tool-fields';
  miniToolForm.appendChild(fieldsRow);

  const inputs = {};
  tool.fields.forEach((f) => {
    const wrap = document.createElement('div');
    wrap.className = 'mini-tool-field';
    const lbl = document.createElement('label');
    lbl.className = 'mini-tool-field-label';
    lbl.innerHTML = f.label + (f.required ? '<span class="required">*</span>' : '');
    wrap.appendChild(lbl);

    let inp;
    if (f.type === 'select') {
      inp = document.createElement('select');
      f.options.forEach((opt) => {
        const o = document.createElement('option');
        o.value = opt.value;
        o.textContent = opt.label;
        inp.appendChild(o);
      });
    } else {
      inp = document.createElement('input');
      inp.type = f.type === 'number' ? 'number' : 'text';
      if (f.placeholder) inp.placeholder = f.placeholder;
    }
    inp.dataset.key = f.key;
    inp.addEventListener('input', updatePreview);
    inp.addEventListener('change', updatePreview);
    wrap.appendChild(inp);
    fieldsRow.appendChild(wrap);
    inputs[f.key] = inp;
  });

  // 輸入按鈕
  const submit = document.createElement('button');
  submit.className = 'mini-tool-submit';
  submit.textContent = '↳ 輸入';
  submit.onclick = () => submitMiniTool(tool, inputs);
  fieldsRow.appendChild(submit);

  // 預覽區
  const preview = document.createElement('div');
  preview.className = 'mini-tool-preview';
  preview.id = 'miniToolPreview';
  preview.innerHTML = '<span class="mini-tool-preview-empty">填寫欄位後此處會顯示輸出預覽…</span>';
  miniToolForm.appendChild(preview);

  // 自動聚焦第一個欄位
  const firstInp = fieldsRow.querySelector('input, select');
  if (firstInp) firstInp.focus();

  function updatePreview() {
    const result = buildMiniToolOutput(tool, inputs);
    if (result) {
      preview.innerHTML = '';
      preview.textContent = result;
    } else {
      preview.innerHTML = '<span class="mini-tool-preview-empty">填寫必填欄位後此處會顯示輸出預覽…</span>';
    }
  }
}

function closeMiniTool() {
  activeMiniTool = null;
  miniToolForm.classList.remove('active');
  miniToolForm.innerHTML = '';
  document.querySelectorAll('.mini-tool-btn').forEach((b) => b.classList.remove('active'));
}

function buildMiniToolOutput(tool, inputs) {
  // 檢查必填
  for (const f of tool.fields) {
    const val = (inputs[f.key].value || '').trim();
    if (f.required && !val) return null;
  }
  // 用 template 組合
  let output = tool.template;
  tool.fields.forEach((f, idx) => {
    const val = (inputs[f.key].value || '').trim();
    let replacement = '';
    if (val) {
      replacement = (f.prefix || '') + val + (f.suffix || '');
    }
    output = output.split('{' + idx + '}').join(replacement);
  });
  return output;
}

function submitMiniTool(tool, inputs) {
  // 自訂提交函數（可覆蓋預設行為，用於多行/特殊邏輯的工具）
  if (typeof tool.customSubmit === 'function') {
    tool.customSubmit(inputs);
    return;
  }

  const result = buildMiniToolOutput(tool, inputs);
  if (!result) {
    showToast('請填寫必填欄位', true);
    return;
  }

  if (tool.insertMode === 'cursor') {
    // 在游標處插入
    insertAtCursor(result);
    showToast(`已插入：${result}`);
  } else {
    // 新增一行
    appendNewLine(result);
    showToast(`已新增：${result}`);
  }
}

renderMiniTools();

/* =================== 自訂圖標 /micon =================== */
const miconCheck = $('miconCheck');
const miconName = $('miconName');
const miconType = $('miconType');
const miconToggle = document.querySelector('.micon-toggle');

const MICON_LINE_RE = /^\/micon\b[^\n]*/;

function buildMiconLine() {
  const name = (miconName.value || '').trim();
  const type = miconType.value || '';
  // 必須名稱與類型都填才產生
  if (!name || !type) return '';
  return `/micon ${name} ${type}`;
}

function updateMiconLine() {
  const text = editor.value;
  const lines = text.split('\n');
  const hasMicon = lines.length > 0 && MICON_LINE_RE.test(lines[0]);

  if (miconCheck.checked) {
    const newLine = buildMiconLine();
    if (!newLine) {
      // 勾選但名稱為空 — 如果原本有 /micon 行，保留之前的（不清掉）；否則不加
      if (hasMicon) {
        // 名稱被清空時，把 /micon 那行的內容清成空白也許好？保留為「/micon」一個前綴
        // 為了直覺，如果名稱是空的就移除整行
        lines.shift();
        editor.value = lines.join('\n');
        updateLineCount();
      }
      return;
    }
    if (hasMicon) {
      // 替換第一行
      lines[0] = newLine;
    } else {
      // 在最前插入
      lines.unshift(newLine);
    }
    editor.value = lines.join('\n');
  } else {
    // 取消勾選 → 移除第一行的 /micon
    if (hasMicon) {
      lines.shift();
      editor.value = lines.join('\n');
    }
  }
  updateLineCount();
}

miconCheck.addEventListener('change', () => {
  miconName.disabled = !miconCheck.checked;
  miconType.disabled = !miconCheck.checked;
  miconToggle.classList.toggle('checked', miconCheck.checked);
  if (miconCheck.checked) {
    miconName.focus();
  }
  updateMiconLine();
});

miconName.addEventListener('input', updateMiconLine);
miconType.addEventListener('change', updateMiconLine);

function init() {
  renderChannels();
  renderCatTabs();
  renderEmotes();
  highlightActiveSec();
  updateSecLabels();
  updateLineCount();
  updateScopeIndicator();

  // 還原 UI 大小設定
  try {
    const saved = localStorage.getItem('uiScale');
    if (saved && ['default', 'large', 'xlarge'].includes(saved)) {
      applyUiScale(saved);
    }
  } catch {}
}
init();