//admin-actions.js

function getCurrentPath() {
  const params = new URLSearchParams(window.location.search);
  const path = [];
  if (params.get("category")) path.push(params.get("category"));
  let i = 1;
  while (params.get("subcategory" + i)) {
    path.push(params.get("subcategory" + i));
    i++;
  }
  return path.join("/");
}
window.getCurrentPath = getCurrentPath;

async function handleResponse(res) {
  if (!res.ok) {
    let msg = "";
    try {
      msg = await res.text();
    } catch (_) {}
    throw new Error(`HTTP ${res.status}${msg ? `: ${msg}` : ""}`);
  }
  try {
    return await res.json();
  } catch {
    return {};
  }
}

// === СОЗДАТЬ ПАПКУ ===
async function createFolder(folderName) {
  const name = (folderName || "").trim();
  if (!name) {
    showToast("Enter the folder name", "warning");
    return false;
  }

  const basePath = getCurrentPath();
  const folderPath = basePath ? `${basePath}/${name}` : name;

  try {
    const res = await fetch("/create-folder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folderPath }),
    });
    await handleResponse(res);

    if (typeof window.renderPortfolio === "function") {
      await window.renderPortfolio();
    }

    showToast(`Folder "${name}" created`, "success");
    return true;
  } catch (e) {
    console.error(e);
    showToast("Failed to create folder: " + e.message, "error");
    return false;
  }
}

// === ЗАГРУЗИТЬ ФАЙЛ ===
async function uploadFile(file) {
  const formData = new FormData();
  const folderPath = getCurrentPath();
  formData.append("folderPath", folderPath);
  formData.append("file", file);

  try {
    const res = await fetch("/upload-file", { method: "POST", body: formData });
    const result = await handleResponse(res);
    if (typeof window.renderPortfolio === "function") {
      await window.renderPortfolio();
    }

    showToast(`File "${file.name}" uploaded`, "success");
    return true;
  } catch (e) {
    console.error(e);
    showToast("Failed to upload file: " + e.message, "error");
    return false;
  }
}

async function uploadFileTo(file, folderRelPath) {
  const formData = new FormData();
  formData.append("folderPath", folderRelPath || "");
  formData.append("file", file);

  const res = await fetch("/upload-file", { method: "POST", body: formData });
  await handleResponse(res);
  if (typeof window.renderPortfolio === "function") {
    await window.renderPortfolio();
  }
  showToast(`Файл "${file.name}" загружен`, "success");
  return true;
}

// === ПЕРЕИМЕНОВАТЬ ===
async function renameItem(oldName, newName) {
  if (!oldName || !newName) {
    showToast("Enter your old and new name", "warning");
    return false;
  }

  // ⚡️ КРИТИЧЕСКИЙ ПАТЧ: Проверяем, является ли элемент файлом, и корректно извлекаем расширение
  const lastDotIndex = oldName.lastIndexOf(".");

  // Если точка найдена И она не находится в самом начале имени (т.е. это не скрытая папка/файл),
  // считаем, что это файл, и пытаемся сохранить расширение.
  if (lastDotIndex > 0) {
    const oldExt = oldName.substring(lastDotIndex + 1);

    // Если в новом имени нет точки (пользователь ввел "photo" вместо "photo.jpg"),
    // добавляем старое расширение.
    if (newName.indexOf(".") === -1) {
      newName += "." + oldExt;
    }
  }
  // 💡 Если lastDotIndex === -1 или 0, это считается папкой или скрытым файлом без расширения, и код пропускает добавление.

  const folderPath = getCurrentPath();
  const oldPath = folderPath ? folderPath + "/" + oldName : oldName;
  const newPath = folderPath ? folderPath + "/" + newName : newName;

  try {
    const res = await fetch("/rename", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ oldPath, newPath }),
    });
    await handleResponse(res);

    if (typeof window.renderPortfolio === "function") {
      await window.renderPortfolio();
    }

    // ⚡️ ДОБАВЛЕНИЕ: Очистка полей после успеха
    const inputRenameOld = document.getElementById("renameOld");
    const inputRenameNew = document.getElementById("renameNew");
    if (inputRenameOld) {
      inputRenameOld.value = "";
    }
    if (inputRenameNew) {
      inputRenameNew.value = "";
    } // Также очищаем глобально выбранный файл, так как его имя изменилось:

    if (typeof window.selectedFileName !== "undefined") {
      window.selectedFileName = null;
    }

    showToast(`"${oldName}" renamed to "${newName}"`, "success");
    return true;
  } catch (e) {
    console.error(e);
    showToast("Failed to rename: " + e.message, "error");
    return false;
  }
}

