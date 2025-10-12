// js/admin-ui.js

// --- allowlist для расширений файлов ---
const ALLOWED_EXTENSIONS = [
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  "mp4",
  "webm",
  "mov",
  "avi",
  "mkv",
];

// ===== Toasts =====
function showToast(
  message,
  type = "info",
  actionLabel = null,
  actionFn = null,
  autoHide = true
) {
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;

  const msg = document.createElement("span");
  msg.textContent = message;
  toast.appendChild(msg);

  if (actionLabel && actionFn) {
    const btn = document.createElement("button");
    btn.textContent = actionLabel;
    btn.style.marginLeft = "12px";
    btn.style.background = "transparent";
    btn.style.border = "1px solid #fff";
    btn.style.color = "#fff";
    btn.style.padding = "4px 8px";
    btn.style.borderRadius = "4px";
    btn.style.cursor = "pointer";
    btn.addEventListener("click", () => {
      actionFn();
      toast.remove();
    });
    toast.appendChild(btn);
  }

  // крестик (если не отключён авто-скрытие или есть action)
  if ((actionLabel && actionFn) || autoHide !== false) {
    const closeBtn = document.createElement("button");
    closeBtn.textContent = "×";
    closeBtn.className = "toast-close-btn";
    closeBtn.style.cssText =
      "margin-left:12px;cursor:pointer;border:none;background:none;color:white;font-size:1.2em;";
    closeBtn.addEventListener("click", () => {
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 300);
    });
    toast.appendChild(closeBtn);
  }

  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add("show"), 10);

  if (autoHide) {
    const delay = typeof autoHide === "number" ? autoHide : 3000;
    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 300);
    }, delay);
  }
}

