(() => {
  const menuButton = document.querySelector(".menu-toggle");
  const nav = document.querySelector("#site-nav");

  if (menuButton && nav) {
    const closeMenu = () => {
      nav.classList.remove("is-open");
      menuButton.setAttribute("aria-expanded", "false");
      menuButton.textContent = "Menu";
    };

    menuButton.addEventListener("click", () => {
      const open = nav.classList.toggle("is-open");
      menuButton.setAttribute("aria-expanded", String(open));
      menuButton.textContent = open ? "Close" : "Menu";
    });

    nav.addEventListener("click", (event) => {
      const target = event.target;
      if (target instanceof Element && target.closest("a")) closeMenu();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeMenu();
    });
  }

  const copyButton = document.querySelector(".copy-button");
  const copySource = document.querySelector("#install-command");

  if (copyButton && copySource) {
    copyButton.addEventListener("click", async () => {
      const text = copySource.textContent.trim();
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        const area = document.createElement("textarea");
        area.value = text;
        area.setAttribute("readonly", "");
        area.style.position = "fixed";
        area.style.opacity = "0";
        document.body.append(area);
        area.select();
        document.execCommand("copy");
        area.remove();
      }
      copyButton.textContent = "Copied";
      window.setTimeout(() => {
        copyButton.textContent = "Copy";
      }, 1800);
    });
  }

  const starNodes = document.querySelectorAll("[data-github-stars]");
  if (starNodes.length > 0) {
    const cacheKey = "ocm.github.stars.v1";
    const blockedKey = "ocm.github.stars.blocked.v1";
    const FRESH_MS = 24 * 60 * 60 * 1000;
    const RETRY_MS = 60 * 60 * 1000;
    const FAIL_MS = 15 * 60 * 1000;
    const render = (count) => {
      const safe = Math.max(0, Math.min(10_000_000, Math.floor(count)));
      const compact = new Intl.NumberFormat("en", {
        notation: "compact",
        maximumFractionDigits: 1,
      }).format(safe);
      starNodes.forEach((node) => {
        node.textContent = compact;
        node.title = `${safe.toLocaleString("en-US")} GitHub stars`;
      });
    };
    const readCache = () => {
      try {
        const cached = JSON.parse(localStorage.getItem(cacheKey) || "null");
        const count = cached?.count;
        const at = cached?.at;
        const now = Date.now();
        if (
          Number.isFinite(count) &&
          count >= 0 &&
          count <= 10_000_000 &&
          Number.isFinite(at) &&
          at > 0 &&
          at <= now
        ) {
          render(count);
          return { count, at };
        }
      } catch {
        // localStorage can be unavailable in private contexts
      }
      return null;
    };
    const readBlockedUntil = () => {
      try {
        const value = Number(localStorage.getItem(blockedKey));
        return Number.isFinite(value) && value > Date.now() ? value : 0;
      } catch {
        return 0;
      }
    };
    const block = (ms) => {
      try {
        localStorage.setItem(blockedKey, String(Date.now() + ms));
      } catch {
        // the in-memory page still avoids a retry loop
      }
    };
    const cached = readCache();
    if (!cached || Date.now() - cached.at >= FRESH_MS) {
      // GitHub's unauthenticated API allows 60 requests per hour per IP. Use a
      // long cache, keep the stale count visible, and back off after 403/429.
      if (!readBlockedUntil()) {
        const controller = new AbortController();
        const timer = window.setTimeout(() => controller.abort(), 5000);
        fetch("https://api.github.com/repos/Aetherdz/opencode-mobile", {
          headers: { accept: "application/vnd.github+json" },
          credentials: "omit",
          referrerPolicy: "no-referrer",
          signal: controller.signal,
        })
          .then((response) => {
            if (response.status === 403 || response.status === 429) {
              block(RETRY_MS);
              return null;
            }
            return response.ok ? response.json() : null;
          })
          .then((repo) => {
            if (!repo || !Number.isFinite(repo.stargazers_count)) return;
            render(repo.stargazers_count);
            try {
              localStorage.setItem(
                cacheKey,
                JSON.stringify({ count: repo.stargazers_count, at: Date.now() }),
              );
              localStorage.removeItem(blockedKey);
            } catch {
              // the count still renders for this page view
            }
          })
          .catch(() => {
            // Keep the last known count and do not hammer the API.
            block(FAIL_MS);
          })
          .finally(() => window.clearTimeout(timer));
      }
    }
  }

  const year = document.querySelector("#year");
  if (year) year.textContent = String(new Date().getFullYear());
})();
