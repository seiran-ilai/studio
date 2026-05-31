// js/main.js — 模組化入口(簡易版)
//
// 載入架構:
//   index.html 先放本 module(deferred),再放 <script defer src="index.js">(classic)。
//   依 HTML 規範,延遲腳本依文件順序執行 → 本檔先跑、index.js 後跑。
//   本檔用 static import 把模組載入並 Object.assign 到 window;
//   index.js(classic)執行時這些東西已在 window 上可取用(過渡 bridge)。
//
//   詳細版已物理移除(參考保留在 ../visual-novel-detail/),本站只含簡易版 + 共用層。

import * as Constants from "./shared/constants.js";
import * as Regex from "./shared/regex.js";
import * as State from "./shared/state.js";
import * as Elements from "./shared/elements.js";
import * as StorageLocal from "./shared/storage-local.js";
import * as StorageIndexedDB from "./shared/storage-indexeddb.js";
import * as Parser from "./shared/parser.js";
import * as CanvasRenderer from "./shared/canvas-renderer.js";
import * as CgLibraryModal from "./modals/cg-library.js";
import * as ExportImport from "./modals/export-import.js";
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
import * as SimpleCards from "./simple/cards.js";
import * as Effects from "./simple/effects.js";
import * as GameUI from "./shared/game-ui.js";
import * as StatusBar from "./shared/status-bar.js";

Object.assign(window, Constants, Regex, State, Elements, StorageLocal, StorageIndexedDB, Parser, CanvasRenderer, CgLibraryModal, ExportImport, StateSimple, ParserSimple, SlideList, ChoiceScene, EditorSimple, PreviewSimple, SimpleOutput, Toast, ModalHelpers, Utils, Theme, ProjectsModal, SettingsModal, DialogStyle, FontSystem, SimpleMode, SimpleCards, Effects, GameUI, StatusBar);
