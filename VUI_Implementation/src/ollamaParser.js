(() => {
  window.VUI = window.VUI || {};

  const allowedKeys = {
    unknown: ["action"],
    stopReading: ["action"],
    readPage: ["action"],
    back: ["action"],
    forward: ["action"],
    top: ["action"],
    bottom: ["action"],
    scroll: ["action", "direction"],
    scrollPercent: ["action", "direction", "percent"],
    scrollToPercent: ["action", "percent"],
    list: ["action", "type"],
    click: ["action", "target", "index"],
    focus: ["action", "target", "index"],
    type: ["action", "text"]
  };

  function isObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  function hasOnlyAllowedKeys(command) {
    const keys = allowedKeys[command.action];
    return keys && Object.keys(command).every(key => keys.includes(key));
  }

  function isValidCommand(command, elements) {
    if (!isObject(command) || !hasOnlyAllowedKeys(command)) return false;

    if (["scroll", "scrollPercent"].includes(command.action)) {
      if (!["up", "down"].includes(command.direction)) return false;
    }

    if (["scrollPercent", "scrollToPercent"].includes(command.action)) {
      if (!Number.isInteger(command.percent) || command.percent < 0 || command.percent > 100) {
        return false;
      }
    }

    if (command.action === "list") {
      return ["links", "buttons", "inputs", "headings"].includes(command.type);
    }

    if (["click", "focus"].includes(command.action)) {
      if (typeof command.target !== "string" || !command.target.trim()) return false;

      if (command.index !== undefined) {
        if (!Number.isInteger(command.index) || command.index < 1) return false;

        if (command.action === "focus") {
          return command.index <= elements.length;
        }

        const targetType = command.target.toLowerCase();
        if (!["link", "links", "button", "buttons"].includes(targetType)) return false;
        const role = ["link", "links"].includes(targetType) ? "link" : "button";
        return command.index <= elements.filter(element => element.role === role).length;
      }

      return elements.some(element =>
        element.name.toLowerCase() === command.target.trim().toLowerCase()
      );
    }

    if (command.action === "type") {
      return typeof command.text === "string" && command.text.length > 0 && command.text.length <= 500;
    }

    return true;
  }

  function parse(transcript, elements) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          type: "VUI_INTERPRET_COMMAND",
          transcript,
          elements
        },
        response => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }

          if (response?.error) {
            reject(new Error(response.error));
            return;
          }

          if (!isValidCommand(response?.command, elements)) {
            reject(new Error("Ollama returned an unsupported command."));
            return;
          }

          resolve(response.command);
        }
      );
    });
  }

  window.VUI.OllamaParser = { parse };
})();