// === УДАЛИТЬ ===
let lastDeletedItem = null;

async function deleteItem(name) {
  const basePath = getCurrentPath();
  const targetPath = basePath ? `${basePath}/${name}` : name;

  try {
    const res = await fetch("/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetPath }),
    });
    await handleResponse(res);
    if (typeof window.renderPortfolio === "function") {
      await window.renderPortfolio();
      if (typeof window.hidePreview === "function") window.hidePreview(); // Скрываем превью после удаления
    }

    lastDeletedItem = { name, path: targetPath, basePath };

    // ✅ ИЗМЕНЕНИЕ: очищаем инпут и selectedFileName после удаления
    const inputDeleteName = document.getElementById("deleteName");
    if (inputDeleteName) {
      inputDeleteName.value = "";
    }
    if (typeof window.selectedFileName !== "undefined") {
      window.selectedFileName = null;
    }

    // показываем тост без автоисчезновения, с кнопкой "Отменить"
    showToast(
      `Element "${name}" has been removed`,
      "warning",
      "Cancel",
      restoreItem,
      7000
    );
    return true;
  } catch (e) {
    console.error(e);
    showToast("Failed to delete item: " + e.message, "error");
    return false;
  }
}

// === ВОССТАНОВИТЬ ===
async function restoreItem() {
  if (!lastDeletedItem) {
    showToast("There are no items to recover", "info");
    return false;
  }

  try {
    const res = await fetch("/restore", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetPath: lastDeletedItem.path }),
    });
    await handleResponse(res);
    if (typeof window.renderPortfolio === "function") {
      await window.renderPortfolio();
    }
    showToast(`Item "${lastDeletedItem.name}" has been restored`, "success");
    lastDeletedItem = null;
  } catch (e) {
    console.error(e);
    showToast("Failed to restore the item: " + e.message, "error");
    return false;
  }
}

// ===============================================================================
// js/admin-ui.js --- ты можешь посмотреть фрагмент после комментария // js/admin-ui.js в файле ui_script.js

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

//========================================================================================
// main.js
import { initErrorHandler } from "./js/error-handler.js";
import { initHeader } from "./js/header.js";
import { initScript } from "./js/script.js";
import { initPortfolio } from "./js/portfolio.js";

// Админка
import { initAdminActions } from "./js/admin-actions.js";
import { initAdminPortfolio } from "./js/admin-portfolio.js";
import { initAdminUI } from "./js/admin-ui.js";

document.addEventListener("DOMContentLoaded", () => {
  const el = document.querySelector("#someId");
  if (!el) return; // защита от ошибки
  initErrorHandler();
  initHeader();
  initScript();
  initPortfolio();

  if (document.querySelector(".admin-body")) {
    initAdminActions?.();
    initAdminPortfolio?.();
    initAdminUI?.();
  }
});

//=================================================================================
// portfolio.js

