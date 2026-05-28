# Studio Workspace

這個資料夾包含多個獨立的純前端小工具專案。每個專案三個檔案一組,共用相同的工作風格。

## 專案結構規則

每個工具放在自己的 kebab-case 資料夾,內部固定三個檔案:
- `{tool}/index.html` — 結構
- `{tool}/index.css` — 樣式
- `{tool}/index.js` — 邏輯

目前的工具:
- `visual-novel/` — Visual Novel Studio:視覺小說劇本編輯 + 預覽 + 截圖 + 錄影
- `glitch/` — Glitch Studio:圖片/影片故障特效
- `macro/` — RP Macro Studio:FF14 角扮巨集編輯器

`studio/index.html` 是總入口頁,展示三張工具卡片。
`studio/{otome-studio,glitch_studio,RP_marco}.html` 是舊路徑的 meta-refresh redirect,
讓舊收藏的連結還能跳轉到新位置。

## 共通技術棧

- 純 HTML + CSS + 原生 JS,**不用任何框架**(no React / Vue / Svelte)
- **不需要 build tool**(no webpack / vite / parcel / esbuild)
- **不需要 npm / package.json**(除非專案本身已經有)
- 不需要 TypeScript,純 JS
- 使用瀏覽器原生 API(Canvas、MediaRecorder、FileReader、localStorage、fetch 等)
- 外部依賴只透過 CDN `<script>` 載入,避免本地 node_modules

## 檔案組織規則

**重要:不要拆檔。**
- HTML 裡只放 `<link rel="stylesheet">` 和 `<script>` 引用同名 .css / .js
- 不要建立 `js/utils.js`、`css/components.css` 之類的子資料夾結構
- 不要把 JS 拆成 module 檔案
- 所有邏輯放在 `{name}.js` 一個檔
- 所有樣式放在 `{name}.css` 一個檔

## 程式碼風格

**JavaScript:**
- 縮排 2 空格
- 字串用雙引號
- 函式命名:駝峰式(camelCase)
- 常數命名:UPPER_SNAKE_CASE
- 用 `const` / `let`,不要 `var`
- 用 `===`,不要 `==`
- function declaration > arrow,除非要 lexical `this`
- 中文註解 OK,程式碼識別字用英文

**CSS:**
- 縮排 2 空格
- CSS 變數命名:kebab-case(`--gold-bright`)
- 集中在檔案頂部 `:root { }` 定義 design tokens
- BEM 風格的 class 命名(`.card`、`.card-header`、`.card--active`)
- 用 CSS variables 統一顏色和間距,不要散落 hex 值

**HTML:**
- 縮排 2 空格
- 屬性用雙引號
- self-closing 不加斜線(`<br>` not `<br/>`)
- `lang="zh-TW"`、`<meta charset="UTF-8">` 永遠都要

## 不要做的事

- ❌ 不要加 build pipeline、bundler、transpiler
- ❌ 不要拆成多個 .js / .css 檔
- ❌ 不要引入 framework
- ❌ 不要加 server-side 程式碼
- ❌ 不要 npm install 任何東西
- ❌ 不要動到其他專案的檔案(改 `otome-studio.*` 時不要碰 `glitch_studio.*`)
- ❌ 不要建立 README.md、LICENSE、.gitignore 等專案管理檔(除非我要求)

## 測試方式

- 沒有自動化 test,直接瀏覽器開 .html 檔測試
- 不要建議我加 jest / vitest / playwright
- 不要建議我跑 lint(沒裝 eslint)

## 工作方式偏好

**速度優先,我已開 auto-accept:**
- 不需要每步停下來請求確認
- 不需要每改一個函式就 view 整個檔案重讀
- 一次做完一個完整功能再給我看結果
- 假設你已知檔案狀態,不要重複 view 同一個檔案
- 不需要跑 test,不需要 commit,我會自己處理

**規劃方式:**
- 大改動(動超過 50 行 / 跨檔案 / 改架構)前,先用 2-3 句話講你打算怎麼做,我說 OK 才開始
- 小改動(改一個 function / 加一個 feature)直接動手
- 遇到設計選擇做合理 default,在訊息結尾告訴我做了什麼選擇

**溝通方式:**
- 中文回應
- 簡潔,不要過度解釋
- 改完給我 summary:改了什麼、為什麼、副作用是什麼
- 不要在訊息裡貼大段程式碼(已經在檔案裡了)
- 有不確定的選擇用一兩句問,不要一次列五個問題

## 視覺風格偏好

我做的工具都偏暗色、有質感、帶點 atmosphere。除非專案另有指示:
- 暗色背景,不要純白
- 用 CSS variables 定義一組 design tokens
- 字體中文 PingFang TC / Noto Sans TC,英文 serif 加質感時用
- 動畫要有意義,不要亂加(避免轉場 for 轉場)
- 互動要有 hover / active 回饋