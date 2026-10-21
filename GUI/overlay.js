(() => {
  // Provide UI helpers for the voice-navigation overlay.
  window.VUI = window.VUI || {};
  const highlightedElements = new Set();

  // Create the panel and its controls once per page.
  function createOverlay() {
    if (document.getElementById("vui-overlay")) {
      return;
    }

    const overlay = document.createElement("section");

    overlay.id = "vui-overlay";
    overlay.innerHTML = `
      <div class="vui-header">
        <div>
          <div class="vui-title">Voice Web Navigation</div>
          <div class="vui-subtitle">Voice-first browser control</div>
        </div>
        <button id="vui-close" class="vui-icon-button" title="Hide overlay">×</button>
      </div>

      <div id="vui-status" class="vui-status">
        Ready
      </div>

      <div class="vui-transcript-label">
        Last command
      </div>

      <div id="vui-transcript" class="vui-transcript">
        Say a command...
      </div>

      <div id="vui-results" class="vui-results"></div>

      <div class="vui-controls">
        <button id="vui-mic" class="vui-mic-button">
          🎤
          <span>Listen</span>
        </button>

        <button id="vui-stop" class="vui-secondary-button">
          Stop
        </button>
      </div>

      <div class="vui-help">
        Try: "Show labels", "Click 2", "Scroll down", "Go back",
        or "Read this page".
      </div>
    `;

    document.documentElement.appendChild(overlay);

    return overlay;
  }

  // Update the short status message shown in the panel.
  function setStatus(status) {
    const element = document.getElementById("vui-status");

    if (element) {
      element.textContent = status;
    }
  }

  // Show the latest speech-recognition transcript.
  function setTranscript(text) {
    const element =
      document.getElementById("vui-transcript");

    if (element) {
      element.textContent = text;
    }
  }

  // Render numbered page-element results or an empty-results message.
  function showList(items) {
    const container =
      document.getElementById("vui-results");

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

      row.className = "vui-result-row";

      row.innerHTML = `
        <span class="vui-result-number">${item.index}</span>
        <span class="vui-result-role">${item.role}</span>
        <span class="vui-result-name"></span>
      `;

      row.querySelector(".vui-result-name")
        .textContent = item.name;

      container.appendChild(row);
    });
  }

  // Remove all current result rows from the panel.
  function clearResults() {
    const container =
      document.getElementById("vui-results");

    if (container) {
      container.innerHTML = "";
    }
  }

  // Bring one matched element into view and mark it for visual emphasis.
  function highlightElement(element) {
    if (!element) {
      return;
    }

    element.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });

    element.classList.add("vui-highlight");
    highlightedElements.add(element);
  }

  // Mark every element in a displayed list for visual emphasis.
  function highlightVisibleElements(items) {
    items.forEach(item => {
      const element = item.element;
      element.classList.add("vui-highlight");
      highlightedElements.add(element);
    });
  }

  // Remove emphasis from all elements previously highlighted by the overlay.
  function clearHighlights() {
    highlightedElements.forEach(element => {
      element.classList.remove("vui-highlight");
    });
    highlightedElements.clear();
  }

  // Draw numbered badges over the page elements currently available by voice.
  function renderBadges(items) {
    let layer = document.getElementById("ps-label-layer");

    if (!items.length) {
      layer?.remove();
      return;
    }

    if (!layer) {
      layer = document.createElement("div");
      layer.id = "ps-label-layer";
      layer.className = "ps-layer";
      layer.setAttribute("aria-hidden", "true");
      document.documentElement.appendChild(layer);
    }

    layer.replaceChildren();

    items.forEach(item => {
      if (!item.element.isConnected) {
        return;
      }

      const rect = item.element.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const badge = document.createElement("span");
      const tagName = item.element.tagName.toLowerCase();
      const inputType = item.element.getAttribute("type");
      const kind = item.role === "link"
        ? "link"
        : item.role === "button" ||
            tagName === "button" ||
            ["button", "submit"].includes(inputType) ||
            item.element.getAttribute("role") === "button"
          ? "button"
          : "input";

      badge.className = "ps-badge";
      badge.dataset.kind = kind;
      badge.textContent = String(item.label);
      badge.style.left = `${rect.left}px`;
      badge.style.top = `${rect.top}px`;
      layer.appendChild(badge);
    });
  }

  // Publish overlay operations for the command controller.
  window.VUI.Overlay = {
    createOverlay,
    setStatus,
    setTranscript,
    showList,
    clearResults,
    highlightElement,
    highlightVisibleElements,
    clearHighlights,
    renderBadges,
  };
})();
