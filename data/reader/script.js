// --- 1. Метрики и Константы ---
const BOOK_CONTAINER = document.getElementById("book-content");
const SOURCE_TEXT = document.getElementById("source-text").value;

// Получаем стили из CSS
const style = getComputedStyle(document.documentElement);
const PAGE_WIDTH = parseFloat(style.getPropertyValue("--page-width"));
const PAGE_HEIGHT = parseFloat(style.getPropertyValue("--page-height"));
const PADDING = parseFloat(style.getPropertyValue("--padding"));
const FONT_SIZE = parseFloat(style.getPropertyValue("--font-size"));
const LINE_HEIGHT_FACTOR = parseFloat(
  style.getPropertyValue("--line-height-factor")
);

// Вычисляемые метрики
const LINE_HEIGHT = FONT_SIZE * LINE_HEIGHT_FACTOR;
const AVAILABLE_WIDTH = PAGE_WIDTH - PADDING * 2;
const AVAILABLE_HEIGHT = PAGE_HEIGHT - PADDING * 2;
const MAX_LINES = Math.floor(AVAILABLE_HEIGHT / LINE_HEIGHT);
const FONT_STYLE = `${FONT_SIZE}px serif`; // Должен совпадать с CSS

// Создаем Canvas для точного измерения ширины текста
const canvas = document.createElement("canvas");
const ctx = canvas.getContext("2d");
ctx.font = FONT_STYLE;

/**
 * Сохраняет позицию курсора/выделения.
 * @returns {{globalIndex: number, offset: number}}
 */
function saveCursorPosition() {
  const selection = window.getSelection();
  if (selection.rangeCount === 0) return null;

  const range = selection.getRangeAt(0);
  const container = range.startContainer;
  const pageElement = container.closest(".page");

  if (!pageElement) return null;

  // Глобальный индекс страницы в массиве ALL_PAGES
  const pageElementsVisible = Array.from(
    BOOK_CONTAINER.querySelectorAll(".page")
  );
  let pageRelativeIndex = pageElementsVisible.indexOf(pageElement);
  let globalIndex = currentPageIndex + pageRelativeIndex;

  // Вычисляем смещение (сколько символов до курсора)
  const preCaretRange = range.cloneRange();
  preCaretRange.selectNodeContents(pageElement);
  preCaretRange.setEnd(range.startContainer, range.startOffset);

  const offset = preCaretRange.toString().length;

  return { globalIndex, offset };
}

/**
 * Восстанавливает позицию курсора после ререндеринга.
 * @param {{globalIndex: number, offset: number}} savedPos
 */
function restoreCursorPosition(savedPos) {
  if (!savedPos) return;

  // Если курсор был на странице, которая теперь не видна (из-за переполнения), перелистываем к ней.
  if (
    savedPos.globalIndex !== currentPageIndex &&
    savedPos.globalIndex !== currentPageIndex + 1
  ) {
    const step = window.innerWidth > 900 ? 2 : 1;
    currentPageIndex = Math.floor(savedPos.globalIndex / step) * step;
    renderPages();
  }

  // Находим нужный элемент страницы
  const pageElements = Array.from(BOOK_CONTAINER.querySelectorAll(".page"));
  const targetPageIndex = savedPos.globalIndex - currentPageIndex;
  const targetPage = pageElements[targetPageIndex];

  if (!targetPage) return;

  // Обход текстовых узлов для восстановления курсора
  let currentOffset = 0;
  let targetNode = null;
  let targetOffset = 0;

  function findNodeAndOffset(node) {
    if (node.nodeType === 3) {
      // TEXT_NODE
      const len = node.nodeValue.length;
      if (currentOffset + len >= savedPos.offset) {
        targetNode = node;
        targetOffset = savedPos.offset - currentOffset;
        return true;
      }
      currentOffset += len;
    }
    for (let i = 0; i < node.childNodes.length; i++) {
      if (findNodeAndOffset(node.childNodes[i])) return true;
    }
    return false;
  }

  findNodeAndOffset(targetPage);

  if (targetNode) {
    const selection = window.getSelection();
    const range = document.createRange();
    range.setStart(targetNode, targetOffset);
    range.collapse(true);

    selection.removeAllRanges();
    selection.addRange(range);

    targetPage.focus();
  }
}

// --- 2. Функция разбивки текста (Word Wrapping) ---

/**
 * Разбивает полный текст на страницы и строки с помощью Canvas API
 * для точного измерения ширины.
 * @param {string} text - Весь текст книги.
 * @returns {Array<string>} Массив строк, где каждый элемент — текст страницы.
 */
