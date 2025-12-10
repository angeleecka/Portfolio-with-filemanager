// Используем fileStructure из FileOperations.js
// Предполагается, что fileStructure = { 'Upload': { ... } }

const treeContainer = document.getElementById("file-tree");
const ROOT_FOLDER_NAME = "Upload"; // Ограничение доступа

/**
 * Генерирует HTML для отображения подпапок
 * @param {object} folderContents - Содержимое текущей папки
 * @param {string[]} currentActivePath - Путь к папке, которую нужно выделить
 * @param {string[]} parentPath - Путь до текущего уровня
 * @returns {string} HTML-разметка для списка <ul>
 */
function buildTreeHTML(folderContents, currentActivePath, parentPath = []) {
  let html = '<ul class="tree-children">';

  // Сортируем: папки сначала, затем файлы (хотя в дереве только папки, но для надежности)
  const sortedEntries = Object.entries(folderContents).sort(
    ([nameA, itemA], [nameB, itemB]) => {
      if (itemA.type === "folder" && itemB.type !== "folder") return -1;
      if (itemA.type !== "folder" && itemB.type === "folder") return 1;
      return nameA.localeCompare(nameB);
    }
  );

  for (const [name, item] of sortedEntries) {
    // В дереве отображаем ТОЛЬКО папки
    if (item.type !== "folder") continue;

    const currentPath = [...parentPath, name];
    const isSelected =
      JSON.stringify(currentActivePath) === JSON.stringify(currentPath);

    // Папка всегда раскрыта, если это не самый нижний уровень (для простоты)
    const itemClass = `tree-item is-folder ${isSelected ? "selected" : ""}`;

    html += `<li class="${itemClass}" data-path="${currentPath.join("/")}">`;
    html += `<span class="folder-name">
                    <i class="icon folder-icon"></i> ${name}
                 </span>`;

    // Рекурсивный вызов для вложенных папок
    if (Object.keys(item).length > 0) {
      html += buildTreeHTML(item, currentActivePath, currentPath);
    }

    html += "</li>";
  }

  html += "</ul>";
  return html;
}

/**
 * Инициализирует и рендерит дерево папок
 * @param {object} structure - Полная структура данных
 * @param {string[]} activePath - Текущий активный путь для выделения
 */
function renderFileTree(structure, activePath) {
  if (!structure[ROOT_FOLDER_NAME]) {
    treeContainer.innerHTML = "<div>Ошибка: Папка Upload не найдена.</div>";
    return;
  }

  // Начальный корневой элемент 'Upload'
  const rootPath = [ROOT_FOLDER_NAME];
  const isRootSelected =
    JSON.stringify(activePath) === JSON.stringify(rootPath);

  let html = `<ul class="tree-root">`;
  html += `<li class="tree-item is-folder expanded ${
    isRootSelected ? "selected" : ""
  }" data-path="${ROOT_FOLDER_NAME}">`;
  html += `<span class="folder-name">
                <i class="icon folder-icon"></i> ${ROOT_FOLDER_NAME}/
             </span>`;

  // Рендерим вложенные элементы
  html += buildTreeHTML(structure[ROOT_FOLDER_NAME], activePath, rootPath);

  html += `</li></ul>`;
  treeContainer.innerHTML = html;

  // Назначаем обработчики кликов
  treeContainer.querySelectorAll(".folder-name").forEach((el) => {
    el.addEventListener("click", (e) => {
      const pathStr = e.currentTarget.closest(".tree-item").dataset.path;
      const newPath = pathStr.split("/");

      // Вызываем глобальную функцию перехода (которая определена в FileOperations)
      navigateToFolder(newPath, "list-panel-1"); // Переход в главной панели (1)

      // Сброс всех выделений и выделение нового
      treeContainer
        .querySelectorAll(".tree-item")
        .forEach((item) => item.classList.remove("selected"));
      e.currentTarget.closest(".tree-item").classList.add("selected");
    });
  });
}
