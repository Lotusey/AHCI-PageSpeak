(() => {
  // Make the built-in voice-command parser available to the controller.
  window.VUI = window.VUI || {};

  // Normalize speech text before comparing it with known command patterns.
  function normalize(text) {
    return text
      .toLowerCase()
      .replace(/[?.!,]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  // Convert spoken or numeric ordinals to one-based list positions.
  function numberFromText(text) {
    const numberWords = {
      first: 1, second: 2, third: 3, fourth: 4, fifth: 5,
      sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10,
      eleventh: 11, twelfth: 12, thirteenth: 13, fourteenth: 14, fifteenth: 15,
      sixteenth: 16, seventeenth: 17, eigteenth: 18, nineteenth: 19, twentieth: 20,
      twentyfirst: 21, twentysecond: 22, twentythird: 23, twentyfourth: 24, twentyfifth: 25,
      twentysixth: 26, twentyseventh: 27, twentyeigth: 28, twentyninth: 29, thirtieth: 30,
      thirtyfirst: 31, thirtysecond: 32, thirtythird: 33, thirtyfourth: 34, thirtyfifth: 35,
      thirtysixth: 36, thirtyseventh: 37, thirtyeigth: 38, thirtyninth: 39, fortieth: 40,
      fortyfirst: 41, fortysecond: 42, fortythird: 43, fortyfourth: 44, fortyfifth: 45,
      fortysixth: 46, fortyseventh: 47, fortyeigth: 48, fortyninth: 49, fitieth: 50,
      fiftyfirst: 51, fiftysecond: 52, fiftythird: 53, fiftyfourth: 54, fiftyfifth: 55,
      fiftysixth: 56, fiftyseventh: 57, fiftyeigth: 58, fiftyninth: 59, sixtieth: 60,
      sixtyfirst: 61, sixtysecond: 62, sixtythird: 63, sixtyfourth: 64, sixtyfifth: 65,
      sixtysixth: 66, sixtyseventh: 67, sixtyeigth: 68, sixtyninth: 69, seventieth: 70,
      seventyfirst: 71, seventysecond: 72, seventythird: 73, seventyfourth: 74, seventyfifth: 75,
      seventysixth: 76, seventyseventh: 77, seventyeigth: 78, seventyninth: 79, eightieth: 80
    };

    const numeric = text.match(/\b(\d+)\b/);
    if (numeric) return Number(numeric[1]);

    for (const [word, number] of Object.entries(numberWords)) {
      if (text.includes(word)) return number;
    }

    return null;
  }

  // Extract an optional link/button category and index from a target phrase.
  function elementReference(value) {
    let target = value.trim();
    let targetType = null;
    const categoryPattern = /^(links?|buttons?)\s+(.+)$|^(.+?)\s+(links?|buttons?)$/;
    const categoryMatch = target.match(categoryPattern);

    if (categoryMatch) {
      const category = categoryMatch[1] || categoryMatch[4];
      targetType = category.startsWith("link") ? "links" : "buttons";
      target = categoryMatch[2] || categoryMatch[3];
    }

    const index = numberFromText(target);

    return {
      target: index === null ? target : targetType === "links" ? "link" : targetType === "buttons" ? "button" : target,
      targetType,
      index
    };
  }

  // Match supported phrases to structured actions and their parameters.
  // Main command list
  function parse(text) {
    const command = normalize(text);

    if (!command) return { action: "unknown" };

    if (
      command === "stop" ||
      command === "stop reading" ||
      command === "be quiet"
    ) {
      return { action: "stopReading" };
    }

    if (
      command === "read this page" ||
      command === "read the page" ||
      command === "read page"
    ) {
      return { action: "readPage" };
    }

    if (command === "go back" || command === "back") {
      return { action: "back" };
    }

    if (command === "go forward" || command === "forward") {
      return { action: "forward" };
    }

    // Parse relative percentage scrolling and absolute page positions.
    const scrollDownPercent = command.match(
      /^scroll down (\d{1,3})%$/
    );

    if (scrollDownPercent) {
      const percent = Number(scrollDownPercent[1]);

      if (percent <= 100) {
        return {
          action: "scrollPercent",
          direction: "down",
          percent
        };
      }
    }

    const scrollUpPercent = command.match(
      /^scroll up (\d{1,3})%$/
    );

    if (scrollUpPercent) {
      const percent = Number(scrollUpPercent[1]);

      if (percent <= 100) {
        return {
          action: "scrollPercent",
          direction: "up",
          percent
        };
      }
    }

    const absolutePercent = command.match(
      /^(?:(?:can you|please) )?(?:scroll to|go to|move to|take me to) (\d{1,3})\s*(?:%|percent)(?: of (?:the )?page)?$/
    );
    const absoluteHalf = command.match(
      /^(?:(?:can you|please) )?(?:scroll to|go to|move to|take me to) (half|middle)(?: of (?:the )?page)?$/
    );

    if (absolutePercent || absoluteHalf) {
      const percent = absoluteHalf ? 50 : Number(absolutePercent[1]);

      if (percent <= 100) {
        return {
          action: "scrollToPercent",
          percent
        };
      }
    }

    const scrollToPercent = command.match(
      /^(?:scroll to|go to) (\d{1,3})%(?: of the page)?$/
    );

    if (scrollToPercent) {
      const percent = Number(scrollToPercent[1]);

      if (percent <= 100) {
        return { action: "scrollToPercent", percent };
      }
    }

    if (
      command === "scroll down" ||
      command === "page down"
    ) {
      return {
        action: "scroll",
        direction: "down"
      };
    }

    if (
      command === "scroll up" ||
      command === "page up"
    ) {
      return {
        action: "scroll",
        direction: "up"
      };
    }

    if (
      command === "go to the top" ||
      command === "scroll to the top" ||
      command === "top"
    ) {
      return { action: "top" };
    }

    if (
      command === "go to the bottom" ||
      command === "scroll to the bottom" ||
      command === "bottom"
    ) {
      return { action: "bottom" };
    }

    if (
      command === "hide links" ||
      command === "hide the links"
    ) {
      return { action: "hideLinks" };
    }

    if (
      command === "show labels" ||
      command === "show numbered labels" ||
      command === "label elements"
    ) {
      return { action: "showLabels" };
    }

    if (
      command === "hide labels" ||
      command === "hide numbered labels"
    ) {
      return { action: "hideLabels" };
    }

    if ([
      "highlight links on current screen",
      "highlight the links on the current screen",
      "highlight visible links",
      "show visible links",
      "list visible links",
      "show links on screen",
      "show links on the screen"
    ].includes(command)) {
      return { action: "listVisibleLinks" };
    }

    if (command === "show links" || command === "list links") {
      return {
        action: "list",
        type: "links"
      };
    }

    if (["show all links", "list all links", "all links"].includes(command)) {
      return {
        action: "list",
        type: "links"
      };
    }

    if (
      command === "show buttons" ||
      command === "list buttons"
    ) {
      return {
        action: "list",
        type: "buttons"
      };
    }

    if (
      command === "show inputs" ||
      command === "list inputs" ||
      command === "show form fields"
    ) {
      return {
        action: "list",
        type: "inputs"
      };
    }

    if (
      command === "show headings" ||
      command === "list headings"
    ) {
      return {
        action: "list",
        type: "headings"
      };
    }

    const highlightMatch = command.match(
      /^highlight\s+(?:the\s+)?(.+)$/
    );

    if (highlightMatch) {
      const reference = elementReference(highlightMatch[1]);

      return {
        action: "highlight",
        target: reference.target,
        targetType: reference.targetType,
        index: reference.index
      };
    }

    const clickMatch = command.match(
      /^(?:click|open|activate|select)\s+(?:the\s+)?(.+)$/
    );

    if (clickMatch) {
      const reference = elementReference(clickMatch[1]);

      return {
        action: "click",
        target: reference.target,
        targetType: reference.targetType,
        index: reference.index
      };
    }

    const focusMatch = command.match(
      /^(?:focus|go to)\s+(?:the\s+)?(.+?)(?:\s+field)?$/
    );

    if (focusMatch) {
      const reference = elementReference(focusMatch[1]);

      return {
        action: "focus",
        target: reference.target,
        targetType: reference.targetType,
        index: reference.index
      };
    }

    const typeMatch = command.match(
      /^(?:type|enter|write)\s+(.+)$/
    );

    if (typeMatch) {
      return {
        action: "type",
        text: typeMatch[1]
      };
    }

    return {
      action: "unknown",
      text
    };
  }

  // Publish the deterministic parser used before local-model interpretation.
  window.VUI.CommandParser = {
    parse
  };
})();