(() => {
  window.VUI = window.VUI || {};

  // Everything the extension draws lives in a shadow root, so page CSS cannot
  // restyle the panel and our CSS cannot leak into the page.
  let host = null;
  let root = null;
  let layer = null;
  let badges = [];
  const highlights = new Map();
  let frame = null;

  // Inline SVG icons drawn with the button's text colour.
  const ICONS = {
    mic: `
      <svg class="ps-icon" viewBox="0 0 24 24" aria-hidden="true">
        <rect x="9" y="2" width="6" height="12" rx="3"></rect>
        <path d="M5 10v1a7 7 0 0 0 14 0v-1"></path>
        <line x1="12" y1="18" x2="12" y2="22"></line>
      </svg>`,
    close: `
      <svg class="ps-icon" viewBox="0 0 24 24" aria-hidden="true">
        <line x1="6" y1="6" x2="18" y2="18"></line>
        <line x1="18" y1="6" x2="6" y2="18"></line>
      </svg>`
  };

  const TEMPLATE = `
    <div id="ps-layer" class="ps-layer"></div>

    <section id="ps-panel" class="ps-panel" aria-label="Voice Web Navigation">
      <div class="ps-header">
        <div>
          <div class="ps-title">Voice Web Navigation</div>
          <div class="ps-subtitle">Voice-first browser control</div>
        </div>
        <button id="ps-close" class="ps-icon-button" title="Hide panel" aria-label="Hide panel">${ICONS.close}</button>
      </div>

      <div id="ps-status" class="ps-status" role="status" aria-live="polite">
        Ready
      </div>

      <div class="ps-section-label">
        Last command
      </div>

      <div id="ps-transcript" class="ps-transcript">
        Say a command...
      </div>

      <div id="ps-results" class="ps-results"></div>

      <div class="ps-controls">
        <button id="ps-mic" class="ps-mic-button">
          ${ICONS.mic}
          <span>Listen</span>
        </button>

        <button id="ps-stop" class="ps-secondary-button">
          Stop
        </button>
      </div>

      <div class="ps-help">
        Try: "Show labels", "Click 3", "Type hello into 5", "Scroll down",
        or "What can I say?"
      </div>
    </section>

    <button id="ps-reopen" class="ps-reopen" title="Open Voice Web Navigation" hidden>${ICONS.mic}<span>Voice</span></button>
  `;

  function $(id) {
    return root ? root.getElementById(id) : null;
  }

  function createOverlay() {
    if (host) return;

    host = document.createElement("pagespeak-root");
    host.style.cssText =
      "all: initial; display: block; position: fixed; inset: 0; z-index: 2147483647; pointer-events: none;";

    root = host.attachShadow({ mode: "open" });

    const container = document.createElement("div");
    container.innerHTML = TEMPLATE;
    // Avoid a flash of unstyled content while the stylesheet loads.
    container.style.visibility = "hidden";

    const stylesheet = document.createElement("link");
    stylesheet.rel = "stylesheet";
    stylesheet.href = chrome.runtime.getURL("GUI/styles.css");
    stylesheet.addEventListener("load", () => {
      container.style.visibility = "";
    });
    stylesheet.addEventListener("error", () => {
      container.style.visibility = "";
    });

    root.append(stylesheet, container);
    layer = $("ps-layer");

    document.documentElement.appendChild(host);

    window.addEventListener("scroll", schedulePositions, { capture: true, passive: true });
    window.addEventListener("resize", schedulePositions, { passive: true });
  }

  function isOwnElement(node) {
    return Boolean(node) && (node === host || node.getRootNode?.() === root);
  }

  function setStatus(status) {
    const element = $("ps-status");

    if (element) {
      element.textContent = status;
    }
  }

  function setTranscript(text) {
    const element = $("ps-transcript");

    if (element) {
      element.textContent = text;
    }
  }

  function setListening(listening) {
    const mic = $("ps-mic");
    if (!mic) return;

    mic.classList.toggle("ps-listening", listening);
    mic.querySelector("span").textContent = listening ? "Listening" : "Listen";

    if (listening) {
      setStatus("Listening...");
    } else if ($("ps-status").textContent.trim() === "Listening...") {
      setStatus("Ready");
    }
  }

  // items: [{ role, name, kind, [numberKey]: number }]
  function showList(items, numberKey = "index") {
    const container = $("ps-results");

    if (!container) {
      return;
    }

    container.innerHTML = "";

    if (!items.length) {
      container.textContent = "No matching elements found.";
      return;
    }

    items.forEach(item => {
      const row = document.createElement("div");
      row.className = "ps-result-row";

      const number = document.createElement("span");
      number.className = "ps-result-number";
      number.dataset.kind = item.kind || "other";
      number.textContent = item[numberKey];

      const role = document.createElement("span");
      role.className = "ps-result-role";
      role.textContent = item.role;

      const name = document.createElement("span");
      name.className = "ps-result-name";
      name.textContent = item.name || "(unnamed)";

      row.append(number, role, name);
      container.appendChild(row);
    });
  }

  // sections: [{ title, examples: [string] }]
  function showHelp(sections) {
    const container = $("ps-results");
    if (!container) return;

    container.innerHTML = "";

    sections.forEach(section => {
      const block = document.createElement("div");
      block.className = "ps-help-section";

      const title = document.createElement("div");
      title.className = "ps-help-title";
      title.textContent = section.title;

      const examples = document.createElement("div");
      examples.className = "ps-help-examples";
      examples.textContent = section.examples.map(example => `“${example}”`).join("  ·  ");

      block.append(title, examples);
      container.appendChild(block);
    });
  }

  function clearResults() {
    const container = $("ps-results");

    if (container) {
      container.innerHTML = "";
    }
  }

  function hidePanel() {
    $("ps-panel").hidden = true;
    $("ps-reopen").hidden = false;
  }

  function showPanel() {
    $("ps-panel").hidden = false;
    $("ps-reopen").hidden = true;
  }

  // ---- Labels and highlights drawn over the page ----

  // entries: [{ label, element, kind }]
  function renderBadges(entries) {
    if (!layer) return;

    badges.forEach(badge => badge.node.remove());

    badges = entries.map(({ label, element, kind }) => {
      const node = document.createElement("span");
      node.className = "ps-badge";
      node.dataset.kind = kind || "other";
      node.textContent = label;
      layer.appendChild(node);
      return { element, node };
    });

    updatePositions();
  }

  function highlightElement(element, { scroll = true } = {}) {
    if (!element || !layer) {
      return;
    }

    if (scroll) {
      element.scrollIntoView({
        behavior: "smooth",
        block: "center"
      });
    }

    if (!highlights.has(element)) {
      const node = document.createElement("div");
      node.className = "ps-highlight";
      layer.appendChild(node);
      highlights.set(element, node);
    }

    schedulePositions();
  }

  function clearHighlights() {
    highlights.forEach(node => node.remove());
    highlights.clear();
  }

  function isOffscreen(element, rect) {
    return (
      !element.isConnected ||
      rect.width === 0 ||
      rect.bottom < 0 ||
      rect.right < 0 ||
      rect.top > window.innerHeight ||
      rect.left > window.innerWidth
    );
  }

  function updatePositions() {
    frame = null;

    const maxX = window.innerWidth - 32;
    const maxY = window.innerHeight - 22;

    for (const { element, node } of badges) {
      const rect = element.getBoundingClientRect();
      node.hidden = isOffscreen(element, rect);

      if (!node.hidden) {
        // Sit on the top-left corner so the badge covers as little of the element as possible.
        const x = Math.max(0, Math.min(rect.left - 12, maxX));
        const y = Math.max(0, Math.min(rect.top - 13, maxY));
        node.style.transform = `translate(${x}px, ${y}px)`;
      }
    }

    highlights.forEach((node, element) => {
      const rect = element.getBoundingClientRect();
      node.hidden = isOffscreen(element, rect);

      if (!node.hidden) {
        node.style.transform = `translate(${rect.left - 6}px, ${rect.top - 6}px)`;
        node.style.width = `${rect.width + 12}px`;
        node.style.height = `${rect.height + 12}px`;
      }
    });
  }

  function schedulePositions() {
    if (!frame && (badges.length || highlights.size)) {
      frame = requestAnimationFrame(updatePositions);
    }
  }

  window.VUI.Overlay = {
    createOverlay,
    $,
    isOwnElement,
    setStatus,
    setTranscript,
    setListening,
    showList,
    showHelp,
    clearResults,
    hidePanel,
    showPanel,
    renderBadges,
    highlightElement,
    clearHighlights
  };
})();
