(() => {
  // Expose local-model command parsing to the content controller.
  window.VUI = window.VUI || {};

  // Define the fields permitted for each normalized command action.
  const allowedKeys = {
    unknown: ["action"],
    hideLinks: ["action"],
    listVisibleLinks: ["action"],
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
    click: ["action", "target", "targetType", "index"],
    focus: ["action", "target", "targetType", "index"],
    highlight: ["action", "target", "targetType", "index"],
    type: ["action", "text"]
  };

  // Map common model action synonyms to supported action names.
  const actionAliases = {
    open: "click",
    activate: "click",
    select: "click",
    press: "click"
  };

  // Convert spoken ordinal words into one-based element indexes.
  const ordinalNumbers = {
    first: 1, one: 1, second: 2, two: 2, third: 3, three: 3,
    fourth: 4, four: 4, fifth: 5, five: 5, sixth: 6, six: 6,
    seventh: 7, seven: 7, eighth: 8, eight: 8, ninth: 9, nine: 9,
    tenth: 10, ten: 10
  };

  // Validate and normalize data returned by the local model.
  function isObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  // Reject command objects containing fields outside their action schema.
  function hasOnlyAllowedKeys(command) {
    const keys = allowedKeys[command.action];
    return keys && Object.keys(command).every(key => keys.includes(key));
  }

  // Convert a numeric or spoken ordinal into its one-based value.
  function ordinalValue(value) {
    if (ordinalNumbers[value]) return ordinalNumbers[value];
    const numeric = value.match(/^(\d+)(?:st|nd|rd|th)?$/);
    return numeric ? Number(numeric[1]) : null;
  }

  // Separate category and ordinal words from spoken element references.
  function normalizeTarget(target, action, existingIndex) {
    if (typeof target !== "string") return { target, index: existingIndex };

    const normalized = target.trim().toLowerCase();
    const ordinalWords = Object.keys(ordinalNumbers).join("|");
    const ordinalPattern = new RegExp(
      `^(?:(?:(${ordinalWords}|\\d+(?:st|nd|rd|th)?)\\s+(links?|buttons?))|((?:links?|buttons?)\\s+(${ordinalWords}|\\d+(?:st|nd|rd|th)?)))$`
    );
    const match = normalized.match(ordinalPattern);

    if (!match) {
      const categoryTargets = {
        links: "link",
        buttons: "button",
        element: "element",
        elements: "element"
      };
      const namedMatch = normalized.match(/^(.+?)\s+(links?|buttons?)$/);
      if (namedMatch) {
        return {
          target: namedMatch[1],
          targetType: namedMatch[2].startsWith("link") ? "links" : "buttons",
          index: existingIndex
        };
      }

      return {
        target: categoryTargets[normalized] || target.trim(),
        targetType: categoryTargets[normalized] === "link"
          ? "links"
          : categoryTargets[normalized] === "button"
            ? "buttons"
            : categoryTargets[normalized] === "element"
              ? "focusables"
            : undefined,
        index: existingIndex
      };
    }

    const category = match[2] || match[3];
    const ordinal = match[1] || match[4];
    const index = existingIndex ?? ordinalValue(ordinal);

    return {
      target: category.startsWith("link") ? "link" : "button",
      targetType: category.startsWith("link") ? "links" : "buttons",
      index
    };
  }

  // Apply action aliases and normalize any target-related fields.
  function normalizeCommand(command) {
    if (!isObject(command) || typeof command.action !== "string") return null;
    if (command.action === "unknown") return { action: "unknown" };

    const action = actionAliases[command.action] || command.action;
    const keys = allowedKeys[action];
    if (!keys) return null;

    const normalized = { action };

    for (const key of keys) {
      if (key === "action") continue;

      let value = command[key];
      if (value === undefined || value === null) continue;

      if (key === "index" && typeof value === "string") {
        const ordinal = ordinalValue(value.toLowerCase());
        if (ordinal !== null) value = ordinal;
      }

      if (key === "target" && typeof value === "string") {
        const result = normalizeTarget(value, action, command.index ?? undefined);
        normalized.target = result.target;
        if (result.targetType) normalized.targetType = result.targetType;
        if (result.index !== undefined) normalized.index = result.index;
        continue;
      }

      if (key === "targetType") {
        const normalizedType = String(value).toLowerCase();
        if (["link", "links"].includes(normalizedType)) {
          normalized.targetType = "links";
        } else if (["button", "buttons"].includes(normalizedType)) {
          normalized.targetType = "buttons";
        } else if (["element", "elements", "focusables"].includes(normalizedType)) {
          normalized.targetType = "focusables";
        } else {
          return null;
        }
        continue;
      }

      normalized[key] = value;
    }

    if (command.index !== undefined && command.index !== null && normalized.index === undefined) {
      normalized.index = command.index;
    }

    return normalized;
  }

  // Enforce supported action shapes and ensure referenced targets exist.
  function isValidCommand(command, targets) {
    if (!isObject(command) || !hasOnlyAllowedKeys(command)) return false;
    if (["unknown", "hideLinks", "listVisibleLinks"].includes(command.action)) {
      return true;
    }

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

    if (["click", "focus", "highlight"].includes(command.action)) {
      if (typeof command.target !== "string" || !command.target.trim()) return false;
      const targetType = command.targetType || (
        ["link", "links"].includes(command.target.toLowerCase())
          ? "links"
          : ["button", "buttons"].includes(command.target.toLowerCase())
            ? "buttons"
            : null
      );
      const candidates = targetType === "links"
        ? targets.links
        : targetType === "buttons"
          ? targets.buttons
          : targetType === "focusables"
            ? targets.focusables
            : [...targets.links, ...targets.buttons, ...targets.focusables];

      if (command.index !== undefined) {
        if (!Number.isInteger(command.index) || command.index < 1) return false;
        return Boolean(targetType) && command.index <= candidates.length;
      }

      return candidates.some(element =>
        element.name.toLowerCase() === command.target.trim().toLowerCase()
      );
    }

    if (command.action === "type") {
      return typeof command.text === "string" && command.text.length > 0 && command.text.length <= 500;
    }

    return true;
  }

  // Ask the extension worker to interpret speech, then validate its reply.
  function parse(transcript, targets) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          type: "VUI_INTERPRET_COMMAND",
          transcript,
          targets
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

          const command = normalizeCommand(response?.command);

          if (!command || !isValidCommand(command, targets)) {
            reject(new Error(
              `Ollama returned an invalid ${response?.command?.action || "unknown"} command.`
            ));
            return;
          }

          resolve(command);
        }
      );
    });
  }

  // Publish the validated local-model parser.
  window.VUI.OllamaParser = { parse };
})();