(() => {
  const params = new URLSearchParams(window.location.search);
  const path = [];

  if (params.get("category")) path.push(params.get("category"));
  let i = 1;
  while (params.get("subcategory" + i)) {
    path.push(params.get("subcategory" + i));
    i++;
  }

  // Загружаем JSON
  fetch("data/portfolio.json")
    .then((res) => res.json())
    .then((data) => {
      let currentNode = { children: data };
      for (const segment of path) {
        const next = currentNode.children?.find(
          (item) => item.type === "folder" && item.name === segment
        );
        if (!next) {
          currentNode = null;
          break;
        }
        currentNode = next;
      }

      const pageTitle = document.getElementById("pageTitle");
      pageTitle.textContent = path.length
        ? path[path.length - 1].replace(/_/g, " ")
        : "Portfolio";

      const bcContainer = document.getElementById("breadcrumbs");
      if (path.length) {
        let bcLink = `portfolio.html`;
        bcContainer.innerHTML = `<a href="${bcLink}">Portfolio</a>`;
        let subLink = "";
        path.forEach((seg, idx) => {
          subLink +=
            idx === 0
              ? `?category=${encodeURIComponent(seg)}`
              : `&subcategory${idx}=${encodeURIComponent(seg)}`;
          const isLast = idx === path.length - 1;
          bcContainer.innerHTML += ` <span>›</span> <a href="portfolio.html${subLink}"${
            isLast ? ' class="active"' : ""
          }>${seg.replace(/_/g, " ")}</a>`;
        });
      }

      const container = document.getElementById("content");
      container.innerHTML = "";

      if (!currentNode) {
        container.textContent = "❌ Folder not found";
        return;
      }

      // === Галерея файлов ===
      const files = (currentNode.children || []).filter(
        (c) => c.type === "file"
      );
      if (files.length > 0) {
        const gallery = document.createElement("div");
        gallery.className = "gallery";

        files.forEach((fileNode) => {
          const file = fileNode.name;
          const ext = file.split(".").pop().toLowerCase();
          const filePath = `uploads/${path.join("/")}/${file}`;

          if (["jpg", "jpeg", "png", "webp", "gif"].includes(ext)) {
            const img = document.createElement("img");
            img.src = filePath;
            img.alt = file;
            img.dataset.caption = file; // фикс: всегда сохраняем подпись

            img.onerror = function onErr() {
              // заменила
              img.onerror = null;
              img.src = "img/no-image.jpg";
            };

            gallery.appendChild(img);
          } else if (["mp4", "mov", "webm"].includes(ext)) {
            const video = document.createElement("video");
            video.src = filePath;
            video.controls = true;
            gallery.appendChild(video);
          }
        });

        container.appendChild(gallery);
      }

      // === Подкатегории ===
      const subs = (currentNode.children || []).filter(
        (c) => c.type === "folder"
      );
      if (subs.length > 0) {
        const list = document.createElement("div");
        list.className = "category-list";

        subs.forEach((subNode) => {
          const subPath = [...path, subNode.name];
          let previewFile = "";
          const firstFile = (subNode.children || []).find(
            (c) => c.type === "file"
          );
          if (firstFile) previewFile = firstFile.name;

          const imgPath = previewFile
            ? `uploads/${subPath.join("/")}/${previewFile}`
            : "img/no-image.jpg";

          let link = `portfolio.html?category=${encodeURIComponent(
            path[0] || subNode.name
          )}`;
          for (let k = 1; k < path.length; k++) {
            link += `&subcategory${k}=${encodeURIComponent(path[k])}`;
          }
          if (path.length) {
            link += `&subcategory${path.length}=${encodeURIComponent(
              subNode.name
            )}`;
          }

          const card = document.createElement("a");
          card.href = link;
          card.className = "category-card";

          const t = new Image();
          // заменила t.onload/t.onerror
          t.onload = () => {
            card.innerHTML = `
                <div class="card-image" style="background-image: url('${imgPath}')"></div>
                <div class="card-title">${subNode.name.replace(/_/g, " ")}</div>
              `;
            t.onload = t.onerror = null;
          };
          t.onerror = () => {
            card.innerHTML = `
                <div class="card-image" style="background-image: url('img/no-image.jpg')"></div>
                <div class="card-title">${subNode.name.replace(/_/g, " ")}</div>
              `;
            t.onload = t.onerror = null;
          };

          t.src = imgPath;

          list.appendChild(card);
        });

        container.appendChild(list);
      }
    })
    .catch((err) => console.error("Error loading JSON:", err));
})();

