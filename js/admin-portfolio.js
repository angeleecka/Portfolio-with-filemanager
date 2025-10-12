// admin-portfolio.js
// Используется и в админке, и в публичном портфолио (только BASE_PAGE меняется).
window.insertFileName ||= function () {};
window.showPreview ||= function () {};
window.hidePreview ||= function () {};

const BASE_PAGE = "admin-portfolio.html";
// На публичной странице ставь: const BASE_PAGE = 'portfolio.html';

// --- глобальное состояние ---
let selectedFileName = null;
window.selectedFileName = selectedFileName;

// DOM-референсы
let workspace = null;
let previewPane = null;
let resizer = null;
let previewImg = null;

let isResizing = false;

// --- вспомогательные функции ---
function getMaxPreviewWidth() {
  if (!workspace) return window.innerWidth * 0.8;
  const workspaceRect = workspace.getBoundingClientRect();
  const workspaceLimit = Math.max(300, workspaceRect.width * 0.8);
  const imgNaturalWidth = previewImg?.naturalWidth || 0;
  const imgLimit =
    imgNaturalWidth > 0
      ? Math.min(imgNaturalWidth, workspaceLimit)
      : workspaceLimit;
  return imgLimit;
}

function fitPreviewToImage() {
  if (!previewPane || !previewImg) return;
  if (!previewPane.classList.contains("active")) return;
  if (!previewImg.naturalWidth || previewImg.naturalWidth <= 0) return;

  const maxWidth = getMaxPreviewWidth();
  const minWidth = 280;
  const targetWidth = Math.max(
    minWidth,
    Math.min(previewImg.naturalWidth, maxWidth)
  );
  previewPane.style.width = `${targetWidth}px`;
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

    const workspaceRect = workspace.getBoundingClientRect();
    const minWidth = 280;
    const maxWidth = getMaxPreviewWidth();
    const newWidth = Math.max(0, Math.round(workspaceRect.right - e.clientX));
    if (newWidth >= minWidth && newWidth <= maxWidth) {
      previewPane.style.width = `${newWidth}px`;
      previewPane.style.flex = "0 0 auto";
    }
  });

  document.addEventListener("mouseup", () => {
    if (isResizing) {
      isResizing = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      previewPane.classList.remove("resizing");
    }
  });

  window.addEventListener("resize", () => {
    if (previewPane && previewPane.classList.contains("active")) {
      fitPreviewToImage();
    }
  });
}

