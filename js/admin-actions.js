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

  // 🔐 Подтверждение перед удалением
  const ok = window.confirm(`Delete "${name}"?\nThis action cannot be undone.`);
  if (!ok) {
    showToast?.("Deletion cancelled", "info");
    return false;
  }

  console.log("[deleteItem] name:", name);
  console.log("[deleteItem] basePath:", basePath);
  console.log("[deleteItem] targetPath:", targetPath);

  try {
    const res = await fetch("/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetPath }),
    });

    // чуть более подробная обработка, чем просто handleResponse
    if (!res.ok) {
      let text = "";
      try {
        text = await res.text();
      } catch (_) {}
      console.error("[deleteItem] server error:", res.status, text);
      throw new Error(`HTTP ${res.status}${text ? ": " + text : ""}`);
    } else {
      try {
        await res.json().catch(() => ({}));
      } catch (_) {}
    }

    if (typeof window.renderPortfolio === "function") {
      await window.renderPortfolio();
      if (typeof window.hidePreview === "function") window.hidePreview();
    }

    lastDeletedItem = { name, path: targetPath, basePath };

    const inputDeleteName = document.getElementById("deleteName");
    if (inputDeleteName) {
      inputDeleteName.value = "";
    }
    if (typeof window.selectedFileName !== "undefined") {
      window.selectedFileName = null;
    }

    showToast(
      `Element "${name}" has been removed`,
      "warning",
      "Cancel",
      restoreItem,
      7000
    );
    return true;
  } catch (e) {
    console.error("[deleteItem] failed:", e);
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
