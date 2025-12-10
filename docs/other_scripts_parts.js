// src/modules/clipboard/index.js
// Простой буфер обмена для файлов/папок: режим CUT (перемещение)

let clip = null; // { mode:'cut', sourcePath:'a/b', items:[{name, kind:'file'|'folder'}] }

export function cutFromSelection() {
  // берём выделенные в сетке (файлы и папки)
  const selectedEls = Array.from(
    document.querySelectorAll(
      "#content .js-file.selected, #content .category-card.selected"
    )
  );
  // если ничего не выделено — выходим (меню потом подстрахуем)
  if (!selectedEls.length) return false;

  const items = selectedEls
    .map((el) => ({
      name: el.dataset.name,
      kind: el.classList.contains("category-card") ? "folder" : "file",
      el,
    }))
    .filter((it) => !!it.name);

  const sourcePath =
    (typeof window.getCurrentPath === "function"
      ? window.getCurrentPath()
      : "") || "";

  clip = { mode: "cut", sourcePath, items };

  // лёгкая визуализация "вырезано"
  items.forEach((it) => it.el?.classList.add("cutting"));
  return true;
}

export function hasCut() {
  return (
    !!clip &&
    clip.mode === "cut" &&
    Array.isArray(clip.items) &&
    clip.items.length > 0
  );
}

export function getCut() {
  return hasCut()
    ? { ...clip, items: clip.items.map(({ name, kind }) => ({ name, kind })) }
    : null;
}

export function clear() {
  document
    .querySelectorAll("#content .cutting")
    .forEach((n) => n.classList.remove("cutting"));
  clip = null;
}

//======================================================================

// \src\modules\contextmenu\index.js

import { on } from "../../core/eventBus.js";

let menu = null; // DOM-элемент контекст-меню (создадим в init)
let lpTimer = null; // таймер long-press
let cutClip = null; // { mode:'cut', sourcePath, items:[{name, kind, el}] } для Cut/Paste

const CLIP_KEY = "admin.clip";

function saveClipToStorage(clip) {
  const safe = {
    mode: "cut",
    sourcePath: clip.sourcePath || "",
    items: (clip.items || []).map(({ name, kind }) => ({ name, kind })),
  };
  sessionStorage.setItem(CLIP_KEY, JSON.stringify(safe));
}

