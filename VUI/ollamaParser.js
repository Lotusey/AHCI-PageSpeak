(() => {
  window.VUI = window.VUI || {};

  const REFERENCE = ["label", "target", "targetType", "index"];

  // Fields each action may carry. Anything else the model returns is dropped.
  const FIELDS = {
    unknown: [],
    stopReading: [],
    readPage: [],
    back: [],
    forward: [],
    reload: [],
    newTab: [],
    closeTab: [],
    top: [],
    bottom: [],
    help: [],
    hideLabels: [],
    listHeadings: [],
    nextField: [],
    previousField: [],
    search: ["query"],
    zoom: ["direction"],
    scroll: ["direction"],
    scrollPercent: ["direction", "percent"],
    scrollToPercent: ["percent"],
    showLabels: ["type"],
    pressKey: ["key"],
    click: REFERENCE,
    focus: REFERENCE,
    highlight: REFERENCE,
    clear: REFERENCE,
    type: ["text", ...REFERENCE],
    check: ["checked", ...REFERENCE],
    chooseOption: ["option", ...REFERENCE]
  };

  const NEEDS_REFERENCE = new Set(["click", "focus", "highlight"]);

  const ACTION_ALIASES = {
    open: "click",
    activate: "click",
    select: "click",
    press: "click"
  };

  const TARGET_TYPES = {
    link: "links",
    links: "links",
    button: "buttons",
    buttons: "buttons",
    input: "inputs",
    inputs: "inputs",
    field: "inputs",
    fields: "inputs"
  };

  const KEYS = {
    enter: "enter",
    return: "enter",
    escape: "escape",
    esc: "escape",
    tab: "tab",
    shifttab: "shiftTab",
    "shift tab": "shiftTab",
    "shift+tab": "shiftTab"
  };

  function isObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  // Accepts command shapes from earlier versions of the prompt.
  function upgradeLegacy(command) {
    const action = ACTION_ALIASES[command.action] || command.action;

    if (action === "hideLinks") return { action: "hideLabels" };
    if (action === "listVisibleLinks") return { action: "showLabels", type: "links" };
    if (action === "list") {
      return command.type === "headings"
        ? { action: "listHeadings" }
        : { action: "showLabels", type: command.type };
    }

    return { ...command, action };
  }

  function toNumber(value) {
    if (typeof value === "number") return value;
    if (typeof value === "string") {
      return window.VUI.CommandParser.parseNumber(value.toLowerCase());
    }
    return null;
  }

  function normalizeCommand(raw) {
    if (!isObject(raw) || typeof raw.action !== "string") return null;

    const command = upgradeLegacy(raw);
    const fields = FIELDS[command.action];
    if (!fields) return null;

    const result = { action: command.action };

    for (const key of fields) {
      const value = command[key];
      if (value === undefined || value === null || value === "") continue;

      if (["label", "index", "percent"].includes(key)) {
        const number = toNumber(value);
        if (number === null) return null;
        result[key] = number;
      } else if (key === "targetType") {
        const type = TARGET_TYPES[String(value).toLowerCase()];
        if (type) result.targetType = type;
      } else if (key === "checked") {
        result.checked = value === true || value === "true";
      } else if (key === "key") {
        result.key = KEYS[String(value).toLowerCase()] || String(value);
      } else if (["direction", "type"].includes(key)) {
        result[key] = String(value).toLowerCase();
      } else {
        result[key] = typeof value === "string" ? value.trim() : value;
      }
    }

    // Let the rule-based reference parser interpret targets like "second link" or "12".
    if (
      typeof result.target === "string" &&
      result.label === undefined &&
      result.index === undefined
    ) {
      const reference = window.VUI.CommandParser.elementReference(result.target.toLowerCase());

      if (reference.label !== undefined) {
        result.label = reference.label;
        delete result.target;
      } else {
        result.target = reference.target;
        result.targetType = result.targetType || reference.targetType;
        if (reference.index !== undefined) result.index = reference.index;
        if (!result.targetType) delete result.targetType;
      }
    }

    return result;
  }

  function isShortString(value, max) {
    return typeof value === "string" && value.length > 0 && value.length <= max;
  }

  function isValidReference(command, targets, required) {
    const hasReference =
      command.label !== undefined ||
      command.index !== undefined ||
      command.target !== undefined;

    if (!hasReference) return !required;

    if (command.label !== undefined) {
      return Number.isInteger(command.label) &&
        targets.labels.some(item => item.label === command.label);
    }

    if (command.index !== undefined) {
      const type = command.targetType || TARGET_TYPES[String(command.target || "").toLowerCase()];
      const list = type ? targets[type] : null;

      return Number.isInteger(command.index) &&
        command.index >= 1 &&
        Boolean(list) &&
        command.index <= list.length;
    }

    return isShortString(command.target, 120);
  }

  function isValidCommand(command, targets) {
    if (!command) return false;

    const { action } = command;

    if (["scroll", "scrollPercent"].includes(action) && !["up", "down"].includes(command.direction)) {
      return false;
    }

    if (["scrollPercent", "scrollToPercent"].includes(action)) {
      if (!Number.isInteger(command.percent) || command.percent < 0 || command.percent > 100) {
        return false;
      }
    }

    if (action === "zoom" && !["in", "out", "reset"].includes(command.direction)) return false;
    if (action === "showLabels" && command.type !== undefined && !["all", "links", "buttons", "inputs"].includes(command.type)) return false;
    if (action === "pressKey" && !["enter", "escape", "tab", "shiftTab"].includes(command.key)) return false;
    if (action === "search" && !isShortString(command.query, 200)) return false;
    if (action === "type" && !isShortString(command.text, 500)) return false;
    if (action === "chooseOption" && !isShortString(command.option, 120)) return false;

    if (FIELDS[action].includes("label")) {
      return isValidReference(command, targets, NEEDS_REFERENCE.has(action));
    }

    return true;
  }

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

          if (!isValidCommand(command, targets)) {
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

  window.VUI.OllamaParser = { parse };
})();