// --- рендер портфолио ---
window.renderPortfolio = async function () {
  const params = new URLSearchParams(window.location.search);
  const path = [];
  if (params.get("category")) path.push(params.get("category"));
  let i = 1;
  while (params.get("subcategory" + i)) {
    path.push(params.get("subcategory" + i));
    i++;
  }

  try {
    // ⚡ форсим обновление JSON (убираем кэш браузера)
    const r = await fetch(`data/portfolio.json?_=${Date.now()}`, {
      cache: "reload",
    });
    const data = await r.json();

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
    if (pageTitle) {
      pageTitle.textContent = path.length
        ? path[path.length - 1].replace(/_/g, " ")
        : "Portfolio";
    }

    const bc = document.getElementById("breadcrumbs");
    if (bc) {
      bc.innerHTML = "";
      if (path.length) {
        let link = `${BASE_PAGE}`;
        bc.innerHTML = `<a href="${link}">Portfolio</a>`;
        let subLink = "";
        path.forEach((seg, idx) => {
          subLink +=
            idx === 0
              ? `?category=${encodeURIComponent(seg)}`
              : `&subcategory${idx}=${encodeURIComponent(seg)}`;
          const isLast = idx === path.length - 1;
          bc.innerHTML += ` <span>›</span> <a href="${BASE_PAGE}${subLink}"${
            isLast ? ' class="active"' : ""
          }>${seg.replace(/_/g, " ")}</a>`;
        });
      }
    }

    const container = document.getElementById("content");
    if (!container) return;
    container.innerHTML = "";

    if (!currentNode) {
      container.textContent = "❌ Folder not found";
      return;
    }

    // === файлы ===
    const files = (currentNode.children || []).filter((c) => c.type === "file");
    if (files.length > 0) {
      const gallery = document.createElement("div");
      gallery.className =
        files.length <= 2 ? "gallery gallery--compact" : "gallery";

      files.forEach((fileNode) => {
        const file = fileNode.name;
        const ext = file.split(".").pop().toLowerCase();
        const filePath = `uploads/${path.join("/")}/${file}`;
        const cell = document.createElement("div");
        cell.className = "cell";

        if (["jpg", "jpeg", "png", "webp", "gif"].includes(ext)) {
          const img = document.createElement("img");
          img.src = filePath;
          img.alt = file;
          img.dataset.name = file;
          img.classList.add("js-file");
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
          cell.appendChild(video);
        }
        gallery.appendChild(cell);
      });

      container.appendChild(gallery);
    }

    // === папки ===
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

        let link = `${BASE_PAGE}?category=${encodeURIComponent(
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

    window.attachPreviewHandlers?.();

    initAdminContextMenu?.();
  } catch (e) {
    console.error("JSON loading error:", e);
  }
};

// --- предпросмотр ---
window.attachPreviewHandlers = function () {
  function clearSelection() {
    document.querySelectorAll("#content .selected").forEach((el) => {
      el.classList.remove("selected");
    });
  }

  // ⛳️ Помощник: пропускаем «внешние» якоря и плавно скроллим по текущей странице
  function bypassIfAnchorNav(e) {
    const a = e.target.closest("a");
    if (!a) return false; // клик не по ссылке — пусть обрабатывается дальше

    if (a.hasAttribute("data-no-scroll")) return true; // отдать браузеру как есть

    const href = a.getAttribute("href") || "";
    if (!href.includes("#")) return false; // не якорь — не мешаем обработке ниже

    const url = new URL(href, location.href);
    const samePage =
      url.origin === location.origin && url.pathname === location.pathname;

    // якорь ведёт на ДРУГУЮ страницу — отдать браузеру (переход)
    if (!samePage) return true;

    // якорь на этой странице, проверим наличие цели
    if (!url.hash) return false;
    const target = document.querySelector(url.hash);
    if (!target) return false;

    // гладкий скролл по текущей странице и «съедаем» дальнейшую обработку клика
    e.preventDefault();
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    history.pushState(null, "", url.hash);
    return true;
  }

  // файлы (ячейки)
  document.querySelectorAll("#content .js-file").forEach((el) => {
    const name = el.dataset.name;
    const isMobile = () => window.matchMedia("(max-width: 768px)").matches;

    el.addEventListener("click", (e) => {
      // пропускаем якорные ссылки
      if (typeof bypassIfAnchorNav === "function" && bypassIfAnchorNav(e))
        return;

      // Мобайл: открываем лайтбокс по ОДНОМУ тапу
      if (isMobile()) {
        e.preventDefault();
        // выделение + автоподстановка имени
        document
          .querySelectorAll("#content .selected")
          .forEach((n) => n.classList.remove("selected"));
        el.classList.add("selected");
        try {
          window.selectedFileName = name;
        } catch {}
        if (typeof insertFileName === "function") insertFileName(name);

        if (typeof openLightbox === "function") {
          const all = Array.from(
            document.querySelectorAll("#content .js-file")
          );
          const idx = all.indexOf(el);
          openLightbox(idx >= 0 ? idx : 0);
        }
        return;
      }

      // Десктоп: только выделяем + заполняем поле; открытие — на dblclick
      e.preventDefault();
      document
        .querySelectorAll("#content .selected")
        .forEach((n) => n.classList.remove("selected"));
      el.classList.add("selected");
      try {
        window.selectedFileName = name;
      } catch {}
      if (typeof insertFileName === "function") insertFileName(name);
    });

    el.addEventListener("dblclick", () => {
      if (isMobile()) return; // на мобилке dblclick не нужен
      if (typeof showPreview === "function") showPreview(name);
    });
  });

  // карточки категорий
  document.querySelectorAll("#content .category-card").forEach((card) => {
    card.addEventListener("click", (e) => {
      if (bypassIfAnchorNav(e)) return;

      e.preventDefault();
      clearSelection();
      card.classList.add("selected");
      const folderName = card.querySelector(".card-title")?.textContent.trim();
      selectedFileName = folderName;
    });

    card.addEventListener("dblclick", (e) => {
      if (bypassIfAnchorNav(e)) return;

      // если это <a> с href — перейдём, иначе откроем предпросмотр
      if ("href" in card && card.href) {
        window.location.href = card.href;
      } else {
        const nm =
          card.dataset?.name ||
          card.querySelector(".card-title")?.textContent.trim() ||
          "";
        showPreview(nm);
      }
    });
  });

  const closeBtn = document.getElementById("previewCloseBtn");
  if (closeBtn) closeBtn.onclick = hidePreview;
};

function previewUrlFor(name) {
  const p = typeof getCurrentPath === "function" ? getCurrentPath() : "";
  return `uploads/${p ? p + "/" : ""}${name}`;
}

function showPreview(name) {
  const pane = document.getElementById("previewPane");
  if (pane) {
    pane.hidden = false; // важно: снимаем hidden
    pane.classList.add("active"); // важно: именно .active (как в твоём CSS)
    // на случай «нулевой» ширины до первого ресайза
    if (!pane.style.width) {
      pane.style.width = "400px";
      pane.style.flex = "0 1 400px";
    }
  }

  if (window.innerWidth <= 768) {
    const all = Array.from(document.querySelectorAll("#content .js-file"));
    const index = all.findIndex((el) => el.dataset.name === name);
    if (index >= 0) openLightbox(index);
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
}

function hidePreview() {
  const pane = document.getElementById("previewPane");
  if (pane) {
    pane.classList.remove("active");
    pane.hidden = true; // синхронно прячем
  }

  if (!previewPane || !previewImg) return;
  previewImg.removeAttribute("src");
  previewPane.classList.remove("active");
  previewPane.style.width = "";
  previewPane.style.flex = "";
}

// --- lightbox ---
const mediaLightbox = document.getElementById("mediaLightbox");
const mlbStage = document.getElementById("mlbStage");
const mlbCaption = document.getElementById("mlbCaption");
const mlbCounter = document.getElementById("mlbCounter");
const mlbClose = document.getElementById("mlbClose");
const mlbPrev = document.getElementById("mlbPrev");
const mlbNext = document.getElementById("mlbNext");

let mlbItems = [];
let mlbIndex = 0;

function openLightbox(index) {
  mlbItems = Array.from(document.querySelectorAll("#content .js-file"));
  mlbIndex = index;

  // 🔧 важно: на мобилке очищаем состояние правой панели, чтобы потом при ресайзе не «торчал» ресайзер
  if (typeof hidePreview === "function") hidePreview();

  updateLightbox();
  if (mediaLightbox) {
    mediaLightbox.hidden = false;
    mediaLightbox.setAttribute("aria-hidden", "false");
  }
  // 🔧 метка, что лайтбокс открыт
  document.body.classList.add("mlb-open");
}

function updateLightbox() {
  const item = mlbItems[mlbIndex];
  if (!item || !mlbStage) return;
  mlbStage.innerHTML = "";
  const img = document.createElement("img");
  img.src = item.src;
  img.alt = item.dataset.name || "";
  mlbStage.appendChild(img);
  if (mlbCaption) mlbCaption.textContent = item.dataset.name || "";
  if (mlbCounter)
    mlbCounter.textContent = `${mlbIndex + 1} / ${mlbItems.length}`;
}

function closeLightbox() {
  if (!mediaLightbox) return;
  mediaLightbox.hidden = true;
  mediaLightbox.setAttribute("aria-hidden", "true");
  // 🔧 сняли метку
  document.body.classList.remove("mlb-open");
}

if (mlbClose) mlbClose.addEventListener("click", closeLightbox);
if (mlbPrev)
  mlbPrev.addEventListener("click", () => {
    if (mlbItems.length > 0) {
      mlbIndex = (mlbIndex - 1 + mlbItems.length) % mlbItems.length;
      updateLightbox();
    }
  });
if (mlbNext)
  mlbNext.addEventListener("click", () => {
    if (mlbItems.length > 0) {
      mlbIndex = (mlbIndex + 1) % mlbItems.length;
      updateLightbox();
    }
  });

function syncPreviewWithViewport() {
  const pane = document.getElementById("previewPane");
  const img = document.getElementById("previewImage");
  if (!pane) return;

  const isDesktop = window.matchMedia("(min-width: 1024px)").matches;

  if (!isDesktop) {
    // мобилка: панель всегда прячем и сбрасываем inline-стили
    pane.classList.remove("active");
    pane.hidden = true;
    pane.style.width = "";
    pane.style.flex = "";
    return;
  }

  // десктоп: если изображения нет — панель скрыта и чистая
  if (!img || !img.getAttribute("src")) {
    pane.classList.remove("active");
    pane.hidden = true;
    pane.style.width = "";
    pane.style.flex = "";
  }
}

// первичная синхронизация и при ресайзе
document.addEventListener("DOMContentLoaded", syncPreviewWithViewport);
window.addEventListener("resize", syncPreviewWithViewport);

// --- старт ---
document.addEventListener("DOMContentLoaded", () => {
  const adminRoot =
    document.getElementById("workspace") ||
    document.getElementById("content") ||
    document.querySelector(".admin-preview");
  if (!adminRoot) return;

  workspace = document.getElementById("workspace");
  previewPane = document.getElementById("previewPane");
  resizer = document.getElementById("previewResizer");
  previewImg = document.getElementById("previewImage");

  // ✅ при фокусе инпута подставляем selectedFileName
  const inputRenameOld = document.getElementById("renameOld");
  const inputDeleteName = document.getElementById("deleteName");

  if (inputRenameOld) {
    inputRenameOld.addEventListener("focus", () => {
      if (selectedFileName) {
        inputRenameOld.value = selectedFileName;
      }
    });
  }

  if (inputDeleteName) {
    inputDeleteName.addEventListener("focus", () => {
      if (selectedFileName) {
        inputDeleteName.value = selectedFileName;
      }
    });
  }

  typeof attachResizer === "function" && attachResizer();

  if (typeof renderPortfolio === "function") {
    renderPortfolio();
  }

  document.querySelectorAll(".admin-body [data-i18n]").forEach((n) => {
    if (n.childNodes.length === 1 && n.firstChild.nodeType === Node.TEXT_NODE) {
      n.replaceWith(n.firstChild); // снимаем простые обёртки
    }
  });
});

// ✅ ИЗМЕНЕНИЕ: функция больше не нужна, но оставляем для совместимости
window.insertFileName = function (name) {
  selectedFileName = name;
};

// ===== контекстное меню + long-press =====
(function () {
  let menu, lpTimer;

  function ensureMenu() {
    if (menu) return menu;
    menu = document.createElement("div");
    menu.className = "admin-ctx";
    menu.innerHTML = `
      <button data-act="open">Open / Preview</button>
      <button data-act="rename">Rename…</button>
      <button data-act="delete">Delete…</button>
    `;
    document.body.appendChild(menu);

    // закрытие
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
  // авто-открыть левую панель на мобилке и сфокусироваться на нужной группе
  function openDrawerAndFocus(which /* 'rename' | 'delete' */) {
    const explorer = document.querySelector(".admin-explorer");
    if (!explorer) return;

    // открываем только на мобилке (у тебя десктоп с 1024px)
    if (!window.matchMedia("(max-width: 1023px)").matches) return;

    explorer.classList.add("is-open");

    // дождаться применения класса и перерисовки — потом фокус/скролл
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

    // два rAF — надежно после изменения layout/transition
    requestAnimationFrame(() => requestAnimationFrame(focusAndScroll));
  }

  function showMenu(x, y, targetEl) {
    const name =
      targetEl?.dataset?.name ||
      targetEl?.querySelector?.(".card-title")?.textContent?.trim();
    if (!name) return;

    const m = ensureMenu();
    m.dataset.name = name;

    // 1) Показать «невидимо» для измерения (без мигания)
    const prevVis = m.style.visibility;
    m.style.visibility = "hidden";
    m.classList.add("open");
    m.style.left = "0px";
    m.style.top = "0px";

    // 2) Ограничения + высокий z-index, чтобы не обрезалось
    m.style.maxWidth = "min(260px, 90vw)";
    m.style.maxHeight = window.innerHeight - 16 + "px";
    m.style.overflowY = "auto";
    m.style.zIndex = "3000";

    const pad = 8;
    const r = m.getBoundingClientRect();
    let left = x + pad;
    let top = y + pad;

    // 3) Прижать по горизонтали
    if (left + r.width > window.innerWidth - pad) {
      left = Math.max(pad, window.innerWidth - r.width - pad);
    }

    // 4) Flip вверх, если снизу не влезает (с финальным прижатием)
    if (top + r.height > window.innerHeight - pad) {
      const above = y - r.height - pad;
      top =
        above >= pad
          ? above
          : Math.max(pad, window.innerHeight - r.height - pad);
    }

    m.style.left = left + "px";
    m.style.top = top + "px";
    m.style.visibility = prevVis || "visible";

    // 5) Действия (оставил как у тебя)
    m.onclick = async (e) => {
      const act = e.target?.dataset?.act;
      if (!act) return;
      e.stopPropagation();

      document
        .querySelectorAll("#content .selected")
        .forEach((n) => n.classList.remove("selected"));
      targetEl.classList?.add("selected");
      if (typeof insertFileName === "function") insertFileName(name);

      if (act === "open") {
        if (window.matchMedia("(max-width: 768px)").matches) {
          const all = Array.from(
            document.querySelectorAll("#content .js-file")
          );
          const idx = all.indexOf(targetEl);
          if (idx >= 0 && typeof openLightbox === "function") openLightbox(idx);
        } else {
          if (typeof showPreview === "function") showPreview(name);
        }
      } else if (act === "rename") {
        const ro = document.getElementById("renameOld");
        const rn = document.getElementById("renameNew");
        if (ro) ro.value = name;
        // 👉 автоматически открыть панель и сфокусироваться
        openDrawerAndFocus("rename");
      } else if (act === "delete") {
        const del = document.getElementById("deleteName");
        if (del) {
          del.value = name;
          // 👉 автоматически открыть панель и сфокусироваться
          openDrawerAndFocus("delete");
        }
      }

      m.classList.remove("open");
    };

    // Закрытие по клику вне/ESC (чтобы меню не «зависало»)
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

    // Клик-вне — после текущего тика, чтобы не съесть клик по самому меню
    setTimeout(() => {
      document.addEventListener("click", onDoc, { capture: true, once: true });
    }, 0);
    document.addEventListener("keydown", onKey, { once: true });
  }

  function bindContextFor(el) {
    // ПКМ
    el.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      showMenu(e.clientX, e.clientY, el);
    });

    // Long-press (мобилка ~550мс)
    el.addEventListener(
      "touchstart",
      (e) => {
        if (lpTimer) clearTimeout(lpTimer);
        const touch = e.touches[0];
        lpTimer = setTimeout(() => {
          showMenu(touch.clientX, touch.clientY, el);
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

  // вызывать после рендера миниатюр
  window.initAdminContextMenu = function () {
    document
      .querySelectorAll("#content .js-file, #content .category-card")
      .forEach(bindContextFor);
  };
})();