function loadClipFromStorage() {
  try {
    const raw = sessionStorage.getItem(CLIP_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function clearClipStorage() {
  sessionStorage.removeItem(CLIP_KEY);
}

function reapplyCutMarkersIfVisible() {
  const clip = loadClipFromStorage();
  const here = window.getCurrentPath?.() || "";
  if (!clip || clip.mode !== "cut" || clip.sourcePath !== here) return;

  document
    .querySelectorAll("#content .cutting")
    .forEach((n) => n.classList.remove("cutting"));
  const names = new Set(clip.items.map((i) => i.name));
  document
    .querySelectorAll("#content .js-file, #content .category-card")
    .forEach((el) => {
      const nm =
        el.dataset.name ||
        el.querySelector?.(".card-title")?.textContent?.trim();
      if (nm && names.has(nm)) el.classList.add("cutting");
    });
}

function ensureMenu() {
  if (menu) return menu;
  menu = document.createElement("div");
  menu.className = "admin-ctx";
  menu.innerHTML = `
<button data-act="open">Open / Preview</button>
<button data-act="rename">Rename…</button>
<button data-act="delete">Delete…</button>
<button data-act="delete-selected">Delete selected</button>
<button data-act="move-selected">Move selected here</button>
<hr>
  <button data-act="cut">Cut</button>
  <button data-act="paste-here">Paste here</button>
<button data-act="cancel-cut">Cancel cut</button>
`;
  document.body.appendChild(menu);

  const close = () => menu.classList.remove("open");
  window.addEventListener("scroll", close, { passive: true });
  window.addEventListener("resize", close);
  document.addEventListener("click", (e) => {
    if (!menu.contains(e.target)) close();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });
  return menu;
}

function openDrawerAndFocus(which) {
  const explorer = document.querySelector(".admin-explorer");
  if (!explorer) return;
  if (!window.matchMedia("(max-width: 1023px)").matches) return;

  explorer.classList.add("is-open");
  const focusAndScroll = () => {
    if (which === "rename") {
      const ro = document.getElementById("renameOld");
      const rn = document.getElementById("renameNew");
      const row = document.querySelector(".rename-group");
      ro && ro.scrollIntoView({ block: "center", behavior: "smooth" });
      (rn || ro)?.focus();
    } else if (which === "delete") {
      const del = document.getElementById("deleteName");
      const row = document.querySelector(".delete-group");
      row && row.scrollIntoView({ block: "center", behavior: "smooth" });
      del?.focus();
    }
  };
  requestAnimationFrame(() => requestAnimationFrame(focusAndScroll));
}

function showMenu(x, y, targetEl) {
  const isBg = !targetEl; // клик по пустому месту сетки
  const name = isBg
    ? ""
    : targetEl?.dataset?.name ||
      targetEl?.querySelector?.(".card-title")?.textContent?.trim();

  const m = ensureMenu();
  m.dataset.name = name || "";

  // включаем/прячем пункты по контексту и буферу
  const clip = loadClipFromStorage() || cutClip;
  const hasClip = !!(clip && clip.items && clip.items.length);
  const isFolder = !!targetEl?.classList?.contains("category-card");

  const toggle = (sel, show) => {
    const el = m.querySelector(sel);
    if (el) el.style.display = show ? "" : "none";
  };

  toggle('[data-act="open"]', !isBg);
  toggle('[data-act="rename"]', !isBg);
  toggle('[data-act="delete"]', !isBg);
  toggle('[data-act="delete-selected"]', true); // можно оставить всегда
  toggle('[data-act="move-selected"]', !isBg && isFolder);
  toggle('[data-act="cut"]', !isBg);
  toggle('[data-act="paste-here"]', hasClip);
  toggle('[data-act="cancel-cut"]', hasClip);

  // ——— дальше оставляешь свой существующий код позиционирования ———
  const prevVis = m.style.visibility;
  m.style.visibility = "hidden";
  m.classList.add("open");
  m.style.left = "0px";
  m.style.top = "0px";
  // включаем/выключаем Paste по наличию буфера
  const pasteBtn = m.querySelector('[data-act="paste-here"]');
  if (pasteBtn)
    //
    m.style.maxWidth = "min(260px, 90vw)";
  m.style.maxHeight = window.innerHeight - 16 + "px";
  m.style.overflowY = "auto";
  m.style.zIndex = "3000";

  const pad = 8;
  const r = m.getBoundingClientRect();
  let left = x + pad;
  let top = y + pad;

  if (left + r.width > window.innerWidth - pad)
    left = Math.max(pad, window.innerWidth - r.width - pad);
  if (top + r.height > window.innerHeight - pad) {
    const above = y - r.height - pad;
    top =
      above >= pad ? above : Math.max(pad, window.innerHeight - r.height - pad);
  }

  m.style.left = left + "px";
  m.style.top = top + "px";
  m.style.visibility = prevVis || "visible";

  /*const moveBtn = m.querySelector('[data-act="move-selected"]');
  const isFolder = targetEl?.classList?.contains("category-card");
  if (moveBtn) moveBtn.style.display = isFolder ? "" : "none";*/

  m.onclick = async (e) => {
    const act = e.target?.dataset?.act;
    if (!act) return;
    e.stopPropagation();

    const selectedNow = Array.from(
      document.querySelectorAll(
        "#content .js-file.selected, #content .category-card.selected"
      )
    );

    // сбрасываем выделение ТОЛЬКО для одиночных действий

    if (act !== "delete-selected" && act !== "move-selected" && act !== "cut") {
      document
        .querySelectorAll("#content .selected")
        .forEach((n) => n.classList.remove("selected"));
      if (targetEl) {
        targetEl.classList.add("selected");
        if (typeof insertFileName === "function" && name) insertFileName(name);
      }
    }

    if (act === "open") {
      if (window.matchMedia("(max-width: 768px)").matches) {
        const all = Array.from(document.querySelectorAll("#content .js-file"));
        const i = all.indexOf(targetEl);
        if (i >= 0 && typeof window.openLightbox === "function")
          window.openLightbox(i);
      } else {
        if (typeof window.showPreview === "function") window.showPreview(name);
      }
    } else if (act === "rename") {
      const ro = document.getElementById("renameOld");
      const rn = document.getElementById("renameNew");
      if (ro) ro.value = name;
      openDrawerAndFocus("rename");
    } else if (act === "delete") {
      const del = document.getElementById("deleteName");
      if (del) {
        del.value = name;
        openDrawerAndFocus("delete");
      }
    } else if (act === "delete-selected") {
      const selected = Array.from(
        document.querySelectorAll(
          "#content .js-file.selected, #content .category-card.selected"
        )
      );
      if (!selected.length) {
        window.showToast?.("Nothing selected", "info");
        return;
      }
      // собираем имена
      const names = selected
        .map(
          (el) =>
            el.dataset.name ||
            el.querySelector?.(".card-title")?.textContent?.trim()
        )
        .filter(Boolean);
      // текущий путь
      const base =
        (typeof window.getCurrentPath === "function"
          ? window.getCurrentPath()
          : "") || "";
      // удаляем по одному, но без лишних перерисовок/тостов
      for (const name of names) {
        const targetPath = base ? `${base}/${name}` : name;
        const res = await fetch("/delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetPath }),
        });
        // единый обработчик, если есть
        if (typeof window.handleResponse === "function") {
          await window.handleResponse(res);
        } else {
          await res.json().catch(() => ({}));
        }
      }
      // одна перерисовка и один тост по итогам
      if (typeof window.renderPortfolio === "function")
        await window.renderPortfolio();
      window.showToast?.(`Deleted ${names.length} item(s)`, "success");
    } else if (act === "move-selected") {
      const targetName = m.dataset.name; // имя целевой папки
      const base = window.getCurrentPath?.() || ""; // текущая папка
      const targetPath = base ? `${base}/${targetName}` : targetName;

      // берём ВСЁ выделенное: файлы и папки в текущей папке
      const selected = Array.from(
        document.querySelectorAll(
          "#content .js-file.selected, #content .category-card.selected"
        )
      );
      if (!selected.length) {
        window.showToast?.("Nothing selected", "info");
        return;
      }

      // переносим по одному (без лишних перерисовок)
      for (const el of selected) {
        const name =
          el.dataset.name ||
          el.querySelector?.(".card-title")?.textContent?.trim();
        if (!name) continue;
        // не двигаем папку в саму себя
        if (el.classList.contains("category-card") && name === targetName)
          continue;
        const oldPath = base ? `${base}/${name}` : name;
        const newPath = `${targetPath}/${name}`;
        try {
          const res = await fetch("/rename", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ oldPath, newPath }),
          });
          if (window.handleResponse) {
            await window.handleResponse(res);
          } else {
            await res.json().catch(() => ({}));
          }
        } catch (err) {
          console.error("Move failed:", name, err);
        }
      }
      // одна перерисовка и один тост по итогам
      await window.renderPortfolio?.();
      window.showToast?.(
        `Moved ${selected.length} item(s) → ${targetName}`,
        "success"
      );
    } else if (act === "cut") {
      // соберём текущее выделение (если пусто — возьмём targetEl)
      const selected = Array.from(
        document.querySelectorAll(
          "#content .js-file.selected, #content .category-card.selected"
        )
      );
      const pack = selected.length ? selected : targetEl ? [targetEl] : [];
      const items = pack
        .map((el) => ({
          name:
            el.dataset.name ||
            el.querySelector?.(".card-title")?.textContent?.trim(),
          kind: el.classList.contains("category-card") ? "folder" : "file",
          el,
        }))
        .filter((it) => !!it.name);

      const sourcePath = window.getCurrentPath?.() || "";
      if (!items.length) {
        window.showToast?.("Nothing selected", "info");
        return;
      }

      // сохранить в буфер и слегка «побледнить» вырезанные
      cutClip = { mode: "cut", sourcePath, items };
      document
        .querySelectorAll("#content .cutting")
        .forEach((n) => n.classList.remove("cutting"));
      items.forEach((it) => it.el?.classList.add("cutting"));

      saveClipToStorage(cutClip);

      window.showToast?.(`Cut ${items.length} item(s)`, "info");
    } else if (act === "paste-here") {
      // берём клипборд из памяти или из sessionStorage
      const clip = cutClip || loadClipFromStorage();
      if (!(clip && clip.items && clip.items.length)) {
        window.showToast?.("Clipboard is empty", "info");
        return;
      }

      // куда вставляем
      let targetPath = window.getCurrentPath?.() || "";
      if (targetEl?.classList?.contains("category-card")) {
        const p = targetEl.dataset.path;
        const n =
          targetEl.dataset.name ||
          targetEl.querySelector?.(".card-title")?.textContent?.trim();
        targetPath = p || (targetPath ? `${targetPath}/${n}` : n);
      }

      // защита: не переносим в саму себя / в потомка
      const safe = clip.items.filter((it) => {
        const oldPath = clip.sourcePath
          ? `${clip.sourcePath}/${it.name}`
          : it.name;
        if (targetPath === oldPath) return false;
        if (targetPath.startsWith(oldPath + "/")) return false;
        return true;
      });
      if (!safe.length) {
        window.showToast?.("Nothing to paste here", "info");
        return;
      }

      // переносим по одному (как в dnd)
      let okCount = 0;
      for (const it of safe) {
        const oldPath = clip.sourcePath
          ? `${clip.sourcePath}/${it.name}`
          : it.name;
        const newPath = targetPath ? `${targetPath}/${it.name}` : it.name;
        try {
          const res = await fetch("/rename", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ oldPath, newPath }),
          });
          if (window.handleResponse) {
            await window.handleResponse(res);
          } else if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
          }
          okCount++;
        } catch (err) {
          console.error("Paste move failed:", it.name, err);
        }
      }

      // очистка буфера и отметок «вырезано»
      document
        .querySelectorAll("#content .cutting")
        .forEach((n) => n.classList.remove("cutting"));
      cutClip = null;
      clearClipStorage();

      await window.renderPortfolio?.();
      window.showToast?.(`Moved ${okCount} item(s)`, "success");
    } else if (act === "cancel-cut") {
      // снять «вырезано»: очистить буфер и подсветку
      document
        .querySelectorAll("#content .cutting")
        .forEach((n) => n.classList.remove("cutting"));
      cutClip = null;
      clearClipStorage();
      window.showToast?.("Cut canceled", "info");
    }

    m.classList.remove("open");
  };

  const close = () => {
    m.classList.remove("open");
    document.removeEventListener("click", onDoc, { capture: true });
    document.removeEventListener("keydown", onKey);
  };
  const onDoc = (e) => {
    if (!m.contains(e.target)) close();
  };
  const onKey = (e) => {
    if (e.key === "Escape") close();
  };

  setTimeout(() => {
    document.addEventListener("click", onDoc, { capture: true, once: true });
  }, 0);
  document.addEventListener("keydown", onKey, { once: true });
}

