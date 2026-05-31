// shared/modal-helpers.js — 由 index.js 搬出(階段 3-H),內容未改動

function _imodalEsc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function _openInlineModal(buildBody, onKeydown) {
  const back = document.createElement("div");
  back.className = "inline-modal-backdrop show";
  const wrap = document.createElement("div");
  wrap.className = "inline-modal";
  back.appendChild(wrap);
  buildBody(wrap);
  document.body.appendChild(back);
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    back.remove();
    document.removeEventListener("keydown", keyHandler, true);
  };
  const keyHandler = (e) => {
    if (closed) return;
    onKeydown && onKeydown(e, close);
  };
  document.addEventListener("keydown", keyHandler, true);
  return { back, wrap, close };
}

function inlineConfirm({ title = "確認", message = "", okText = "確認", cancelText = "取消", danger = false, hideCancel = false } = {}) {
  return new Promise((resolve) => {
    const handle = _openInlineModal((wrap) => {
      wrap.innerHTML = `
        <div class="inline-modal-title${danger ? " danger" : ""}">${_imodalEsc(title)}</div>
        ${message ? `<div class="inline-modal-body">${typeof message === "string" ? _imodalEsc(message) : ""}</div>` : ""}
        <div class="inline-modal-footer">
          ${hideCancel ? "" : `<button class="btn btn-ghost" data-act="cancel">${_imodalEsc(cancelText)}</button>`}
          <button class="btn ${danger ? "btn-danger" : "btn-primary"}" data-act="ok">${_imodalEsc(okText)}</button>
        </div>
      `;
      // Allow message to be HTML when explicitly passed as { __html: ... }
      if (message && typeof message === "object" && message.__html) {
        wrap.querySelector(".inline-modal-body").innerHTML = message.__html;
      }
    }, (e, close) => {
      if (e.key === "Escape") { e.preventDefault(); close(); resolve(false); }
      else if (e.key === "Enter") { e.preventDefault(); close(); resolve(true); }
    });
    handle.back.addEventListener("click", (e) => {
      if (e.target === handle.back) { handle.close(); resolve(false); return; }
      const btn = e.target.closest("button[data-act]");
      if (!btn) return;
      handle.close();
      resolve(btn.dataset.act === "ok");
    });
    requestAnimationFrame(() => {
      const ok = handle.wrap.querySelector('button[data-act="ok"]');
      if (ok) ok.focus();
    });
  });
}

function inlinePrompt({
  title = "輸入", message = "", defaultValue = "", placeholder = "",
  okText = "確認", cancelText = "取消",
  validate = null,  // (value) => string | null  (return error message to block)
} = {}) {
  return new Promise((resolve) => {
    const handle = _openInlineModal((wrap) => {
      wrap.innerHTML = `
        <div class="inline-modal-title">${_imodalEsc(title)}</div>
        ${message ? `<div class="inline-modal-body">${_imodalEsc(message)}</div>` : ""}
        <input type="text" class="inline-modal-input" placeholder="${_imodalEsc(placeholder)}" value="${_imodalEsc(defaultValue)}">
        <div class="inline-modal-body" data-error style="color:var(--danger);font-size:12px;margin-bottom:8px;display:none;"></div>
        <div class="inline-modal-footer">
          <button class="btn btn-ghost" data-act="cancel">${_imodalEsc(cancelText)}</button>
          <button class="btn btn-primary" data-act="ok">${_imodalEsc(okText)}</button>
        </div>
      `;
    }, (e, close) => {
      if (e.key === "Escape") { e.preventDefault(); close(); resolve(null); }
    });
    const input = handle.wrap.querySelector(".inline-modal-input");
    const errBox = handle.wrap.querySelector("[data-error]");
    const submit = () => {
      const v = (input.value || "").trim();
      if (validate) {
        const err = validate(v);
        if (err) {
          errBox.textContent = err;
          errBox.style.display = "block";
          input.classList.add("error");
          input.focus();
          input.select();
          return;
        }
      }
      handle.close();
      resolve(v);
    };
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); submit(); }
    });
    handle.back.addEventListener("click", (e) => {
      if (e.target === handle.back) { handle.close(); resolve(null); return; }
      const btn = e.target.closest("button[data-act]");
      if (!btn) return;
      if (btn.dataset.act === "ok") submit();
      else { handle.close(); resolve(null); }
    });
    requestAnimationFrame(() => { input.focus(); input.select(); });
  });
}

function inlineChoose({ title, message = "", options = [], cancelText = "取消" } = {}) {
  return new Promise((resolve) => {
    const handle = _openInlineModal((wrap) => {
      const optsHtml = options.map(o =>
        `<button class="inline-modal-choice${o.danger ? " danger" : ""}" data-key="${_imodalEsc(o.key)}">
           <strong>${_imodalEsc(o.label)}</strong>${o.desc ? _imodalEsc(o.desc) : ""}
         </button>`
      ).join("");
      wrap.innerHTML = `
        <div class="inline-modal-title">${_imodalEsc(title)}</div>
        ${message ? `<div class="inline-modal-body">${_imodalEsc(message)}</div>` : ""}
        <div class="inline-modal-choices">${optsHtml}</div>
        <div class="inline-modal-footer">
          <button class="btn btn-ghost" data-act="cancel">${_imodalEsc(cancelText)}</button>
        </div>
      `;
    }, (e, close) => {
      if (e.key === "Escape") { e.preventDefault(); close(); resolve(null); }
    });
    handle.back.addEventListener("click", (e) => {
      if (e.target === handle.back) { handle.close(); resolve(null); return; }
      const choice = e.target.closest(".inline-modal-choice");
      if (choice) { handle.close(); resolve(choice.dataset.key); return; }
      const cancel = e.target.closest('button[data-act="cancel"]');
      if (cancel) { handle.close(); resolve(null); }
    });
  });
}

export {
  _imodalEsc,
  _openInlineModal,
  inlineConfirm,
  inlinePrompt,
  inlineChoose,
};
