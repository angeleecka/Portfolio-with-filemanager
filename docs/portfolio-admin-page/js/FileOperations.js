// ===========================================================
// js/FileOperations.js (Финальная структурированная версия)
// ============================================================

// --- 1. ПЕРЕМЕННЫЕ СОСТОЯНИЯ ---
let fileStructure = {}; // Здесь будут храниться загруженные данные (динамически)
let currentPath1 = ["Upload"]; // Текущий путь панели 1 (Начальное значение будет изменено после загрузки)
let currentPath2 = ["Upload"]; // Текущий путь панели 2 (Начальное значение будет изменено после загрузки)
let viewMode1 = "row"; // 'row' или 'tile'
let viewMode2 = "row";
let activeListId = "file-list-1"; // ID активного контейнера списка

// --- 2. ЭМУЛЯЦИЯ ДАННЫХ (Структура из скриншота) ---
const fileStructureTemplate = {
  Upload: {
    type: "folder",
    date: "10.12.2025 07:57",
    size: "-",

    Portrait: {
      type: "folder",
      date: "10.12.2025 07:57",
      size: "-",

      Classic_portrait: {
        type: "folder",
        date: "10.12.2025 07:57",
        size: "-",
        "cover.jpg": { type: "file", date: "14.08.2025 22:06", size: "108 КБ" },
        "новое.фото": { type: "file", date: "09.10.2025 22:06", size: "46 КБ" },
      },
      Historical_portrait: {
        type: "folder",
        date: "20.10.2025 13:07",
        size: "-" /* ... */,
      },
      Egypt: {
        type: "folder",
        date: "18.10.2025 23:55",
        size: "-",
        "894153217099749574.jpg": {
          type: "file",
          date: "14.08.2025 17:00",
          size: "250 КБ",
        },
        "894154332717506631.jpg": {
          type: "file",
          date: "14.08.2025 17:00",
          size: "300 КБ",
        },
        "image_003.jpg": {
          type: "file",
          date: "15.08.2025 10:00",
          size: "150 КБ",
        },
        "image_004.jpg": {
          type: "file",
          date: "15.08.2025 11:00",
          size: "120 КБ",
        },
      },
      Thematic_photo_session: {
        type: "folder",
        date: "01.11.2025 09:00",
        size: "-" /* ... */,
      },
    },
    Wedding_photo_session: {
      type: "folder",
      date: "10.12.2025 07:57",
      size: "-",
      // ... подпапки
    },
    _tmp: { type: "folder", date: "05.12.2025 08:00", size: "-" /* ... */ },
  },
};

/**
 * Имитирует асинхронную загрузку данных с сервера.
 */
function fetchDataFromApi() {
  return new Promise((resolve) => {
    setTimeout(() => {
      // Копируем шаблон в рабочую переменную
      fileStructure = JSON.parse(JSON.stringify(fileStructureTemplate));
      resolve(fileStructure);
    }, 300);
  });
}

// --- 3. Логика операций (Открыть, Переименовать, Удалить) ---

function handleOpen(path, name, type) {
  if (type === "file") {
    alert(`Предпросмотр файла: /${[...path, name].join("/")}`);
  }
  // Для папок переход происходит в dblclick обработчике
}

function handleDelete(path, name) {
  // Используем глобальную функцию showConfirmModal, определенную в ModalConfirm.js
  showConfirmModal(
    `Вы уверены, что хотите удалить "${name}" из папки /${path.join("/")}?`,
    () => {
      // Эмуляция удаления:
      const parent = path.reduce((acc, key) => acc[key], fileStructure);
      delete parent[name];

      alert(
        `Элемент ${name} удален (виртуально). Требуется сохранение в JSON.`
      );

      // Обновляем списки и дерево после удаления
      renderFileList(currentPath1, "file-list-1", viewMode1);
      renderFileList(currentPath2, "file-list-2", viewMode2);
      // Используем глобальную функцию renderFileTree, определенную в FileTree.js
      renderFileTree(fileStructure, currentPath1);
    }
  );
}

/**
 * Инициализирует визуальный режим переименования.
 * @param {string[]} path - Путь к родительской папке.
 * @param {string} oldName - Текущее имя файла/папки.
 * @param {HTMLElement} targetElement - Элемент, который нужно заменить на поле ввода.
 */