function bindContextFor(el) {
  el.addEventListener("contextmenu", (e) => {
    e.preventDefault();

    // Проверяем, есть ли выделенные элементы
    const hasSelection =
      document.querySelectorAll("#content .selected").length > 0;
    const isFolder = el.classList.contains("category-card");

    // Если это папка И есть выделение — НЕ сбрасываем (для "Move selected here")
    if (isFolder && hasSelection) {
      // Ничего не делаем с выделением
    } else if (!el.classList.contains("selected")) {
      // Обычное поведение: сбрасываем выделение
      document
        .querySelectorAll("#content .selected")
        .forEach((n) => n.classList.remove("selected"));
      el.classList.add("selected");
    }

    const name =
      el.dataset?.name ||
      el.querySelector?.(".card-title")?.textContent?.trim();
    if (name && typeof insertFileName === "function") insertFileName(name);
    if (typeof showMenu === "function") showMenu(e.clientX, e.clientY, el);
  });

  el.addEventListener(
    "touchstart",
    (e) => {
      const t = e.touches && e.touches[0];
      if (!t) return;
      lpTimer = setTimeout(() => {
        document
          .querySelectorAll("#content .selected")
          .forEach((n) => n.classList.remove("selected"));
        el.classList.add("selected");

        const name =
          el.dataset?.name ||
          el.querySelector?.(".card-title")?.textContent?.trim();
        if (name && typeof window.insertFileName === "function")
          window.insertFileName(name);
        showMenu(t.clientX, t.clientY, el);
      }, 550);
    },
    { passive: true }
  );

  ["touchend", "touchcancel", "touchmove"].forEach((type) => {
    el.addEventListener(
      type,
      () => {
        if (lpTimer) clearTimeout(lpTimer);
      },
      { passive: true }
    );
  });
}
export function init() {
  on("gallery:rendered", () => {
    // существующее: биндим на карточки/файлы
    document
      .querySelectorAll("#content .js-file, #content .category-card")
      .forEach(bindContextFor);

    // НОВОЕ: ПКМ по пустому месту — наше меню с targetEl = null
    const grid = document.getElementById("content");
    if (grid && !grid.dataset.ctxBg) {
      grid.dataset.ctxBg = "1";
      grid.addEventListener("contextmenu", (e) => {
        const onItem = e.target.closest(".js-file, .category-card");
        if (onItem) return; // для самих карточек работает bindContextFor
        e.preventDefault();
        showMenu(e.clientX, e.clientY, null); // ← целимся в ТЕКУЩУЮ папку
      });
    }

    reapplyCutMarkersIfVisible();
  });
}

