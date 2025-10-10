//error-handler.js

// Ловим необработанные ошибки в промисах
window.addEventListener("unhandledrejection", (event) => {
    console.error("⚠️ Unhandled Promise rejection:", event.reason);
    // Можно ещё отправить ошибку на сервер для логов:
    fetch("/log-error", { 
       method: "POST", 
       body: JSON.stringify({ error: String(event.reason) }) 
     });
  });
  