// ===== Media Lightbox =====
(() => {
  const lbRoot = document.getElementById("mediaLightbox");
  const lbStage = document.getElementById("mlbStage");
  const lbCaption = document.getElementById("mlbCaption");
  const lbCounter = document.getElementById("mlbCounter");
  const btnPrev = document.getElementById("mlbPrev");
  const btnNext = document.getElementById("mlbNext");
  const btnClose = document.getElementById("mlbClose");

  let items = [];
  let index = 0;
  let lastActive = null;
  let isOpen = false;

  function collectItems() {
    items = [];
    document.querySelectorAll(".media-thumb[data-media-src]").forEach((el) => {
      items.push({
        src: el.dataset.mediaSrc,
        type: el.dataset.mediaType || guessType(el.dataset.mediaSrc),
        caption: el.dataset.caption || el.getAttribute("aria-label") || "",
      });
    });

    if (items.length === 0) {
      document.querySelectorAll("#content img").forEach((img) => {
        const src = img.dataset.full || img.src;
        items.push({ src, type: "image", caption: img.alt || "" });
        img.classList.add("media-thumb");
        img.dataset.mediaSrc = src;
        img.dataset.mediaType = "image";
      });
    }
  }

  function guessType(url = "") {
    return /\.(mp4|mov|webm)$/i.test(url) ? "video" : "image";
  }

  function open(idx, fromEl) {
    if (isOpen) return;
    if (!items.length) collectItems();
    index = Math.max(0, Math.min(idx, items.length - 1));
    lastActive = fromEl || document.activeElement;

    render();
    document.body.classList.add("mlb-open");
    lbRoot.hidden = false;
    lbRoot.setAttribute("aria-hidden", "false");
    btnClose.focus();

    window.addEventListener("keydown", onKey);
    lbRoot.addEventListener("click", onBackdrop);
    attachSwipe(lbStage);

    isOpen = true;
  }

  function close() {
    if (!isOpen) return;
    pauseVideo();
    lbRoot.setAttribute("aria-hidden", "true");
    lbRoot.hidden = true;
    document.body.classList.remove("mlb-open");

    window.removeEventListener("keydown", onKey);
    lbRoot.removeEventListener("click", onBackdrop);
    detachSwipe(lbStage);

    if (lastActive && typeof lastActive.focus === "function") {
      try {
        lastActive.focus();
      } catch (e) {
        /* ignore */
      }
    }
    lastActive = null; // освобождаем ссылку на ранее активный элемент
    isOpen = false;

    items = [];
    index = 0;
  }

  function onKey(e) {
    if (e.key === "Escape") close();
    if (e.key === "ArrowRight") next();
    if (e.key === "ArrowLeft") prev();
  }

  function onBackdrop(e) {
    const onStage = e.target.closest(".mlb-stage, .mlb-btn");
    if (!onStage) close();
  }

  function next() {
    goTo(index + 1);
  }
  function prev() {
    goTo(index - 1);
  }

  function goTo(i) {
    if (!items.length) return;
    index = (i + items.length) % items.length;
    render(true);
  }

  function pauseVideo() {
    const v = lbStage.querySelector("video");
    if (v && !v.paused) v.pause();
  }

  function render(withFade) {
    const it = items[index];
    pauseVideo();
    lbStage.innerHTML = "";

    let node;
    if (it.type === "video") {
      node = document.createElement("video");
      node.src = it.src;
      node.controls = true;
      node.playsInline = true;
      node.preload = "metadata";
      node.style.maxWidth = "100%";
    } else {
      node = document.createElement("img");
      node.src = it.src;
      node.alt = it.caption || "";
      node.decoding = "async";
    }
    if (withFade) {
      node.style.opacity = "0";
      node.style.transition = "opacity .2s ease";
      requestAnimationFrame(() => (node.style.opacity = "1"));
    }

    lbStage.appendChild(node);
    lbCaption.textContent = it.caption || "";
    lbCounter.textContent = `${index + 1} / ${items.length}`;

    preloadNeighbors();
    btnPrev.style.display = btnNext.style.display =
      items.length > 1 ? "" : "none";
  }

  function preloadNeighbors() {
    const left = items[(index - 1 + items.length) % items.length];
    const right = items[(index + 1) % items.length];
    [left, right].forEach((it) => {
      if (it && it.type === "image") {
        const img = new Image();
        img.src = it.src;
      }
    });
  }

  // свайпы
  let touchX = null,
    touchY = null;
  function attachSwipe(el) {
    el.addEventListener("touchstart", onTs, { passive: true });
    el.addEventListener("touchend", onTe, { passive: true });
  }
  function detachSwipe(el) {
    el.removeEventListener("touchstart", onTs);
    el.removeEventListener("touchend", onTe);
  }
  function onTs(e) {
    const t = e.changedTouches[0];
    touchX = t.clientX;
    touchY = t.clientY;
  }
  function onTe(e) {
    const t = e.changedTouches[0];
    const dx = t.clientX - touchX;
    const dy = t.clientY - touchY;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
      dx < 0 ? next() : prev();
    }
  }

  // кнопки
  btnClose.addEventListener("click", close);
  btnNext.addEventListener("click", next);
  btnPrev.addEventListener("click", prev);

  // делегатор (глобальный флаг предотвращает дублирование)
  if (!window.__portfolio_mlb_delegate_installed) {
    document.addEventListener("click", (e) => {
      const t = e.target.closest(".media-thumb, #content img");
      if (!t) return;

      collectItems();
      const src =
        t.dataset.mediaSrc ||
        t.dataset.full ||
        (t.tagName === "IMG" ? t.src : "");
      const idx = items.findIndex((it) => it.src === src);
      open(idx >= 0 ? idx : 0, t);
    });
    window.__portfolio_mlb_delegate_installed = true;
  }

  // публичный хук
  window.openMediaLightbox = (idx = 0) => {
    collectItems();
    open(idx);
  };
})();