//============================================================================

// \src\modules\dnd\index.js

import { on } from "../../core/eventBus.js";
import { API } from "../../schemas/api.js";
import { EVENTS } from "../../schemas/events.js";

let cfg = { renameUrl: API.renameUrl, uploadUrl: API.uploadUrl };
export let isDragging = false;

const TYPE = "application/x-admin-dnd";

const hasFiles = (e) =>
  !!e.dataTransfer && Array.from(e.dataTransfer.types || []).includes("Files");
const hasAdminPayload = (e) =>
  !!e.dataTransfer && Array.from(e.dataTransfer.types || []).includes(TYPE);

function payloadFromEvent(e) {
  try {
    const raw =
      e.dataTransfer.getData(TYPE) || e.dataTransfer.getData("text/plain");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function markDragging(items, on) {
  document
    .querySelectorAll("#content .js-file")
    .forEach((n) => n.classList.remove("dragging"));
  if (on) items.forEach((n) => n.classList.add("dragging"));
}

export async function moveItems(items, targetPath) {
  for (const it of items) {
    const base =
      (typeof window.getCurrentPath === "function"
        ? window.getCurrentPath()
        : "") || "";
    const oldPath = base ? `${base}/${it.name}` : it.name;
    const newPath = targetPath ? `${targetPath}/${it.name}` : it.name;

    console.log(`[moveItems] Moving: ${oldPath} → ${newPath}`);

    const res = await fetch(cfg.renameUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ oldPath, newPath }),
    });
    if (typeof window.handleResponse === "function") {
      await window.handleResponse(res);
    } else if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
  }
}