function initializeRename(path, oldName, targetElement) {
  // 1. Создаем поле ввода с текущим именем
  const inputField = document.createElement("input");
  inputField.type = "text";
  inputField.value = oldName;
  inputField.className = "rename-input";

  // 2. Находим элемент, который содержит имя (либо td, либо span .tile-name)
  let nameWrapper;
  if (targetElement.tagName === "TR") {
    nameWrapper = targetElement.querySelector(".file-name"); // Для табличного режима
  } else if (targetElement.classList.contains("file-tile")) {
    nameWrapper = targetElement.querySelector(".tile-name"); // Для плиточного режима
  } else {
    return; // Если элемент не распознан
  }

  // 3. Скрываем старое имя и вставляем поле ввода
  const originalContent = nameWrapper.innerHTML;
  nameWrapper.innerHTML = "";
  nameWrapper.appendChild(inputField);

  inputField.focus();
  // Выделяем имя без расширения
  const dotIndex = oldName.lastIndexOf(".");
  if (dotIndex > 0 && targetElement.dataset.type === "file") {
    inputField.setSelectionRange(0, dotIndex);
  } else {
    inputField.select();
  }

  /**
   * Выполняет переименование (вызывается при Enter или Blur)
   */
  function performRename() {
    const newName = inputField.value.trim();

    // 1. Проверка на изменения и пустые имена
    if (newName === oldName || newName === "") {
      // Если имя не изменилось или пусто, просто восстанавливаем вид
      restoreElement();
      return;
    }

    // 2. Здесь вы должны вызвать свою СЕРВЕРНУЮ ЛОГИКУ ПЕРЕИМЕНОВАНИЯ
    // (Например: fetch('/api/rename', { method: 'POST', body: { path, oldName, newName } }))

    // --- Эмуляция успешного серверного вызова ---
    alert(
      `Отправлен запрос: переименовать ${oldName} в ${newName} в папке /${path.join(
        "/"
      )}`
    );

    // --- Обновление фронтенд-модели (fileStructure) ---
    const parent = path.reduce((acc, key) => acc[key], fileStructure);

    // Создаем новый объект с новым именем
    parent[newName] = parent[oldName];

    // Обновляем метаданные, если нужно (например, дату изменения)
    parent[newName].date = new Date().toLocaleString("ru-RU");

    // Удаляем старый ключ
    delete parent[oldName];

    // 3. Восстанавливаем внешний вид и перерендериваем
    restoreElement();

    // Обновляем оба списка и дерево, чтобы изменения отобразились везде
    window.navigateToFolder(currentPath1, "file-list-1");
    window.navigateToFolder(currentPath2, "file-list-2");
  }

  /**
   * Восстанавливает исходный элемент, убирая поле ввода
   */
  function restoreElement() {
    if (nameWrapper.contains(inputField)) {
      // Используем актуальное имя после переименования или старое, если отмена
      const currentName = targetElement.dataset.name;
      nameWrapper.innerHTML = originalContent.replace(oldName, currentName);
      // Перерендеринг - самый простой способ обновить все атрибуты
    }

    // Удаляем слушатели, чтобы не вызвать performRename дважды
    inputField.removeEventListener("blur", performRename);
    inputField.removeEventListener("keydown", handleKeyDown);
  }

  /**
   * Обработчик нажатия клавиш (для Enter и Escape)
   */
  function handleKeyDown(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      performRename();
    } else if (e.key === "Escape") {
      e.preventDefault();
      restoreElement();
    }
  }

  // Назначаем обработчики
  inputField.addEventListener("blur", performRename); // Выполнить при потере фокуса
  inputField.addEventListener("keydown", handleKeyDown);
}

// --- 4. ФУНКЦИЯ РЕНДЕРИНГА СПИСКА (FileList) ---

