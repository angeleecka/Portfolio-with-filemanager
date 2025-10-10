// js/header.js
(() => {
  if (window.__headerInitDone) return;
  window.__headerInitDone = true;

  document.addEventListener(
    "DOMContentLoaded",
    () => {
      const header = document.querySelector("#header");
      // не активируем sticky, если админка ИЛИ явно запретили
      // Админка есть? да. Но бургер всё равно должен работать.
      const isAdmin = !!document.querySelector(".admin-body");
      const headerEl = document.querySelector("#header");
      if (!header || isAdmin || header.hasAttribute("data-no-sticky")) return;

      // --- режимы: hero / trigger / solid ---
      const heroEl = document.querySelector("#hero");
      const triggerEl = document.querySelector("#sticky-trigger");
      const mode = heroEl ? "hero" : triggerEl ? "trigger" : "solid";

      // helperы для переключения классов (общая анимация/фон у тебя уже в CSS)
      const setStickyOn = () => headerEl.classList.add("sticky", "visible");
      const setStickyOff = () => {
        headerEl.classList.remove("visible");
        headerEl.addEventListener(
          "transitionend",
          () => {
            if (!headerEl.classList.contains("visible"))
              headerEl.classList.remove("sticky");
          },
          { once: true }
        );
      };

      // --- 1) Липкий хедер по сценариям ---
      if (!isAdmin) {
        if (mode === "hero" || mode === "trigger") {
          const observed = mode === "hero" ? heroEl : triggerEl;
          const io = new IntersectionObserver(
            (entries) => {
              entries.forEach((entry) => {
                if (!entry.isIntersecting) setStickyOn();
                else setStickyOff();
              });
            },
            {
              // Чуть «подтягиваем» момент срабатывания, чтобы переход выглядел естественно
              threshold: 0,
              rootMargin: "0px 0px 0px 0px",
            }
          );
          if (observed) io.observe(observed);
          // на случай, если пользователь перезагрузил страницу уже прокрученной:
          requestAnimationFrame(() => {
            if (mode === "hero" && window.scrollY > (heroEl?.offsetHeight || 0))
              setStickyOn();
            if (
              mode === "trigger" &&
              window.scrollY > (triggerEl?.getBoundingClientRect().top || 0)
            )
              setStickyOn();
          });
        } else {
          // solid: липкий сразу, а «компактность» добавляем после небольшой прокрутки
          setStickyOn();
          window.addEventListener(
            "scroll",
            () => {
              // можешь включить/использовать .scrolled в CSS, если нужно
              headerEl.classList.toggle("scrolled", window.scrollY > 10);
            },
            { passive: true }
          );
        }
      }
      // --- 2) Мобильное меню (бургер) ---
      const navToggle = headerEl.querySelector(".nav-toggle");
      const navMenu = headerEl.querySelector("nav");

      if (navToggle && navMenu) {
        navToggle.addEventListener("click", () => {
          navMenu.classList.toggle("is-open");
          navToggle.classList.toggle("open");
        });
        // клик вне меню — закрыть
        document.addEventListener("click", (evt) => {
          const insideMenu = navMenu.contains(evt.target);
          const onToggle = navToggle.contains(evt.target);
          if (
            !insideMenu &&
            !onToggle &&
            navMenu.classList.contains("is-open")
          ) {
            navMenu.classList.remove("is-open");
            navToggle.classList.remove("open");
          }
        });
        // переход по якорям — закрыть меню (мобайл UX)
        navMenu.addEventListener("click", (evt) => {
          const a = evt.target.closest("a");
          if (!a) return;
          if (a.getAttribute("href")?.includes("#")) {
            navMenu.classList.remove("is-open");
            navToggle.classList.remove("open");
          }
        });
      }

      // --- 3) Подсветка активной ссылки (учитываем index.html по умолчанию) ---
      if (!isAdmin) {
        const current =
          window.location.pathname.split("/").pop() || "index.html";
        headerEl.querySelectorAll("nav a").forEach((link) => {
          const linkPath = link.getAttribute("href");
          if (!linkPath) return;
          const linkFile = linkPath.split("#")[0]; // игнорируем якорь
          if (
            linkFile === current ||
            (linkFile === "index.html" && current === "")
          ) {
            link.classList.add("active-link");
          }
        });
      }
    },
    { once: true }
  );
})();