async function uploadFilesTo(path, files) {
  for (const f of files) {
    const form = new FormData();
    form.append("folderPath", path || "");
    form.append("file", f);
    const res = await fetch(cfg.uploadUrl, { method: "POST", body: form });
    if (typeof window.handleResponse === "function") {
      await window.handleResponse(res);
    } else if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
  }
}

function bindDraggables(root) {
  root.querySelectorAll(".js-file").forEach((el) => {
    if (el.dataset.dnd === "1") return;
    el.dataset.dnd = "1";
    el.setAttribute("draggable", "true");
    el.style.webkitUserDrag = "element";
    el.addEventListener("dragstart", (e) => {
      isDragging = true;

      const selectedFiles = Array.from(
        document.querySelectorAll("#content .js-file.selected")
      );
      const pack = selectedFiles.length ? selectedFiles : [el];

      const payload = {
        sourcePath:
          (typeof getCurrentPath === "function" ? getCurrentPath() : "") || "",
        items: pack.map((n) => ({ name: n.dataset.name, type: "file" })),
      };

      // console.log("[dragstart] Payload:", payload);

      e.dataTransfer.setData(TYPE, JSON.stringify(payload));
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData(
        "text/plain",

        payload.items.map((i) => i.name).join(",")
      );
      e.dataTransfer.setData("text/html", "");
      markDragging(pack, true);
    });

    el.addEventListener("dragend", () => {
      markDragging([], false);
      isDragging = false;
    });
  });
}

function bindFolderDraggables(root) {
  root.querySelectorAll(".category-card").forEach((folderEl) => {
    if (folderEl.dataset.dnd === "1") return;
    folderEl.dataset.dnd = "1";
    folderEl.setAttribute("draggable", "true");

    folderEl.addEventListener("dragstart", (e) => {
      const selected = Array.from(
        document.querySelectorAll(
          "#content .js-file.selected, #content .category-card.selected"
        )
      );
      const pack = selected.length ? selected : [folderEl];

      const payload = {
        sourcePath:
          (typeof getCurrentPath === "function" ? getCurrentPath() : "") || "",
        items: pack
          .map((n) => ({
            name: n.dataset.name,
            type: n.classList.contains("category-card") ? "folder" : "file",
          }))
          .filter((it) => !!it.name),
      };

      const txt = JSON.stringify(payload);
      e.dataTransfer.setData("application/x-admin-dnd", txt);
      e.dataTransfer.setData("text/plain", txt); // для Chrome
      e.dataTransfer.effectAllowed = "move";

      // подсветка — достаточно файлов
      document
        .querySelectorAll("#content .js-file")
        .forEach((n) => n.classList.remove("dragging"));
      document
        .querySelectorAll("#content .js-file.selected")
        .forEach((n) => n.classList.add("dragging"));
    });

    folderEl.addEventListener("dragend", () => {
      document
        .querySelectorAll("#content .js-file")
        .forEach((n) => n.classList.remove("dragging"));
    });
  });
}