//======================================================================================
// \src\modules\selection\index.js

import { on, emit } from "../../core/eventBus.js";
import { isDragging } from "../dnd/index.js";
let lastFileEl = null;

const isMobile = () => window.matchMedia("(max-width: 768px)").matches;

function clearSelection() {
  document
    .querySelectorAll("#content .selected")
    .forEach((el) => el.classList.remove("selected"));
}

export function getSelectedItems() {
  return Array.from(
    document.querySelectorAll(
      "#content .js-file.selected, #content .category-card.selected"
    )
  );
}

function emitSelectionChange() {
  const items = getSelectedItems();
  const names = items
    .map(
      (el) =>
        el.dataset.name || el.querySelector(".card-title")?.textContent?.trim()
    )
    .filter(Boolean);
  emit("selection:change", { items, names });
  if (names[0] && typeof window.insertFileName === "function")
    window.insertFileName(names[0]);
}

function selectRange(all, fromEl, toEl) {
  const a = all.indexOf(fromEl);
  const b = all.indexOf(toEl);
  if (a === -1 || b === -1) return;
  const [min, max] = [Math.min(a, b), Math.max(a, b)];
  for (let i = min; i <= max; i++) all[i].classList.add("selected");
}

function bindFile(el) {
  const all = Array.from(document.querySelectorAll("#content .js-file"));

  el.addEventListener("click", (e) => {
    if (isDragging) return;

    e.preventDefault();

    if (e.ctrlKey || e.metaKey) {
      el.classList.toggle("selected");
    } else if (e.shiftKey && lastFileEl) {
      clearSelection();
      selectRange(all, lastFileEl, el);
    } else {
      clearSelection();
      el.classList.add("selected");
    }

    lastFileEl = el.classList.contains("selected") ? el : lastFileEl;
    emitSelectionChange();

    if (isMobile()) {
      const idx = all.indexOf(el);
      emit("lightbox:open", { index: idx >= 0 ? idx : 0 });
      if (typeof window.openLightbox === "function")
        window.openLightbox(idx >= 0 ? idx : 0);
    }
  });

  el.addEventListener("dblclick", (e) => {
    if (isMobile()) return;
    e.preventDefault();
    const name = el.dataset.name;
    if (name) emit("selection:itemOpen", { name });
  });
}