function renderFileList(path, containerId, viewMode) {
  const currentFolder = path.reduce((acc, key) => acc[key], fileStructure);
  const container = document.getElementById(containerId);
  container.innerHTML = "";

  container.className = `panel-content ${
    viewMode === "row" ? "file-list-row" : "file-list-grid"
  }`;

  const showUpLink = path.length > 1;

  // --- РЕЖИМ СТРОКИ (ТАБЛИЦА) ---
  if (viewMode === "row") {
    let html = `
            <table class="file-list-table">
                <thead>
                    <tr><th>Имя</th><th>Дата загрузки/Изменения</th><th>Размер</th></tr>
                </thead>
                <tbody>`;

    if (showUpLink) {
      html += `<tr class="file-row up-level-link" data-name=".." data-type="folder" data-panel="${containerId}">
                    <td class="file-name"><i class="icon folder-up-icon"></i> ..</td>
                    <td></td><td></td>
                </tr>`;
    }

    for (const [name, item] of Object.entries(currentFolder)) {
      if (typeof item === "object" && item.type) {
        const icon = item.type === "folder" ? "folder-icon" : "file-icon";
        const sizeDisplay = item.type === "folder" ? "-" : item.size;

        html += `<tr class="file-row" data-name="${name}" data-type="${item.type}" data-panel="${containerId}">
                    <td class="file-name"><i class="icon ${icon}"></i> ${name}</td>
                    <td>${item.date}</td>
                    <td>${sizeDisplay}</td>
                </tr>`;
      }
    }

    html += `</tbody></table>`;
    container.innerHTML = html;

    // Назначение слушателей (объединяем логику dblclick и contextmenu)
    container.querySelectorAll(".file-row").forEach((row) => {
      const rowLogic = (e) => {
        const name = row.dataset.name;
        const type = row.dataset.type;
        let currentPath = row.dataset.panel.includes("list-1")
          ? currentPath1
          : currentPath2;

        if (name === "..") {
          if (currentPath.length > 1) {
            currentPath = currentPath.slice(0, -1);
          }
        } else if (type === "folder") {
          currentPath = [...currentPath, name];
        }

        if (type === "folder") {
          window.navigateToFolder(currentPath, row.dataset.panel); // Используем глобальную функцию
        } else if (type === "file") {
          handleOpen(currentPath, name, type);
        }
      };

      row.addEventListener("dblclick", rowLogic);

      row.addEventListener("contextmenu", (e) => {
        let currentPath = row.dataset.panel.includes("list-1")
          ? currentPath1
          : currentPath2;
        window.showContextMenu(e, row, currentPath); // Используем глобальную функцию
      });
    });
  }
  // --- РЕЖИМ ПЛИТКИ (GRID) ---
  else if (viewMode === "tile") {
    let html = "";

    if (showUpLink) {
      html += `<div class="file-tile up-level-link" data-name=".." data-type="folder" data-panel="${containerId}">
                    <i class="icon folder-up-icon"></i>
                    <span class="tile-name">..</span>
                </div>`;
    }

    for (const [name, item] of Object.entries(currentFolder)) {
      if (typeof item === "object" && item.type) {
        const icon = item.type === "folder" ? "folder-icon" : "file-icon";

        html += `<div class="file-tile" data-name="${name}" data-type="${item.type}" data-panel="${containerId}">
                    <i class="icon ${icon}"></i>
                    <span class="tile-name">${name}</span>
                    </div>`;
      }
    }

    container.innerHTML = html;

    // Назначение слушателей для плиток
    container.querySelectorAll(".file-tile").forEach((tile) => {
      tile.addEventListener("dblclick", (e) => {
        const name = tile.dataset.name;
        const type = tile.dataset.type;
        let currentPath = tile.dataset.panel.includes("list-1")
          ? currentPath1
          : currentPath2;

        if (name === "..") {
          if (currentPath.length > 1) currentPath = currentPath.slice(0, -1);
        } else if (type === "folder") {
          currentPath = [...currentPath, name];
        }

        if (type === "folder") {
          window.navigateToFolder(currentPath, tile.dataset.panel);
        } else if (type === "file") {
          handleOpen(currentPath, name, type);
        }
      });

      tile.addEventListener("contextmenu", (e) => {
        let currentPath = tile.dataset.panel.includes("list-1")
          ? currentPath1
          : currentPath2;
        window.showContextMenu(e, tile, currentPath);
      });
    });
  }
}

// --- 5. ГЛОБАЛЬНЫЕ ФУНКЦИИ (доступны извне) ---

/**
 * Переход в новую папку и обновление интерфейса (вызывается из дерева и dblclick)
 */
