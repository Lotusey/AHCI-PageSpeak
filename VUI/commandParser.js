(() => {
  window.VUI = window.VUI || {};

  // "to", "for", "won" and "ate" are common recognitions of spoken numbers.
  const SMALL_NUMBERS = {
    one: 1, won: 1, two: 2, to: 2, too: 2, three: 3, four: 4, for: 4,
    five: 5, six: 6, seven: 7, eight: 8, ate: 8, nine: 9, ten: 10,
    eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
    sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19
  };

  const TENS = {
    twenty: 20, thirty: 30, forty: 40, fifty: 50,
    sixty: 60, seventy: 70, eighty: 80, ninety: 90
  };

  const ORDINALS = {
    first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6,
    seventh: 7, eighth: 8, ninth: 9, tenth: 10, eleventh: 11, twelfth: 12
  };

  const POLITE_PREFIX = /^(?:(?:please|can you|could you|would you|will you|i want to|i'd like to|let's|lets|go ahead and|now)\s+)+/i;
  const POLITE_SUFFIX = /\s+(?:please|for me|thanks|thank you)$/i;

  const CATEGORY = "(links?|buttons?|inputs?|fields?|text ?box(?:es)?|box(?:es)?|bar)";
  const TYPED_PREFIX = new RegExp(`^${CATEGORY}\\s+(?:number\\s+)?(.+)$`);
  const TYPED_SUFFIX = new RegExp(`^(.+?)\\s+${CATEGORY}$`);
  const SINGULAR = { links: "link", buttons: "button", inputs: "field" };

  const NEGATION = /^(?:do not|don't|dont|never)\s+/;
  const HIDE_LABELS = /^(?:(?:do not|don't|dont|stop|never)\s+(?:show|showing|display|displaying)|turn off|switch off|get rid of|remove|hide|no)\s+(?:the\s+|any\s+|all\s+)?(?:labels?|numbers?|links|buttons|inputs|fields|badges)$/;

  const EXACT = {};

  function phrases(list, command) {
    list.forEach(phrase => {
      EXACT[phrase] = command;
    });
  }

  phrases(["stop", "stop reading", "be quiet", "stop talking", "quiet"], { action: "stopReading" });
  phrases(["stop listening", "stop listening to me", "go to sleep", "turn off the microphone", "turn off microphone", "turn off the mic", "mic off"], { action: "stopListening" });
  phrases(["help", "what can i say", "what can i do", "show commands", "list commands", "show help"], { action: "help" });
  phrases(["read this page", "read the page", "read page"], { action: "readPage" });
  phrases(["go back", "back", "previous page"], { action: "back" });
  phrases(["go forward", "forward", "next page"], { action: "forward" });
  phrases(["reload", "refresh", "reload page", "reload the page", "reload this page", "refresh page", "refresh the page", "refresh this page"], { action: "reload" });
  phrases(["new tab", "open new tab", "open a new tab", "open tab"], { action: "newTab" });
  phrases(["close tab", "close this tab", "close the tab"], { action: "closeTab" });
  phrases(["zoom in", "make it bigger", "make the page bigger"], { action: "zoom", direction: "in" });
  phrases(["zoom out", "make it smaller", "make the page smaller"], { action: "zoom", direction: "out" });
  phrases(["reset zoom", "zoom reset", "normal size", "actual size", "default zoom"], { action: "zoom", direction: "reset" });
  phrases(["scroll down", "page down"], { action: "scroll", direction: "down" });
  phrases(["scroll up", "page up"], { action: "scroll", direction: "up" });
  phrases(["go to the top", "go to top", "scroll to the top", "scroll to top", "top"], { action: "top" });
  phrases(["go to the bottom", "go to bottom", "scroll to the bottom", "scroll to bottom", "bottom"], { action: "bottom" });

  phrases(["show labels", "show numbers", "show all labels", "show label", "label everything", "label the page", "number everything"], { action: "showLabels", type: "all" });
  phrases([
    "show links", "list links", "show all links", "list all links", "all links",
    "highlight links", "highlight visible links", "show visible links", "list visible links",
    "highlight links on current screen", "highlight the links on the current screen",
    "show links on screen", "show links on the screen", "label links"
  ], { action: "showLabels", type: "links" });
  phrases(["show buttons", "list buttons", "show all buttons", "label buttons"], { action: "showLabels", type: "buttons" });
  phrases(["show inputs", "list inputs", "show form fields", "show fields", "show text fields", "label inputs", "label fields"], { action: "showLabels", type: "inputs" });
  phrases([
    "hide labels", "hide numbers", "hide links", "hide the links", "hide buttons",
    "hide inputs", "hide fields", "clear labels", "remove labels"
  ], { action: "hideLabels" });
  phrases(["show headings", "list headings"], { action: "listHeadings" });

  phrases([
    "press enter", "enter", "hit enter", "press return", "press the enter key",
    "press enter key", "submit", "submit form", "submit the form", "submit this form"
  ], { action: "pressKey", key: "enter" });
  phrases([
    "press escape", "escape", "press the escape key", "press escape key",
    "close popup", "close the popup", "close dialog", "close the dialog", "dismiss"
  ], { action: "pressKey", key: "escape" });
  phrases(["press tab", "tab", "next element", "next item"], { action: "pressKey", key: "tab" });
  phrases(["press shift tab", "shift tab", "previous element", "previous item"], { action: "pressKey", key: "shiftTab" });
  phrases(["next field", "next input", "next box", "next text field"], { action: "nextField" });
  phrases(["previous field", "previous input", "previous box", "last field"], { action: "previousField" });
  phrases([
    "clear", "clear field", "clear the field", "clear this field", "clear text",
    "clear the text", "clear it", "clear this", "clear input", "erase", "erase that",
    "delete text", "delete all"
  ], { action: "clear" });
  phrases(["check", "check this", "check it", "check this box", "check the box", "tick", "tick this", "tick the box"], { action: "check", checked: true });
  phrases(["uncheck", "uncheck this", "uncheck it", "uncheck this box", "uncheck the box", "untick"], { action: "check", checked: false });

  function lookup(table, key) {
    return Object.hasOwn(table, key) ? table[key] : undefined;
  }

  function stripPolite(text) {
    return text
      .replace(POLITE_PREFIX, "")
      .replace(POLITE_SUFFIX, "")
      .trim();
  }

  function normalize(text) {
    return stripPolite(
      String(text || "")
        .toLowerCase()
        .replace(/[?!,;:"]/g, "")
        .replace(/\.(?!\d)/g, "")
        .replace(/(\d+)\s*(?:%|percent|per cent)/g, "$1%")
        .replace(/-/g, " ")
        .replace(/\s+/g, " ")
        .trim()
    );
  }

  // Parses "12", "#12", "twelve", "twenty one", "third", "3rd", "number 5".
  function parseNumber(text) {
    const value = String(text || "")
      .trim()
      .replace(/-/g, " ")
      .replace(/^(?:number|label|no(?=\s*\d))\s*/, "")
      .trim();

    const numeric = value.match(/^#?(\d{1,4})(?:st|nd|rd|th)?$/);
    if (numeric) return Number(numeric[1]) || null;

    const single =
      lookup(ORDINALS, value) ??
      lookup(SMALL_NUMBERS, value) ??
      lookup(TENS, value);
    if (single !== undefined) return single;

    const compound = value.match(/^([a-z]+) ([a-z]+)$/);
    if (compound) {
      const tens = lookup(TENS, compound[1]);
      const ones = lookup(SMALL_NUMBERS, compound[2]);
      if (tens !== undefined && ones >= 1 && ones <= 9) return tens + ones;
    }

    return null;
  }

  function categoryType(word) {
    if (word.startsWith("link")) return "links";
    if (word.startsWith("button")) return "buttons";
    return "inputs";
  }

  // Turns a spoken element reference into one of:
  //   { label }                       "12", "number twelve"
  //   { target, targetType, index }   "the second link", "button 3"
  //   { target, targetType? }         "sign in", "the search field"
  function elementReference(value) {
    const target = String(value || "")
      .trim()
      .replace(/^(?:on|in|into|to)\s+(?=\S)/, "")
      .replace(/^the\s+/, "")
      .trim();

    const label = parseNumber(target);
    if (label !== null) return { label };

    const prefix = target.match(TYPED_PREFIX);
    const suffix = prefix ? null : target.match(TYPED_SUFFIX);

    if (prefix || suffix) {
      const targetType = categoryType(prefix ? prefix[1] : suffix[2]);
      const rest = (prefix ? prefix[2] : suffix[1])
        .replace(/^(?:to|for|called|named|labeled|labelled|that says|saying)\s+/, "");
      const index = parseNumber(rest);

      return index !== null
        ? { target: SINGULAR[targetType], targetType, index }
        : { target: rest, targetType };
    }

    return { target };
  }

  // Bare numbers ("7", "number 7", "the second one") pick a label.
  function parseChoice(command) {
    const rest = command
      .replace(/^(?:choose|pick|select|go with)\s+/, "")
      .replace(/^the\s+/, "");

    const direct = parseNumber(rest);
    if (direct !== null) return direct;

    const one = rest.match(/^(.+)\s+one$/);
    if (one && (Object.hasOwn(ORDINALS, one[1]) || /^\d+(?:st|nd|rd|th)$/.test(one[1]))) {
      return parseNumber(one[1]);
    }

    return null;
  }

  function chooseOptionCommand(option, reference) {
    const command = {
      action: "chooseOption",
      option: option.replace(/^option\s+/i, "").trim()
    };

    if (reference) {
      Object.assign(
        command,
        elementReference(
          normalize(reference).replace(/\s+(?:drop ?down|list|menu|selector|box|field)$/, "")
        )
      );
    }

    return command;
  }

  // "type hello into 5" -> text "hello" typed into label 5. The whole phrase is
  // kept as fallbackText in case "in ..." was part of the dictation.
  function typeCommand(full) {
    const into = full.match(/^(.+)\s+(?:into|in)\s+(.+)$/i);

    if (into) {
      return {
        action: "type",
        text: into[1].trim(),
        fallbackText: full,
        ...elementReference(normalize(into[2]))
      };
    }

    return { action: "type", text: full };
  }

  function parse(text) {
    const original = stripPolite(String(text || "").trim());
    const command = normalize(text);

    if (!command) return { action: "unknown" };

    const exact = lookup(EXACT, command);
    if (exact) return { ...exact };

    if (HIDE_LABELS.test(command) || /^(?:labels?|numbers?) off$/.test(command)) {
      return { action: "hideLabels" };
    }

    // "don't click that", "do not scroll": never run a negated command.
    if (NEGATION.test(command)) return { action: "cancel" };

    let match;

    if ((match = command.match(/^(?:search for|search the web for|search google for|google|look up)\s+(.+)$/))) {
      return { action: "search", query: match[1] };
    }

    if ((match = command.match(/^scroll (down|up) (\d{1,3})%$/)) && Number(match[2]) <= 100) {
      return { action: "scrollPercent", direction: match[1], percent: Number(match[2]) };
    }

    match = command.match(
      /^(?:scroll to|go to|move to|take me to|jump to) (?:(\d{1,3})%|half|halfway|the middle|middle)(?: of (?:the )?page)?$/
    );
    if (match) {
      const percent = match[1] ? Number(match[1]) : 50;
      if (percent <= 100) return { action: "scrollToPercent", percent };
    }

    const choice = parseChoice(command);
    if (choice !== null) return { action: "choose", label: choice };

    if ((match = command.match(/^(un)?(?:check|tick)\s+(.+?)(?:\s+(?:check ?box|box))?$/))) {
      return { action: "check", checked: !match[1], ...elementReference(match[2]) };
    }

    if ((match = command.match(/^(?:clear|erase|empty)\s+(.+?)(?:\s+(?:field|box|input))?$/))) {
      return { action: "clear", ...elementReference(match[1]) };
    }

    if ((match = command.match(/^(?:choose|pick|select option|choose option|pick option|select the option)\s+(.+?)(?:\s+(?:in|from|for|on)\s+(.+))?$/))) {
      return chooseOptionCommand(match[1], match[2]);
    }

    if ((match = original.replace(/[.!?]+$/, "").match(/^set\s+(?:the\s+)?(.+?)\s+to\s+(.+)$/i))) {
      return chooseOptionCommand(match[2], match[1]);
    }

    if ((match = original.match(/^(?:type|enter|write|input|dictate)\s+(.+)$/i))) {
      return typeCommand(match[1].trim());
    }

    if ((match = command.match(/^highlight\s+(.+)$/))) {
      return { action: "highlight", ...elementReference(match[1]) };
    }

    if ((match = command.match(/^(?:click|tap|press|push|hit|open|activate|select|follow)\s+(.+)$/))) {
      return { action: "click", ...elementReference(match[1]) };
    }

    if ((match = command.match(/^(?:focus|go to|move to|jump to)\s+(.+)$/))) {
      return { action: "focus", ...elementReference(match[1]) };
    }

    return {
      action: "unknown",
      text
    };
  }

  window.VUI.CommandParser = {
    parse,
    parseNumber,
    elementReference,
    normalize
  };
})();