function paginateText(text) {
  const pages = [];
  const paragraphs = text.split("\n\n"); // Разбиваем на абзацы
  let currentLines = [];
  let lineCount = 0;

  for (const paragraph of paragraphs) {
    if (!paragraph.trim()) continue;

    // Разбиваем абзац на строки, точно измеряя ширину
    const words = paragraph.split(" ");
    let currentLine = "";

    for (let i = 0; i < words.length; i++) {
      const testLine = currentLine ? currentLine + " " + words[i] : words[i];
      const testWidth = ctx.measureText(testLine).width;

      if (testWidth > AVAILABLE_WIDTH && currentLine.length > 0) {
        // Строка переполнилась, добавляем предыдущую строку
        if (lineCount >= MAX_LINES) {
          // Страница переполнена, сохраняем и начинаем новую
          pages.push(currentLines.join("\n"));
          currentLines = [];
          lineCount = 0;
        }
        currentLines.push(currentLine);
        lineCount++;

        // Начинаем новую строку с текущего слова
        currentLine = words[i];
      } else {
        // Продолжаем строку
        currentLine = testLine;
      }
    }

    // Добавляем последнюю строку абзаца
    if (currentLine) {
      if (lineCount >= MAX_LINES) {
        pages.push(currentLines.join("\n"));
        currentLines = [];
        lineCount = 0;
      }
      currentLines.push(currentLine);
      lineCount++;
    }

    // Добавляем пустую строку между абзацами, если есть место
    if (lineCount < MAX_LINES) {
      currentLines.push("");
      lineCount++;
    } else {
      pages.push(currentLines.join("\n"));
      currentLines = [""];
      lineCount = 1;
    }
  }

  // Добавляем последнюю страницу, если она не пуста
  if (currentLines.length > 0) {
    pages.push(currentLines.join("\n"));
  }

  return pages;
}

// --- 3. Рендеринг и Отображение ---

let ALL_PAGES = [];
let currentPageIndex = 0;

/**
 * Отрисовывает две страницы (или одну на мобильных)
 */
function renderPages() {
  BOOK_CONTAINER.innerHTML = "";

  // Левая страница (текущая)
  const leftPageIndex = currentPageIndex;
  const leftPage = document.createElement("div");
  leftPage.className = "page left-page";
  leftPage.setAttribute("contenteditable", "true");
  leftPage.innerText = ALL_PAGES[leftPageIndex] || "";
  BOOK_CONTAINER.appendChild(leftPage);

  // Правая страница (следующая) - скрываем на мобильных с помощью CSS
  const rightPageIndex = currentPageIndex + 1;
  if (rightPageIndex < ALL_PAGES.length) {
    const rightPage = document.createElement("div");
    rightPage.className = "page right-page";
    rightPage.setAttribute("contenteditable", "true");
    rightPage.innerText = ALL_PAGES[rightPageIndex] || "";
    BOOK_CONTAINER.appendChild(rightPage);
  }

  updatePageInfo();
  attachEditListeners();
}

/**
 * Обновляет информацию о текущей странице
 */
function updatePageInfo() {
  const totalPages = ALL_PAGES.length;
  let visiblePages = totalPages > 1 && window.innerWidth > 900 ? 2 : 1;
  if (totalPages === 0) {
    document.getElementById("page-info").innerText = "0 / 0";
  } else {
    document.getElementById("page-info").innerText = `${currentPageIndex + 1}${
      visiblePages === 2 ? "-" + (currentPageIndex + 2) : ""
    } / ${totalPages}`;
  }
}

// --- 4. Интерактивность и Перелистывание ---

/**
 * Навигация: Перелистывание вперед и назад
 */
function handleNavigation(direction) {
  const step = window.innerWidth > 900 ? 2 : 1; // Шаг 2 для десктопа, 1 для мобильных

  if (direction === "next" && currentPageIndex + step < ALL_PAGES.length) {
    currentPageIndex += step;
  } else if (direction === "prev" && currentPageIndex - step >= 0) {
    currentPageIndex -= step;
  }
  renderPages();
}

document
  .getElementById("next-page")
  .addEventListener("click", () => handleNavigation("next"));
document
  .getElementById("prev-page")
  .addEventListener("click", () => handleNavigation("prev"));

/**
 * Обработка ввода (Edit Listener) с сохранением курсора.
 */
function attachEditListeners() {
  document.querySelectorAll(".page").forEach((page) => {
    page.addEventListener("input", () => {
      // 1. Сохраняем позицию курсора ДО перерендеринга
      const savedPos = saveCursorPosition();

      // 2. Собираем весь текст из всех текущих страниц
      let newText = "";
      document.querySelectorAll(".page").forEach((p) => {
        newText += p.innerText + "\n\n"; // Используем '\n\n' для разделения абзацев
      });

      // 3. Переразбиваем весь текст метрическим способом
      ALL_PAGES = paginateText(newText.trim());

      // 4. Перерисовываем страницы
      renderPages();

      // 5. Восстанавливаем курсор, чтобы продолжить ввод
      restoreCursorPosition(savedPos);
    });
  });
}

// --- Инициализация ---
function init() {
  ALL_PAGES = paginateText(SOURCE_TEXT);
  renderPages();
}

init();