window.navigateToFolder = function (newPath, panelId) {
  let viewMode;
  let pathRef;
  let header;

  if (panelId.includes("list-1")) {
    currentPath1 = newPath;
    pathRef = currentPath1;
    viewMode = viewMode1;
    header = "#list-panel-1 .panel-header";
  } else if (panelId.includes("list-2")) {
    currentPath2 = newPath;
    pathRef = currentPath2;
    viewMode = viewMode2;
    header = "#list-panel-2 .panel-header";
  }

  document.querySelector(
    header
  ).textContent = `Содержимое папки: /${pathRef.join("/")}`;
  renderFileList(pathRef, panelId, viewMode);

  document.querySelector(
    header
  ).textContent = `Содержимое папки: /${pathRef.join("/")}`;
  renderFileList(pathRef, panelId, viewMode);

  window.renderFileTree(fileStructure, newPath);

  // !!! НОВОЕ: Активируем панель после перехода
  setActivePanel(panelId);

  // Используем глобальную функцию renderFileTree, определенную в FileTree.js
  window.renderFileTree(fileStructure, newPath);
};

/**
 * Переключение режима вида (строка/плитка)
 */
window.toggleView = function (view, panelId) {
  if (panelId === "file-list-1") {
    viewMode1 = view;
    window.navigateToFolder(currentPath1, panelId);
  } else if (panelId === "file-list-2") {
    viewMode2 = view;
    window.navigateToFolder(currentPath2, panelId);
  }
};

/**
 * Устанавливает активную панель списка и обновляет кнопки тулбара.
 * @param {string} listId - ID контейнера списка ('file-list-1' или 'file-list-2')
 */
function setActivePanel(listId) {
  activeListId = listId;

  // 1. Управляем CSS классом 'active'
  document.querySelectorAll(".right-panel").forEach((panel) => {
    panel.classList.remove("active");
  });

  // Находим родительский .right-panel по ID списка
  const panelContainer = document
    .getElementById(listId)
    .closest(".right-panel");
  if (panelContainer) {
    panelContainer.classList.add("active");
  }

  // 2. Обновляем кнопки тулбара, чтобы они отражали текущий вид активного окна
  const viewMode = listId === "file-list-1" ? viewMode1 : viewMode2;
  const viewRowBtn = document.getElementById("view-row-btn");
  const viewTileBtn = document.getElementById("view-tile-btn");

  viewRowBtn.classList.toggle("active", viewMode === "row");
  viewTileBtn.classList.toggle("active", viewMode === "tile");
}

// --- 6. ИНИЦИАЛИЗАЦИЯ (ВЫПОЛНЯЕТСЯ ПРИ ЗАГРУЗКЕ СТРАНИЦЫ) ---

