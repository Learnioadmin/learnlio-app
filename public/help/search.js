(function () {
  function byText(hay, needle) {
    return hay.toLowerCase().indexOf(needle) !== -1;
  }

  function getQuery() {
    try {
      const u = new URL(window.location.href);
      return (u.searchParams.get("q") || "").trim();
    } catch (e) {
      return "";
    }
  }

  function renderResults(list, q) {
    const resultsEl = document.getElementById("searchResults");
    const countEl = document.getElementById("searchCount");
    const noEl = document.getElementById("noResults");

    if (!resultsEl) return;

    resultsEl.innerHTML = "";

    if (!q) {
      if (countEl) countEl.textContent = "";
      if (noEl) noEl.style.display = "none";
      resultsEl.style.display = "none";
      return;
    }

    resultsEl.style.display = "grid";
    if (countEl) countEl.textContent = list.length ? ("" + list.length + " result" + (list.length === 1 ? "" : "s")) : "0 results";

    if (!list.length) {
      if (noEl) noEl.style.display = "block";
      return;
    }

    if (noEl) noEl.style.display = "none";

    list.forEach(function (item) {
      const card = document.createElement("a");
      card.className = "help-card";
      card.href = item.url;

      const title = document.createElement("div");
      title.className = "help-card-title";
      title.textContent = item.title;

      const meta = document.createElement("div");
      meta.className = "help-card-meta";
      meta.textContent = item.category;

      const summary = document.createElement("div");
      summary.className = "help-card-summary";
      summary.textContent = item.summary;

      card.appendChild(title);
      card.appendChild(meta);
      card.appendChild(summary);
      resultsEl.appendChild(card);
    });
  }

  function filterArticles(query) {
    const q = (query || "").trim().toLowerCase();
    if (!q) return [];

    const items = window.HELP_ARTICLES || [];

    return items.filter(function (a) {
      const hay = [a.title, a.summary, (a.keywords || []).join(" ")].join(" ").toLowerCase();
      return byText(hay, q);
    });
  }

  function init() {
    const input = document.getElementById("helpSearchInput");
    if (!input) return;

    const q = getQuery();
    if (q) {
      input.value = q;
      renderResults(filterArticles(q), q);
    }

    input.addEventListener("input", function () {
      const val = input.value;
      renderResults(filterArticles(val), val.trim());
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
