(() => {
  window.VUI = window.VUI || {};

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
        Try: "Show links", "Click the second link", "Scroll down",
        "Go back", or "Read this page".
      </div>
    `;

    document.documentElement.appendChild(overlay);

    return overlay;
  }

  function setStatus(status) {
    const element = document.getElementById("vui-status");

    if (element) {
      element.textContent = status;
    }
  }

  function setTranscript(text) {
    const element =
      document.getElementById("vui-transcript");

    if (element) {
      element.textContent = text;
    }
  }

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

  function clearResults() {
    const container =
      document.getElementById("vui-results");

    if (container) {
      container.innerHTML = "";
    }
  }

  function highlightElement(element) {
    if (!element) {
      return;
    }

    element.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });

    element.classList.add("vui-highlight");

    setTimeout(() => {
      element.classList.remove("vui-highlight");
    }, 1500);
  }

  window.VUI.Overlay = {
    createOverlay,
    setStatus,
    setTranscript,
    showList,
    clearResults,
    highlightElement
  };
})();