function bindFolderDrops(root) {
  root.querySelectorAll(".category-card").forEach((card) => {
    if (card.dataset.droptarget === "1") return;
    card.dataset.droptarget = "1";

    card.addEventListener(
      "click",
      (e) => {
        // Блокируем навигацию ТОЛЬКО во время drag
        if (card.classList.contains("drop-target")) {
          e.preventDefault();
          e.stopPropagation();
          return false;
        }
      },
      true
    );

    const allow = (e) => {
      // console.log("[dragover] Over folder:", card.dataset.name);
      e.preventDefault();
      e.stopPropagation();
      card.classList.add("drop-target");
      e.dataTransfer.dropEffect = hasFiles(e) ? "copy" : "move";
    };

    // Убираем href во время drag
    card.addEventListener("dragenter", allow, true);

    card.addEventListener("dragover", allow, true);

    // Восстанавливаем href
    card.addEventListener("dragleave", () => {
      card.classList.remove("drop-target");
      if (card.dataset.originalHref) {
        card.href = card.dataset.originalHref;
        delete card.dataset.originalHref;
      }
    });

    card.addEventListener(
      "drop",
      async (e) => {
        // 1. СНАЧАЛА блокируем браузер
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        // 2. ПОТОМ логируем
        //  console.log("[drop] RAW EVENT FIRED!");

        // 3. ПОТОМ чистим UI
        card.classList.remove("drop-target");

        const folderName =
          card.dataset?.name ||
          card.querySelector(".card-title")?.textContent?.trim();
        if (!folderName) return;

        const base =
          (typeof window.getCurrentPath === "function"
            ? window.getCurrentPath()
            : "") || "";
        const targetPath = base ? `${base}/${folderName}` : folderName;

        const skipSelf = new Set([folderName]);

        // ДЕБАГ
        console.log("[DnD:drop] EVENT:", {
          folderName,
          targetPath,
          hasFiles: hasFiles(e),
          hasPayload: hasAdminPayload(e),
          dataTransferTypes: Array.from(e.dataTransfer.types),
          selectedElements: Array.from(
            document.querySelectorAll(
              "#content .js-file.selected, #content .category-card.selected"
            )
          ).map((n) => n.dataset.name),
        });

        try {
          // 1) ПРИОРИТЕТ: выделенные элементы (если это НЕ внешний дроп)
          if (!hasFiles(e)) {
            const selectedEls = Array.from(
              document.querySelectorAll(
                "#content .js-file.selected, #content .category-card.selected"
              )
            );

            const items = selectedEls
              .map((el) => ({
                name: el.dataset.name,
                kind: el.classList.contains("category-card")
                  ? "folder"
                  : "file",
              }))
              .filter((it) => !!it.name)
              .filter(
                (it) => !(it.kind === "folder" && it.name === folderName)
              );

            console.log("[DnD:drop] Selected items to move:", items);
            // --- защита: не переносим в саму себя / в своего потомка
            const base0 =
              (typeof getCurrentPath === "function" ? getCurrentPath() : "") ||
              "";
            const itemsSafe = items.filter((it) => {
              const oldPath = base0 ? `${base0}/${it.name}` : it.name;
              if (targetPath === oldPath) return false; // та же папка/тот же путь
              if (targetPath.startsWith(oldPath + "/")) return false; // перенос папки в её подпапку
              return true;
            });
            if (itemsSafe.length !== items.length) {
              console.warn(
                "[DnD:drop] skipped",
                items.length - itemsSafe.length,
                "invalid self/descendant move(s)"
              );
            }

            if (itemsSafe.length) {
              await moveItems(itemsSafe, targetPath);
              if (typeof window.renderPortfolio === "function")
                await window.renderPortfolio();
              if (typeof window.showToast === "function")
                window.showToast(
                  `Moved ${itemsSafe.length} item(s) → ${folderName}`,
                  "success"
                );
            }
            return;
          }

          // 2) FALLBACK: payload от dragstart (если выделения нет)
          if (hasAdminPayload(e) && !hasFiles(e)) {
            const data = payloadFromEvent(e);
            console.log("[DnD:drop] Payload data:", data);

            const items = (data?.items || [])
              .map((it) => ({ name: it.name, kind: "file" }))
              .filter((it) => !!it.name);

            const base0 =
              (typeof getCurrentPath === "function" ? getCurrentPath() : "") ||
              "";
            const itemsSafe = items.filter((it) => {
              const oldPath = data?.sourcePath
                ? `${data.sourcePath}/${it.name}`
                : it.name;
              if (targetPath === oldPath) return false;
              if (targetPath.startsWith(oldPath + "/")) return false;
              return true;
            });

            if (itemsSafe.length) {
              await moveItems(itemsSafe, targetPath);
              if (typeof window.renderPortfolio === "function")
                await window.renderPortfolio();
              if (typeof window.showToast === "function")
                window.showToast(
                  `Moved ${itemsSafe.length} item(s) → ${folderName}`,
                  "success"
                );
              return;
            }
          }

          // 3) Внешние файлы из проводника (РАБОТАЕТ, НЕ ТРОГАЕМ)
          if (hasFiles(e)) {
            const files = Array.from(e.dataTransfer.files || []);
            if (files.length) {
              await uploadFilesTo(targetPath, files);
              if (typeof window.showToast === "function")
                window.showToast(
                  `Uploaded ${files.length} file(s) → ${folderName}`,
                  "success"
                );
              if (typeof window.renderPortfolio === "function")
                await window.renderPortfolio();
            }
          }
        } catch (err) {
          console.error("DnD drop error:", err);
          if (typeof window.showToast === "function")
            window.showToast("Operation failed", "error");
        }
      },
      true
    );
  });
}

