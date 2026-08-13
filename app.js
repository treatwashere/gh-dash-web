(function () {
  "use strict";

  var STORAGE_TOKEN = "ghdash_token";
  var STORAGE_SECTIONS = "ghdash_sections";

  var DEFAULT_SECTIONS = [
    { title: "My Pull Requests", type: "pr", query: "is:pr is:open author:@me" },
    { title: "Needs My Review", type: "pr", query: "is:pr is:open review-requested:@me" },
    { title: "My Issues", type: "issue", query: "is:issue is:open author:@me" },
    { title: "Assigned to Me", type: "issue", query: "is:issue is:open assignee:@me" }
  ];

  var state = {
    token: localStorage.getItem(STORAGE_TOKEN) || "",
    sections: loadSections(),
    activeIndex: 0,
    itemsCache: {},
    selected: {},
    loading: false
  };

  function loadSections() {
    try {
      var raw = localStorage.getItem(STORAGE_SECTIONS);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) return parsed;
      }
    } catch (e) {}
    return DEFAULT_SECTIONS.slice();
  }

  function saveSections() {
    localStorage.setItem(STORAGE_SECTIONS, JSON.stringify(state.sections));
  }

  function saveToken(tok) {
    state.token = tok;
    if (tok) localStorage.setItem(STORAGE_TOKEN, tok);
    else localStorage.removeItem(STORAGE_TOKEN);
  }

  function setStatus(msg) {
    document.getElementById("status-message").textContent = msg || "";
  }

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === "class") node.className = attrs[k];
        else if (k === "text") node.textContent = attrs[k];
        else node.setAttribute(k, attrs[k]);
      });
    }
    (children || []).forEach(function (c) { node.appendChild(c); });
    return node;
  }

  function renderTabs() {
    var nav = document.getElementById("section-tabs");
    nav.innerHTML = "";
    state.sections.forEach(function (section, i) {
      var count = state.itemsCache[i] ? state.itemsCache[i].length : null;
      var tab = el("div", { class: "section-tab" + (i === state.activeIndex ? " active" : "") });
      tab.textContent = section.title;
      if (count !== null) {
        var countSpan = el("span", { class: "count", text: String(count) });
        tab.appendChild(countSpan);
      }
      tab.addEventListener("click", function () { selectSection(i); });
      nav.appendChild(tab);
    });
  }

  function selectSection(i) {
    state.activeIndex = i;
    renderTabs();
    var cached = state.itemsCache[i];
    if (cached) {
      renderItems(cached, state.sections[i].type);
    } else {
      fetchSection(i);
    }
  }

  function apiHeaders() {
    var headers = { "Accept": "application/vnd.github+json" };
    if (state.token) headers["Authorization"] = "token " + state.token;
    return headers;
  }

  function updateRateLimit(resp) {
    var remaining = resp.headers.get("x-ratelimit-remaining");
    var limit = resp.headers.get("x-ratelimit-limit");
    var elRate = document.getElementById("rate-limit");
    if (remaining !== null && limit !== null) {
      elRate.textContent = "API " + remaining + "/" + limit;
    }
  }

  function fetchSection(i) {
    var section = state.sections[i];
    if (!section) return;
    if (!state.token) {
      showEmptyState();
      return;
    }
    setLoading(true);
    var url = "https://api.github.com/search/issues?q=" + encodeURIComponent(section.query) + "&per_page=50";
    fetch(url, { headers: apiHeaders() })
      .then(function (resp) {
        updateRateLimit(resp);
        if (!resp.ok) throw new Error("GitHub API error: " + resp.status);
        return resp.json();
      })
      .then(function (data) {
        var items = data.items || [];
        state.itemsCache[i] = items;
        setLoading(false);
        if (i === state.activeIndex) {
          renderTabs();
          renderItems(items, section.type);
        }
        setStatus("Loaded " + items.length + " items for " + section.title);
      })
      .catch(function (err) {
        setLoading(false);
        setStatus("Error: " + err.message);
      });
  }

  function setLoading(isLoading) {
    state.loading = isLoading;
    document.getElementById("loading").classList.toggle("hidden", !isLoading);
    if (isLoading) {
      document.getElementById("items-table").classList.add("hidden");
      document.getElementById("empty-state").classList.add("hidden");
    }
  }

  function showEmptyState() {
    document.getElementById("empty-state").classList.remove("hidden");
    document.getElementById("items-table").classList.add("hidden");
    document.getElementById("loading").classList.add("hidden");
  }

  function stateClass(item) {
    if (item.pull_request) {
      if (item.pull_request.merged_at) return "state-merged";
      if (item.draft) return "state-draft";
      return item.state === "open" ? "state-open" : "state-closed";
    }
    return item.state === "open" ? "state-open" : "state-closed";
  }

  function renderItems(items, type) {
    document.getElementById("empty-state").classList.add("hidden");
    document.getElementById("loading").classList.add("hidden");
    var table = document.getElementById("items-table");
    table.classList.remove("hidden");

    var head = document.getElementById("items-head");
    head.innerHTML = "";
    var headRow = el("tr", {}, [
      el("th", { text: "" }),
      el("th", { text: "Title" }),
      el("th", { text: "Repo" }),
      el("th", { text: "Labels" }),
      el("th", { text: "Updated" })
    ]);
    head.appendChild(headRow);

    var body = document.getElementById("items-body");
    body.innerHTML = "";

    if (!items.length) {
      var emptyRow = el("tr", {}, [el("td", { colspan: "5", text: "No results." })]);
      body.appendChild(emptyRow);
      return;
    }

    items.forEach(function (item, idx) {
      var repo = (item.repository_url || "").split("/").slice(-2).join("/");
      var dot = el("span", { class: "state-dot " + stateClass(item) });
      var titleCell = el("td", {}, [dot, el("span", { class: "item-title", text: item.title })]);
      var repoCell = el("td", { class: "item-meta", text: repo });
      var labelsWrap = el("div", { class: "labels" });
      (item.labels || []).slice(0, 4).forEach(function (label) {
        labelsWrap.appendChild(el("span", { class: "label-chip", text: label.name }));
      });
      var labelsCell = el("td", {}, [labelsWrap]);
      var updated = new Date(item.updated_at);
      var updatedCell = el("td", { class: "item-meta", text: updated.toLocaleDateString() });
      var numCell = el("td", { class: "item-meta", text: "#" + item.number });

      var row = el("tr", { class: "item-row" }, [numCell, titleCell, repoCell, labelsCell, updatedCell]);
      if (idx === (state.selected[state.activeIndex] || 0)) row.classList.add("selected");
      row.addEventListener("click", function () { window.open(item.html_url, "_blank"); });
      row.dataset.index = String(idx);
      body.appendChild(row);
    });
  }

  function moveSelection(delta) {
    var i = state.activeIndex;
    var items = state.itemsCache[i] || [];
    if (!items.length) return;
    var cur = state.selected[i] || 0;
    var next = Math.min(Math.max(cur + delta, 0), items.length - 1);
    state.selected[i] = next;
    renderItems(items, state.sections[i].type);
    var rows = document.querySelectorAll("#items-body tr.item-row");
    var target = rows[next];
    if (target) target.scrollIntoView({ block: "nearest" });
  }

  function openSelected() {
    var i = state.activeIndex;
    var items = state.itemsCache[i] || [];
    var idx = state.selected[i] || 0;
    var item = items[idx];
    if (item) window.open(item.html_url, "_blank");
  }

  function refreshActive() {
    delete state.itemsCache[state.activeIndex];
    fetchSection(state.activeIndex);
  }

  function refreshAll() {
    state.itemsCache = {};
    fetchSection(state.activeIndex);
  }

  function renderSectionsList() {
    var list = document.getElementById("sections-list");
    list.innerHTML = "";
    state.sections.forEach(function (section, i) {
      var typeSpan = el("span", { class: "stype", text: section.type === "pr" ? "PR" : "Issue" });
      var titleSpan = el("span", { class: "stitle", text: section.title });
      var querySpan = el("span", { class: "squery", text: section.query });
      var removeBtn = el("button", { class: "btn", text: "Remove" });
      removeBtn.addEventListener("click", function () {
        state.sections.splice(i, 1);
        saveSections();
        state.itemsCache = {};
        if (state.activeIndex >= state.sections.length) state.activeIndex = Math.max(0, state.sections.length - 1);
        renderSectionsList();
        renderTabs();
        selectSection(state.activeIndex);
      });
      var item = el("div", { class: "section-item" }, [typeSpan, titleSpan, querySpan, removeBtn]);
      list.appendChild(item);
    });
  }

  function openSettings() {
    document.getElementById("settings-modal").classList.remove("hidden");
    document.getElementById("token-input").value = state.token;
    renderSectionsList();
  }

  function closeSettings() {
    document.getElementById("settings-modal").classList.add("hidden");
  }

  function wireUp() {
    document.getElementById("refresh-btn").addEventListener("click", refreshAll);
    document.getElementById("settings-btn").addEventListener("click", openSettings);
    document.getElementById("settings-close").addEventListener("click", closeSettings);

    document.getElementById("token-save").addEventListener("click", function () {
      var val = document.getElementById("token-input").value.trim();
      saveToken(val);
      setStatus("Token saved.");
      refreshAll();
    });

    document.getElementById("token-clear").addEventListener("click", function () {
      saveToken("");
      document.getElementById("token-input").value = "";
      setStatus("Token cleared.");
      showEmptyState();
    });
      document.getElementById("add-section-btn").addEventListener("click", function () {
      var title = document.getElementById("new-section-title").value.trim();
      var type = document.getElementById("new-section-type").value;
      var query = document.getElementById("new-section-query").value.trim();
      if (!title || !query) {
        setStatus("Section title and query are required.");
        return;
      }
      state.sections.push({ title: title, type: type, query: query });
      saveSections();
      document.getElementById("new-section-title").value = "";
      document.getElementById("new-section-query").value = "";
      renderSectionsList();
      renderTabs();
    });


    document.getElementById("export-config-btn").addEventListener("click", function () {
      document.getElementById("config-textarea").value = JSON.stringify(state.sections, null, 2);
    });

    document.getElementById("import-config-btn").addEventListener("click", function () {
      try {
        var parsed = JSON.parse(document.getElementById("config-textarea").value);
        if (!Array.isArray(parsed)) throw new Error("Config must be a JSON array");
        state.sections = parsed;
        saveSections();
        state.itemsCache = {};
        state.activeIndex = 0;
        renderSectionsList();
        renderTabs();
        selectSection(0);
        setStatus("Config imported.");
      } catch (e) {
        setStatus("Import failed: " + e.message);
      }
    });


    document.addEventListener("keydown", function (e) {
      var modalOpen = !document.getElementById("settings-modal").classList.contains("hidden");
      if (modalOpen) {
        if (e.key === "Escape") closeSettings();
        return;
      }
      if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;

      if (e.key === "j" || e.key === "ArrowDown") { moveSelection(1); e.preventDefault(); }
      else if (e.key === "k" || e.key === "ArrowUp") { moveSelection(-1); e.preventDefault(); }
      else if (e.key === "ArrowRight") { selectSection(Math.min(state.activeIndex + 1, state.sections.length - 1)); }
      else if (e.key === "ArrowLeft") { selectSection(Math.max(state.activeIndex - 1, 0)); }
      else if (e.key >= "1" && e.key <= "9") {
        var idx = parseInt(e.key, 10) - 1;
        if (idx < state.sections.length) selectSection(idx);
      }
      else if (e.key === "Enter" || e.key === "o") { openSelected(); }
      else if (e.key === "r") { refreshActive(); }
      else if (e.key === ",") { openSettings(); }
    });
  }

  function init() {
    wireUp();
    renderTabs();
    if (!state.token) {
      showEmptyState();
    } else {
      selectSection(0);
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