window.addEventListener("load", async () => {
  // --- A. Подготовка интерфейса и загрузка данных ---

  // 1. Показываем, что данные загружаются
  document.getElementById("file-tree").innerHTML = "Загрузка структуры...";
  document.querySelector("#list-panel-1 .panel-header").textContent =
    "Загрузка содержимого...";
  document.querySelector("#list-panel-2 .panel-header").textContent =
    "Загрузка содержимого...";

  // 2. Асинхронно получаем данные
  await fetchDataFromApi();

  // 3. Устанавливаем начальные пути (показываем Classic_portrait и Egypt)
  currentPath1 = ["Upload", "Portrait", "Classic_portrait"];
  currentPath2 = ["Upload", "Portrait", "Egypt"];

  // 4. После получения данных, инициализируем отображение
  window.navigateToFolder(currentPath1, "file-list-1");
  window.navigateToFolder(currentPath2, "file-list-2");

  // --- B. Логика панели инструментов (Toolbar) и Контекстного меню ---

  const mainContainer = document.querySelector(".file-manager-main");
  const splitVerticalBtn = document.getElementById("split-vertical-btn");
  const splitHorizontalBtn = document.getElementById("split-horizontal-btn");
  const listPanel2 = document.getElementById("list-panel-2");

  // Функция переключения разделения
  function toggleSplit(type) {
    if (type === "vertical") {
      mainContainer.classList.remove("horizontal-split");
      mainContainer.classList.add("vertical-split");
      splitVerticalBtn.classList.add("active");
      splitHorizontalBtn.classList.remove("active");
    } else if (type === "horizontal") {
      mainContainer.classList.remove("vertical-split");
      mainContainer.classList.add("horizontal-split");
      splitHorizontalBtn.classList.add("active");
      splitVerticalBtn.classList.remove("active");
    }
    listPanel2.classList.remove("hidden");
  }

  // Слушатели событий разделения
  splitVerticalBtn.addEventListener("click", () => toggleSplit("vertical"));
  splitHorizontalBtn.addEventListener("click", () => toggleSplit("horizontal"));

  // Слушатели событий переключения вида
  const viewRowBtn = document.getElementById("view-row-btn");
  const viewTileBtn = document.getElementById("view-tile-btn");

  viewRowBtn.addEventListener("click", () => {
    window.toggleView("row", activeListId);
    viewRowBtn.classList.add("active");
    viewTileBtn.classList.remove("active");
  });

  viewTileBtn.addEventListener("click", () => {
    window.toggleView("tile", activeListId);
    viewTileBtn.classList.add("active");
    viewRowBtn.classList.remove("active");
  });

  // --- C. Контекстное меню ---
  const menu = document.getElementById("context-menu");

  window.showContextMenu = function (e, targetElement, path) {
    e.preventDefault();
    menu.style.top = `${e.clientY}px`;
    menu.style.left = `${e.clientX}px`;
    menu.classList.remove("hidden");

    menu.dataset.targetName = targetElement.dataset.name;
    menu.dataset.targetType = targetElement.dataset.type;
    menu.dataset.targetPath = JSON.stringify(path);
  };

  menu.addEventListener("click", (e) => {
    const action = e.target.dataset.action;
    const name = menu.dataset.targetName;
    const path = JSON.parse(menu.dataset.targetPath);

    // Находим элемент, на котором был вызван клик (строка или плитка)
    // Для этого нужно найти элемент по атрибутам data-name и data-type в активном контейнере
    const activeContainerId = activeListId; // ID контейнера списка, где был клик
    const targetElement = document
      .getElementById(activeContainerId)
      .querySelector(
        `[data-name="${name}"][data-type="${menu.dataset.targetType}"]`
      );

    if (action === "open") handleOpen(path, name, menu.dataset.targetType);
    if (action === "delete") handleDelete(path, name);
    // ... handleRename ...
    if (action === "rename" && targetElement) {
      // !!! НОВЫЙ БЛОК
      // Предотвращаем переименование ссылки ".."
      if (name !== "..") {
        initializeRename(path, name, targetElement);
      }
    }
    menu.classList.add("hidden");
  });

  // Скрытие меню при клике вне его
  document.addEventListener("click", () => {
    menu.classList.add("hidden");
  });

  // --- D. Добавление слушателей кликов на панели ---

  // Получаем контейнеры списков
  const listContainer1 = document.getElementById("file-list-1");
  const listContainer2 = document.getElementById("file-list-2");

  // При клике на любой элемент внутри списка, активируем его
  listContainer1.addEventListener("click", () => setActivePanel("file-list-1"));
  listContainer2.addEventListener("click", () => setActivePanel("file-list-2"));

  window.navigateToFolder(currentPath1, "file-list-1");
  window.navigateToFolder(currentPath2, "file-list-2");
  setActivePanel("file-list-1"); // Явно устанавливаем активной Панель 1 при загрузке.

  // --- E. Логика переключения тем ---

  const themeToggleBtn = document.getElementById("theme-toggle-btn");
  const themeNameSpan = document.getElementById("theme-name");
  const body = document.body;

  /**
   * Устанавливает тему, сохраняет ее в localStorage и обновляет текст кнопки.
   * @param {string} theme - 'light' или 'dark'
   */
  function setTheme(theme) {
    if (theme === "dark") {
      body.classList.add("dark-theme");
      localStorage.setItem("theme", "dark");
      themeNameSpan.textContent = "Темная тема";
    } else {
      body.classList.remove("dark-theme");
      localStorage.setItem("theme", "light");
      themeNameSpan.textContent = "Светлая тема";
    }
  }

  // Проверка localStorage при загрузке
  const savedTheme = localStorage.getItem("theme") || "light";
  setTheme(savedTheme);

  // Обработчик клика
  themeToggleBtn.addEventListener("click", () => {
    const currentTheme = body.classList.contains("dark-theme")
      ? "dark"
      : "light";
    const newTheme = currentTheme === "light" ? "dark" : "light";
    setTheme(newTheme);
  });
});