function bindGridExternalDrop(grid) {
  if (!grid || grid.dataset.gridDrop === "1") return;
  grid.dataset.gridDrop = "1";

  grid.addEventListener("dragover", (e) => {
    if (hasFiles(e)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    }
  });

  grid.addEventListener("drop", async (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files || []);
    if (!files.length) return;
    const base =
      (typeof window.getCurrentPath === "function"
        ? window.getCurrentPath()
        : "") || "";
    try {
      await uploadFilesTo(base, files);
      if (typeof window.showToast === "function")
        window.showToast(`Uploaded ${files.length} file(s)`, "success");
    } catch (err) {
      console.error("DnD upload error:", err);
      if (typeof window.showToast === "function")
        window.showToast("Upload failed", "error");
    } finally {
      if (typeof window.renderPortfolio === "function")
        await window.renderPortfolio();
    }
  });
}

export function init(config = {}) {
  cfg = { ...cfg, ...config };

  const bindAll = () => {
    const grid = document.getElementById("content");
    if (!grid) return;
    bindDraggables(grid);
    bindFolderDraggables(grid);
    bindFolderDrops(grid);
    bindGridExternalDrop(grid);
    // маленький лог для проверки в Chrome:
    const f = grid.querySelectorAll(".js-file").length;
    const d = grid.querySelectorAll(".category-card").length;
    console.log(`[dnd] bound: files=${f}, folders=${d}`);
  };

  // слушаем обе формы события (на случай рассинхрона)
  on("gallery:rendered", bindAll);
  on(EVENTS?.GALLERY_RENDERED || "gallery:rendered", bindAll);

  // и сразу пробуем привязаться к уже существующему DOM
  // (в Chrome это часто решает проблему гонки)
  requestAnimationFrame(bindAll);
}
// export { init, isDragging, moveItems };

//======================================================================

// portfolio-demo\src\modules\preview\index.js

import { on, emit } from "../../core/eventBus.js";

let workspace, previewPane, resizer, previewImg;
let isResizing = false;

const isDesktop = () => window.matchMedia("(min-width: 1024px)").matches;

function getMaxPreviewWidth() {
  if (!workspace) return window.innerWidth * 0.8;
  const rect = workspace.getBoundingClientRect();
  const workspaceLimit = Math.max(300, rect.width * 0.8);
  const imgNaturalWidth = previewImg?.naturalWidth || 0;
  return imgNaturalWidth > 0
    ? Math.min(imgNaturalWidth, workspaceLimit)
    : workspaceLimit;
}

function fitPreviewToImage() {
  if (!previewPane || !previewImg) return;
  if (!previewPane.classList.contains("active")) return;
  if (!previewImg.naturalWidth || previewImg.naturalWidth <= 0) return;
  const maxWidth = getMaxPreviewWidth();
  const minWidth = 280;
  const target = Math.max(
    minWidth,
    Math.min(previewImg.naturalWidth, maxWidth)
  );
  previewPane.style.width = `${target}px`;
  previewPane.style.flex = "0 0 auto";
}

function attachResizer() {
  if (!resizer || !previewPane || !workspace) return;

  resizer.addEventListener("mousedown", () => {
    if (!previewPane.classList.contains("active")) return;
    isResizing = true;
    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";
    previewPane.classList.add("resizing");
  });

  document.addEventListener("mousemove", (e) => {
    if (!isResizing) return;
    if (!previewPane.classList.contains("active")) {
      isResizing = false;
      return;
    }
    const rect = workspace.getBoundingClientRect();
    const minWidth = 280;
    const maxWidth = getMaxPreviewWidth();
    const newWidth = Math.max(0, Math.round(rect.right - e.clientX));
    if (newWidth >= minWidth && newWidth <= maxWidth) {
      previewPane.style.width = `${newWidth}px`;
      previewPane.style.flex = "0 0 auto";
    }
  });

  document.addEventListener("mouseup", () => {
    if (!isResizing) return;
    isResizing = false;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    previewPane.classList.remove("resizing");
  });

  window.addEventListener("resize", () => {
    if (previewPane?.classList.contains("active")) fitPreviewToImage();
  });
}

function previewUrlFor(name) {
  const p =
    typeof window.getCurrentPath === "function" ? window.getCurrentPath() : "";
  return `uploads/${p ? p + "/" : ""}${name}`;
}

