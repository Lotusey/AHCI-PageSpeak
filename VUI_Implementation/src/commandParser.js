(() => {
  window.VUI = window.VUI || {};

  function normalize(text) {
    return text
      .toLowerCase()
      .replace(/[?.!,]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function numberFromText(text) {
    const numberWords = {
      first: 1, second: 2, third: 3, fourth: 4, fifth: 5,
      sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10
    };

    const numeric = text.match(/\b(\d+)\b/);
    if (numeric) return Number(numeric[1]);

    for (const [word, number] of Object.entries(numberWords)) {
      if (text.includes(word)) return number;
    }

    return null;
  }

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

    // Percentage-based scrolling
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

    const scrollToPercent = command.match(
      /^(?:scroll to|go to) (\d{1,3})%(?: of the page)?$/
    );

    if (scrollToPercent) {
      const percent = Number(scrollToPercent[1]);

      if (percent <= 100) {
        return {
          action: "scrollToPercent",
          percent
        };
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
      command === "show links" ||
      command === "list links"
    ) {
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

    const clickMatch = command.match(
      /^(?:click|open|activate)\s+(?:the\s+)?(.+)$/
    );

    if (clickMatch) {
      const target = clickMatch[1];
      const index = numberFromText(target);

      return {
        action: "click",
        target,
        index
      };
    }

    const focusMatch = command.match(
      /^(?:focus|go to)\s+(?:the\s+)?(.+?)(?:\s+field)?$/
    );

    if (focusMatch) {
      const target = focusMatch[1];
      const index = numberFromText(target);

      return {
        action: "focus",
        target,
        index
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

  window.VUI.CommandParser = {
    parse
  };
})();