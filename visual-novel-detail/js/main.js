// js/main.js — 模組化入口(拆檔重構進行中)
//
// 載入架構(過渡期):
//   index.html 先放本 module(deferred),再放 <script defer src="index.js">(classic)。
//   依 HTML 規範,延遲腳本依文件順序執行 → 本檔先跑、index.js 後跑。
//
//   本檔用 static import 把已搬出的模組載入並 Object.assign 到 window;
//   等 index.js(classic)執行時,這些東西已在 window 上可取用;
//   而 index.js 自身仍是 classic 腳本,頂層 function 仍是全域,
//   因此「已搬出的模組」也能回頭呼叫尚未搬遷的 index.js 函式(雙向 bridge)。
//
//   模組彼此相依(例如 state.js 用到 constants)一律用「真正的 import」解決,
//   不依賴 window;window 掛載只是給尚未搬遷的 index.js 用的過渡手段(3-I 移除)。

import * as Constants from "./shared/constants.js";
import * as Regex from "./shared/regex.js";
import * as State from "./shared/state.js";
import * as Elements from "./shared/elements.js";
import * as StorageLocal from "./shared/storage-local.js";
import * as StorageIndexedDB from "./shared/storage-indexeddb.js";
import * as DetailParser from "./detail/parser.js";
import * as DetailStage from "./detail/stage.js";
import * as DetailRenderer from "./detail/renderer.js";
import * as DetailPreview from "./detail/preview.js";
import * as DetailEditor from "./detail/editor.js";
import * as CanvasRenderer from "./shared/canvas-renderer.js";
import * as CgLibraryModal from "./modals/cg-library.js";
import * as ExportImport from "./modals/export-import.js";
import * as AssetsModal from "./modals/assets.js";
import * as StateSimple from "./simple/state-simple.js";
import * as ParserSimple from "./simple/parser-simple.js";
import * as SlideList from "./simple/slide-list.js";
import * as ChoiceScene from "./simple/choice-scene.js";
import * as EditorSimple from "./simple/editor-simple.js";
import * as PreviewSimple from "./simple/preview-simple.js";
import * as SimpleOutput from "./simple/output.js";
import * as Toast from "./shared/toast.js";
import * as ModalHelpers from "./shared/modal-helpers.js";
import * as Utils from "./shared/utils.js";
import * as Theme from "./shared/theme.js";
import * as ProjectsModal from "./modals/projects.js";
import * as SettingsModal from "./modals/settings.js";
import * as DialogStyle from "./shared/dialog-style.js";
import * as FontSystem from "./shared/font-system.js";
import * as SimpleMode from "./simple/mode.js";
import * as DetailRecording from "./detail/recording.js";
import * as SimpleCards from "./simple/cards.js";
import * as GameUI from "./shared/game-ui.js";
import * as StatusBar from "./shared/status-bar.js";
import * as PortraitFramer from "./modals/portrait-framer.js";

Object.assign(window, Constants, Regex, State, Elements, StorageLocal, StorageIndexedDB, DetailParser, DetailStage, DetailRenderer, DetailPreview, DetailEditor, CanvasRenderer, CgLibraryModal, ExportImport, AssetsModal, StateSimple, ParserSimple, SlideList, ChoiceScene, EditorSimple, PreviewSimple, SimpleOutput, Toast, ModalHelpers, Utils, Theme, ProjectsModal, SettingsModal, DialogStyle, FontSystem, SimpleMode, DetailRecording, SimpleCards, GameUI, StatusBar, PortraitFramer);