export function show(name) {
  const pane = document.getElementById("previewPane");
  if (pane) {
    pane.hidden = false;
    pane.classList.add("active");
    if (!pane.style.width) {
      pane.style.width = "400px";
      pane.style.flex = "0 1 400px";
    }
  }

  if (!isDesktop()) {
    // На мобиле — в лайтбокс
    const all = Array.from(document.querySelectorAll("#content .js-file"));
    const index = all.findIndex((el) => el.dataset.name === name);
    emit("lightbox:open", { index: index >= 0 ? index : 0 });
    if (typeof window.openLightbox === "function")
      window.openLightbox(index >= 0 ? index : 0);
    return;
  }

  if (!previewPane || !previewImg) return;
  const errBox = document.getElementById("previewError");
  if (errBox) errBox.hidden = true;

  previewImg.onload = () => {
    if (errBox) errBox.hidden = true;
    previewPane.classList.add("active");
    fitPreviewToImage();
  };
  previewImg.onerror = () => {
    previewImg.removeAttribute("src");
    if (errBox) errBox.hidden = false;
    previewPane.classList.add("active");
  };
  previewImg.src = previewUrlFor(name);
  emit("preview:open", { name });
}

export function hide() {
  const pane = document.getElementById("previewPane");
  if (pane) {
    pane.classList.remove("active");
    pane.hidden = true;
  }
  if (!previewPane || !previewImg) return;
  previewImg.removeAttribute("src");
  previewPane.classList.remove("active");
  previewPane.style.width = "";
  previewPane.style.flex = "";
  emit("preview:close");
}

function syncPreviewWithViewport() {
  if (!previewPane) return;
  if (!isDesktop()) {
    previewPane.classList.remove("active");
    previewPane.hidden = true;
    previewPane.style.width = "";
    previewPane.style.flex = "";
    return;
  }
  if (!previewImg || !previewImg.getAttribute("src")) {
    previewPane.classList.remove("active");
    previewPane.hidden = true;
    previewPane.style.width = "";
    previewPane.style.flex = "";
  }
}

export function init() {
  workspace = document.getElementById("workspace");
  previewPane = document.getElementById("previewPane");
  resizer = document.getElementById("previewResizer");
  previewImg = document.getElementById("previewImage");

  attachResizer();

  const closeBtn = document.getElementById("previewCloseBtn");
  if (closeBtn) closeBtn.onclick = hide;

  on("selection:itemOpen", ({ name }) => show(name));

  document.addEventListener("DOMContentLoaded", syncPreviewWithViewport);
  window.addEventListener("resize", syncPreviewWithViewport);

  // мост для обратной совместимости со старым кодом
  window.showPreview = show;
  window.hidePreview = hide;
}

//=====================================================
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

//==========================================================================

// src/index.js

import { emit } from "./core/eventBus.js";
import * as gallery from "./modules/gallery/render.js";
import * as selection from "./modules/selection/index.js";
import * as preview from "./modules/preview/index.js";
import * as dnd from "./modules/dnd/index.js";
import * as lightbox from "./modules/lightbox/index.js";
import * as contextmenu from "./modules/contextmenu/index.js";

export function initApp() {
  gallery.init({
    basePage: "admin-portfolio.html",
    dataUrl: "data/portfolio.json",
  });
  /* gallery.init({ --- как было
    basePage: mode === "admin" ? "admin-portfolio.html" : "index.html", // или твоя публичная страница
    dataUrl: "/data/portfolio.json",
    mode,
  });*/
  selection.init();
  preview.init();
  dnd.init();
  lightbox.init();
  contextmenu.init();
  emit("app:ready");
}

// ES-модули не имеют document.currentScript — запускаем всегда один раз
if (!window.__appInitialized) {
  window.__appInitialized = true;
  initApp();
}

// --- авто-рефреш после успешных операций CRUD
(() => {
  if (window.__crudRefreshHookInstalled) return;
  window.__crudRefreshHookInstalled = true;

  let refreshTimer = null;
  const scheduleRefresh = (delay = 300) => {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      refreshTimer = null;
      if (typeof window.renderPortfolio === "function")
        window.renderPortfolio();
    }, delay);
  };

  const origFetch = window.fetch.bind(window);
  window.fetch = async (...args) => {
    const res = await origFetch(...args);
    try {
      const req = args[0];
      const url = String(typeof req === "string" ? req : req?.url || "");
      if (
        res.ok &&
        /\/(create-folder|rename|delete|upload-file)(\/|\?|$)/.test(url)
      ) {
        scheduleRefresh(300); // небольшая задержка, чтобы файл дописался
      }
    } catch {}
    return res;
  };
})();

//===========================================================================