function bindFolder(el) {
  el.addEventListener("dblclick", (e) => {
    if (isMobile()) return; // оставляем навигацию по ссылке только по одинарному клику
    e.preventDefault();
    clearSelection();
    el.classList.add("selected");
    emitSelectionChange();
  });

  el.addEventListener("click", (e) => {
    if (!(e.ctrlKey || e.metaKey || e.shiftKey)) return; // обычный клик — навигация
    e.preventDefault();

    // если нужен эксклюзивный выбор «только папки», очищаем файлы
    document
      .querySelectorAll("#content .js-file.selected")
      .forEach((n) => n.classList.remove("selected"));

    if (e.ctrlKey || e.metaKey) {
      el.classList.toggle("selected");
    } else if (e.shiftKey) {
      el.classList.add("selected"); // упрощенно без диапазона
    }

    emitSelectionChange();
  });
}

function bindAll() {
  document.querySelectorAll("#content .js-file").forEach(bindFile);
  document.querySelectorAll("#content .category-card").forEach(bindFolder);
}

export function init() {
  on("gallery:rendered", bindAll);
  // на случай, если DOM уже есть до первого emit
  bindAll();
}

//======================================================================
/** render.js
 * Рендер портфолио (ранее window.renderPortfolio)
 * - читает путь из URL (?category=&subcategory1=&...)
 * - грузит data/portfolio.json
 * - отрисовывает файлы и папки
 * - эмитит 'gallery:rendered' для подписчиков (selection/dnd/contextmenu)
 * - оставляет мост: window.renderPortfolio = render
 */

import { emit } from "../../core/eventBus.js";
import { EVENTS } from "../../schemas/events.js";

let cfg = { basePage: "admin-portfolio.html", dataUrl: "data/portfolio.json" };

function readPathFromURL() {
  const params = new URLSearchParams(window.location.search);
  const path = [];
  if (params.get("category")) path.push(params.get("category"));
  let i = 1;
  while (params.get("subcategory" + i)) {
    path.push(params.get("subcategory" + i));
    i++;
  }
  return path;
}

async function loadData() {
  const url = `${cfg.dataUrl}?_=${Date.now()}`; // форсим обновление
  const r = await fetch(url, { cache: "reload" });
  return await r.json();
}

function setPageTitle(path) {
  const pageTitle = document.getElementById("pageTitle");
  if (!pageTitle) return;
  pageTitle.textContent = path.length
    ? path[path.length - 1].replace(/_/g, " ")
    : "Portfolio";
}

function buildBreadcrumbs(path) {
  const bc = document.getElementById("breadcrumbs");
  if (!bc) return;
  bc.innerHTML = "";
  if (!path.length) return;

  let link = `${cfg.basePage}`;
  bc.innerHTML = `<a href="${link}">Portfolio</a>`;
  let subLink = "";
  path.forEach((seg, idx) => {
    subLink +=
      idx === 0
        ? `?category=${encodeURIComponent(seg)}`
        : `&subcategory${idx}=${encodeURIComponent(seg)}`;
    const isLast = idx === path.length - 1;
    bc.innerHTML += ` <span>›</span> <a href="${cfg.basePage}${subLink}"${
      isLast ? ' class="active"' : ""
    }>${seg.replace(/_/g, " ")}</a>`;
  });
}

function renderFiles(container, files, path) {
  if (!files.length) return;
  const gallery = document.createElement("div");
  gallery.className =
    files.length <= 2 ? "gallery gallery--compact" : "gallery";

  files.forEach((fileNode) => {
    const file = fileNode.name;
    const ext = file.split(".").pop().toLowerCase();
    const filePath = `uploads/${path.join("/")}/${file}`;
    const cell = document.createElement("div");
    cell.className = "cell js-file";
    cell.dataset.name = file; // <-- ДАННЫЕ ПЕРЕНОСИМ СЮДА
    cell.dataset.type = "file"; // <-- (Опционально, но полезно)

    if (["jpg", "jpeg", "png", "webp", "gif"].includes(ext)) {
      const img = document.createElement("img");
      img.src = filePath;
      img.alt = file;
      img.style.pointerEvents = "none";
      img.onerror = () => {
        img.src = "img/no-image.jpg";
      };

      const caption = document.createElement("div");
      caption.className = "file-caption";
      caption.textContent = file;

      cell.appendChild(img);
      cell.appendChild(caption);
    } else if (["mp4", "mov", "webm"].includes(ext)) {
      const video = document.createElement("video");
      video.src = filePath;
      video.controls = true;
      video.style.pointerEvents = "none";
      const caption = document.createElement("div"); // ← ДОБАВЬ
      caption.className = "file-caption";
      caption.textContent = file;

      cell.appendChild(video);
      cell.appendChild(caption); // ← ДОБАВЬ
    }

    gallery.appendChild(cell);
  });

  container.appendChild(gallery);
}

