//admin-ui.js

const ALLOWED_EXTENSIONS = [
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif", // Изображения
  "mp4",
  "webm",
  "mov",
  "avi",
  "mkv", // Видео
];

// ==== Toast Notifications ====
function showToast(
  message,
  type = "info",
  actionLabel = null,
  actionFn = null,
  autoHide = true
) {
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  const messageSpan = document.createElement("span");
  messageSpan.textContent = message;
  toast.appendChild(messageSpan);

  // если есть кнопка действия
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
  } // Крестик добавляется, если есть кнопка действия (Отменить) ИЛИ если таймер не отключен явно (false)

  // 3. ДОБАВЛЯЕМ КРЕСТИК ЗАКРЫТИЯ (Ручной контроль)
  if ((actionLabel && actionFn) || autoHide !== false) {
    const closeBtn = document.createElement("button");
    closeBtn.textContent = "×"; // Символ крестика
    closeBtn.className = "toast-close-btn";
    closeBtn.style.cssText =
      "margin-left: 12px; cursor: pointer; border: none; background: none; color: white; font-size: 1.2em;";

    closeBtn.addEventListener("click", () => {
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 300); // Плавное исчезновение
    });
    toast.appendChild(closeBtn);
  }

  document.body.appendChild(toast);

  // плавное появление
  setTimeout(() => toast.classList.add("show"), 10);

  // 4. АВТОИСЧЕЗНОВЕНИЕ (Гибкий таймер)
  if (autoHide) {
    // Определяем задержку: 7000 мс, если autoHide === true, или заданное число
    const delay = typeof autoHide === "number" ? autoHide : 3000;
    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 300);
    }, delay);
  }
}

/**
 * Проверяет имя на наличие запрещенных символов (кроме пробела).
 * Точка ('.') включена в этот набор, чтобы запретить ее для папок.
 */
function containsForbiddenChars(name) {
  // Ищем: / \ : * ? " < > | . (без пробела)
  const forbidden = /[\\/:*?"<>|.]/;
  return forbidden.test(name);
}

document.addEventListener("DOMContentLoaded", () => {
  // создать папку
  document.getElementById("btnMkdir").addEventListener("click", async () => {
    const inputElement = document.getElementById("mkdirName"); // <-- Получаем элемент
    const name = inputElement.value.trim();
    if (!name) return showToast("Enter folder name!", "warning"); // Выполняем действие

    // Строгая проверка: запрет точки и спецсимволов.
    if (containsForbiddenChars(name)) {
      return showToast(
        'Folder name must not contain the following characters: / \ : * ? " < > | and a dot (.).',
        "warning"
      );
    }

    const success = await createFolder(name);

    // ✅ ДОБАВЛЕНИЕ: Если создание прошло успешно, очищаем поле
    if (success) {
      inputElement.value = "";
    }
  });

  // загрузить файл
  document.getElementById("btnUpload").addEventListener("click", async () => {
    const fileInput = document.getElementById("fileInput");
    if (!fileInput.files.length) return showToast("Select a file!", "warning");
    await uploadFile(fileInput.files[0]);
  });

  // переименовать
  document.getElementById("btnRename").addEventListener("click", async () => {
    const oldName = document.getElementById("renameOld").value.trim();
    const newName = document.getElementById("renameNew").value.trim();
    if (!oldName || !newName) return showToast("Specify names!", "warning");

    // ⚡️ ДОБАВЛЕНИЕ: Проверка, чтобы не добавить точку, если это папка
    const isFile = oldName.includes("."); // Простая эвристика: если старое имя содержит точку, это файл.

    // 1. Проверяем на все критически запрещенные символы (кроме точки и пробела)
    const coreForbiddenPattern = /[\/:*?"<>|]/;

    if (coreForbiddenPattern.test(newName)) {
      return showToast(
        'New name contains prohibited characters: / \ : * ? " < > |',
        "warning"
      );
    }

    if (isFile) {
      // ⚡️ ИСПРАВЛЕНИЕ: Проверяем расширение только если пользователь ввел точку
      if (newName.includes(".")) {
        // Проверяем, что расширение находится в 'белом списке'
        const newExt = newName
          .substring(newName.lastIndexOf(".") + 1)
          .toLowerCase();

        if (!ALLOWED_EXTENSIONS.includes(newExt)) {
          return showToast(
            `Недопустимое расширение: .${newExt}. Разрешены: ${ALLOWED_EXTENSIONS.join(
              ", "
            )}`,
            "warning"
          );
        }
      } // Конец: if (newName.includes("."))

      // ИЛИ if (newName.startsWith(".")) (следующая проверка)
    } // 2. Специальная проверка на точки: (ЭТОТ БЛОК НИЖЕ ОСТАВЛЯЕМ КАК ЕСТЬ)

    if (!isFile && newName.includes(".")) {
      // Элемент — ПАПКА. Точки запрещены.
      return showToast("Folder name cannot contain a dot (.).", "warning");
    }

    if (isFile && newName.startsWith(".")) {
      // Элемент — ФАЙЛ. Не может начинаться с точки.
      return showToast("File name cannot start with a dot (.).", "warning");
    }

    await renameItem(oldName, newName);
  });

  // удалить
  document.getElementById("btnDelete").addEventListener("click", async () => {
    const name = document.getElementById("deleteName").value.trim();
    if (!name) return showToast("Enter a name to delete!", "warning");
    await deleteItem(name);
  });

  // восстановить
  document.getElementById("btnRestore").addEventListener("click", async () => {
    await restoreItem();
  });

  /* ================================== */
  /* Выезжающая панель (мобилка)       */
  /* ================================== */
  const drawerBtn = document.querySelector(".admin-drawer-btn");
  const explorer = document.querySelector(".admin-explorer");
  const drawerClose = document.querySelector(".admin-drawer-close");

  function closeDrawer() {
    explorer.classList.remove("is-open");
  }

  if (drawerBtn && explorer) {
    drawerBtn.addEventListener("click", () => {
      explorer.classList.add("is-open");
    });

    drawerClose.addEventListener("click", () => {
      closeDrawer();
    });
  }

  // Обертка: выполняет действие, логирует и обновляет UI
  async function safeAction(label, fn) {
    try {
      const result = await fn();
      console.log(`✅ ${label} успешно:`, result);
      showToast(`${label}: выполнено`, "success");
      if (typeof renderPortfolio === "function") {
        await renderPortfolio();
      }
    } catch (err) {
      console.error(`❌ ${label} ошибка:`, err);
      showToast(`${label}: ошибка`, "error");
    }
  }
});