// ===== Валидация имён =====
function containsForbiddenChars(name) {
  // запрещаем: \ / : * ? " < > | .
  return /[\\/:*?"<>|.]/.test(name);
}
function coreForbidden(name) {
  // запрещаем: \ / : * ? " < > |
  return /[\\/:*?"<>|]/.test(name);
}
function looksLikeFile(name) {
  return !!name && name.includes(".");
}
function inferWithOldExt(oldName, newName) {
  if (looksLikeFile(oldName) && newName && !newName.includes(".")) {
    const ext = oldName.split(".").pop();
    return ext ? `${newName}.${ext}` : newName;
  }
  return newName;
}

// ===== Выделение в гриде =====
function getSelectedName() {
  const sel =
    document.querySelector("#content .js-file.selected") ||
    document.querySelector("#content .category-card.selected");
  if (!sel) return null;
  return (
    sel.dataset.name ||
    sel.querySelector(".card-title")?.textContent?.trim() ||
    null
  );
}

// ===== Off-canvas панель (мобилка) =====
function isMobile() {
  return window.matchMedia("(max-width: 900px)").matches;
}
function openDrawer() {
  const explorer = document.querySelector(".admin-explorer");
  if (explorer && isMobile()) explorer.classList.add("is-open");
}
function closeDrawer() {
  const explorer = document.querySelector(".admin-explorer");
  if (explorer) explorer.classList.remove("is-open");
}

document.addEventListener("DOMContentLoaded", () => {
  // кнопки в админке — не submit
  document
    .querySelectorAll(".admin-ops button, #adminOps button")
    .forEach((b) => {
      if (!b.getAttribute("type")) b.setAttribute("type", "button");
    });

  // ==== Создать папку ====
  document.getElementById("btnMkdir").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    if (btn.dataset.busy === "1") return;
    btn.dataset.busy = "1";
    btn.disabled = true;
    try {
      const input = document.getElementById("mkdirName");
      const name = (input?.value || "").trim();
      if (!name) return showToast("Enter folder name!", "warning");
      if (containsForbiddenChars(name)) {
        return showToast(
          'Folder name must not contain: / \\ : * ? " < > | or dot (.)',
          "warning"
        );
      }
      const ok = await createFolder(name);
      if (ok && input) input.value = "";
    } finally {
      btn.dataset.busy = "0";
      btn.disabled = false;
    }
  });

  // ==== Загрузить файл ====
  document.getElementById("btnUpload").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    if (btn.dataset.busy === "1") return;
    btn.dataset.busy = "1";
    btn.disabled = true;
    try {
      const fileInput = document.getElementById("fileInput");
      if (!fileInput?.files?.length)
        return showToast("Select a file!", "warning");
      await uploadFile(fileInput.files[0]);
    } finally {
      btn.dataset.busy = "0";
      btn.disabled = false;
    }
  });

  // ==== Переименовать ====
  document.getElementById("btnRename").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    if (btn.dataset.busy === "1") return;
    btn.dataset.busy = "1";
    btn.disabled = true;

    try {
      const selected = getSelectedName();
      let oldName =
        selected || document.getElementById("renameOld").value.trim();
      let newName = document.getElementById("renameNew").value.trim();

      if (!oldName || !newName) return showToast("Specify names!", "warning");

      // автодобавление расширения, если меняем файл без точки
      newName = inferWithOldExt(oldName, newName);

      // валидация имени
      if (coreForbidden(newName)) {
        return showToast(
          'New name contains prohibited characters: / \\ : * ? " < > |',
          "warning"
        );
      }
      const isFile = looksLikeFile(oldName);
      if (!isFile && newName.includes(".")) {
        return showToast("Folder name cannot contain a dot (.).", "warning");
      }
      if (isFile && newName.startsWith(".")) {
        return showToast("File name cannot start with a dot (.).", "warning");
      }
      if (isFile && newName.includes(".")) {
        const ext = newName.split(".").pop().toLowerCase();
        if (!ALLOWED_EXTENSIONS.includes(ext)) {
          return showToast(
            `Invalid extension .${ext}. Allowed: ${ALLOWED_EXTENSIONS.join(
              ", "
            )}`,
            "warning"
          );
        }
      }

      console.log("[rename] oldName:", oldName, "→ newName:", newName);
      const ok = await renameItem(oldName, newName);
      if (ok) {
        // синхрон полей
        const ro = document.getElementById("renameOld");
        const rn = document.getElementById("renameNew");
        if (ro) ro.value = newName;
        if (rn) rn.value = "";

        if (isMobile()) closeDrawer();
      }
    } finally {
      btn.dataset.busy = "0";
      btn.disabled = false;
    }
  });

  // ==== Удалить ====
  document.getElementById("btnDelete").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    if (btn.dataset.busy === "1") return;
    btn.dataset.busy = "1";
    btn.disabled = true;

    try {
      const selected = getSelectedName();
      const name =
        selected || document.getElementById("deleteName").value.trim();
      if (!name) return showToast("Enter a name to delete!", "warning");

      console.log("[delete]", name);
      const ok = await deleteItem(name);
      if (ok) {
        const del = document.getElementById("deleteName");
        if (del) del.value = "";
        if (isMobile()) closeDrawer();
      }
    } finally {
      btn.dataset.busy = "0";
      btn.disabled = false;
    }
  });

  // ==== Восстановить ====
  document.getElementById("btnRestore").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    if (btn.dataset.busy === "1") return;
    btn.dataset.busy = "1";
    btn.disabled = true;

    try {
      await restoreItem();
      if (isMobile()) closeDrawer();
    } finally {
      btn.dataset.busy = "0";
      btn.disabled = false;
    }
  });

  // ===== Off-canvas панель: открыть/закрыть кнопками =====
  const drawerBtn = document.querySelector(".admin-drawer-btn");
  const explorer = document.querySelector(".admin-explorer");
  const drawerClose = document.querySelector(".admin-drawer-close");

  if (drawerBtn && explorer) {
    drawerBtn.addEventListener("click", () =>
      explorer.classList.add("is-open")
    );
    drawerClose?.addEventListener("click", closeDrawer);
  }

  // клик вне панели — закрыть (только мобилка)
  document.addEventListener(
    "click",
    (e) => {
      if (!explorer || !explorer.classList.contains("is-open")) return;
      if (window.matchMedia("(min-width: 1024px)").matches) return;
      const inside = explorer.contains(e.target);
      const onToggle = drawerBtn?.contains(e.target);
      if (!inside && !onToggle) closeDrawer();
    },
    true
  );

  // Esc — закрыть
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && explorer?.classList.contains("is-open")) {
      closeDrawer();
    }
  });

  // при переходе на десктоп — состояние сбросить
  window.matchMedia("(min-width: 1024px)").addEventListener("change", (ev) => {
    if (ev.matches) closeDrawer();
  });

  // опционально: внешние события могут открыть панель (например, из контекстного меню)
  document.addEventListener("admin:open-drawer", openDrawer);
});