function folderLinkFor(path, subNode) {
  const subPath = [...path, subNode.name];
  let link = `${cfg.basePage}?category=${encodeURIComponent(
    path[0] || subNode.name
  )}`;
  for (let k = 1; k < path.length; k++)
    link += `&subcategory${k}=${encodeURIComponent(path[k])}`;
  if (path.length)
    link += `&subcategory${path.length}=${encodeURIComponent(subNode.name)}`;
  return { link, subPath };
}

function renderFolders(container, subs, path) {
  if (!subs.length) return;
  const list = document.createElement("div");
  list.className = "category-list";

  subs.forEach((subNode) => {
    const { link, subPath } = folderLinkFor(path, subNode);

    let previewFile = "";
    const firstFile = (subNode.children || []).find((c) => c.type === "file");
    if (firstFile) previewFile = firstFile.name;

    const imgPath = previewFile
      ? `uploads/${subPath.join("/")}/${previewFile}`
      : "img/no-image.jpg";

    const card = document.createElement("div");
    card.className = "category-card";
    card.style.cursor = "pointer";
    card.dataset.href = link; // сохраняем ссылку в data-атрибуте

    card.dataset.path = subPath.join("/");
    card.dataset.name = subNode.name;

    // Навигация по клику (НЕ во время drag)
    card.addEventListener("click", (e) => {
      // Если идёт drag — не навигируем
      if (card.classList.contains("drop-target")) {
        return;
      }

      if (e.ctrlKey || e.metaKey) {
        window.open(card.dataset.href, "_blank");
      } else {
        window.location.href = card.dataset.href;
      }
    });

    const t = new Image();
    t.onload = () => {
      card.innerHTML = `
    <div class="card-image" style="background-image: url('${imgPath}')"></div>
    <div class="card-title">${subNode.name.replace(/_/g, " ")}</div>
    `;
    };
    t.onerror = () => {
      card.innerHTML = `
    <div class="card-image" style="background-image: url('img/no-image.jpg')"></div>
    <div class="card-title">${subNode.name.replace(/_/g, " ")}</div>
    `;
    };
    t.src = imgPath;

    list.appendChild(card);
  });

  container.appendChild(list);
}

export async function render() {
  const path = readPathFromURL();
  try {
    const data = await loadData();

    let currentNode = { children: data };
    for (const segment of path) {
      const next = currentNode.children?.find(
        (item) => item.type === "folder" && item.name === segment
      );
      if (!next) {
        currentNode = null;
        break;
      }
      currentNode = next;
    }

    setPageTitle(path);
    buildBreadcrumbs(path);

    const container = document.getElementById("content");
    if (!container) return;
    container.innerHTML = "";

    if (!currentNode) {
      container.textContent = "❌ Folder not found";
      emit(EVENTS.GALLERY_RENDERED);
      return;
    }

    const files = (currentNode.children || []).filter((c) => c.type === "file");
    renderFiles(container, files, path);

    const subs = (currentNode.children || []).filter(
      (c) => c.type === "folder"
    );
    renderFolders(container, subs, path);

    // уведомляем подписчиков (selection/dnd/contextmenu)
    emit(EVENTS.GALLERY_RENDERED);
  } catch (e) {
    console.error("JSON loading error:", e);
  }
}

export function getCurrentPath() {
  return readPathFromURL().join("/");
}

export function init(config = {}) {
  cfg = { ...cfg, ...config };
  // обратная совместимость — старый код вызывает window.renderPortfolio()
  window.renderPortfolio = render;
  window.getCurrentPath = getCurrentPath;
  // автозапуск (если DOM уже готов — рендерим сразу)
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", render, { once: true });
  } else {
    render();
  }
}
