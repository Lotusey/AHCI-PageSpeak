(() => {
  window.VUI = window.VUI || {};

  const TEXT_INPUT_TYPES = new Set([
    "text", "search", "email", "url", "tel", "number"
  ]);

  // Inputs where an automatic space between dictated chunks would corrupt the value.
  const NO_SPACE_INPUT_TYPES = new Set(["email", "url", "tel", "number"]);

  function isContentEditable(element) {
    return element instanceof HTMLElement && element.isContentEditable;
  }

  function isTextField(element) {
    if (!element || element.disabled || element.readOnly) return false;
    if (element instanceof HTMLTextAreaElement) return true;
    if (element instanceof HTMLInputElement) return TEXT_INPUT_TYPES.has(element.type);
    return isContentEditable(element);
  }

  function isCheckable(element) {
    if (!element) return false;
    if (element instanceof HTMLInputElement) {
      return element.type === "checkbox" || element.type === "radio";
    }
    return ["checkbox", "radio", "switch"].includes(element.getAttribute("role"));
  }

  function scrollThen(element, action) {
    element.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });

    setTimeout(action, 250);
  }

  function moveCaretToEnd(element) {
    if (isContentEditable(element)) {
      const range = document.createRange();
      range.selectNodeContents(element);
      range.collapse(false);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      return;
    }

    try {
      const length = element.value.length;
      element.setSelectionRange(length, length);
    } catch (error) {
      // Some input types (email, number) do not support selection ranges.
    }
  }

  function clickElement(element) {
    if (!element) return false;

    scrollThen(element, () => element.click());

    return true;
  }

  function focusElement(element) {
    if (!element) return false;

    scrollThen(element, () => {
      element.focus({ preventScroll: true });

      if (isTextField(element)) {
        moveCaretToEnd(element);
      }
    });

    return true;
  }

  // Uses the prototype's value setter so frameworks that patch the element's
  // own `value` property (React, Vue) still see the change.
  function setNativeValue(element, value) {
    const prototype = element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : element instanceof HTMLSelectElement
        ? HTMLSelectElement.prototype
        : HTMLInputElement.prototype;

    const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;

    if (setter) {
      setter.call(element, value);
    } else {
      element.value = value;
    }
  }

  function dispatchInput(element, inputType, data = null) {
    element.dispatchEvent(
      new InputEvent("input", { bubbles: true, inputType, data })
    );

    element.dispatchEvent(
      new Event("change", { bubbles: true })
    );
  }

  function typeIntoContentEditable(element, text) {
    const selection = window.getSelection();

    if (!selection.rangeCount || !element.contains(selection.anchorNode)) {
      moveCaretToEnd(element);
    }

    const before = document.createRange();
    before.selectNodeContents(element);
    before.setEnd(selection.anchorNode, selection.anchorOffset);

    const insert = /\S$/.test(before.toString()) ? ` ${text}` : text;

    if (!document.execCommand("insertText", false, insert)) {
      element.append(document.createTextNode(insert));
      element.dispatchEvent(
        new InputEvent("input", { bubbles: true, inputType: "insertText", data: insert })
      );
    }
  }

  // Inserts text at the caret (or the end of the field), so dictating several
  // phrases in a row builds up the text instead of replacing it.
  function typeText(element, text) {
    if (!isTextField(element)) return false;

    const wasFocused = document.activeElement === element;
    element.focus();

    if (isContentEditable(element)) {
      typeIntoContentEditable(element, text);
      return true;
    }

    const value = element.value;
    let start = value.length;
    let end = value.length;

    if (wasFocused) {
      try {
        if (element.selectionStart !== null) {
          start = element.selectionStart;
          end = element.selectionEnd;
        }
      } catch (error) {
        // Input type does not expose a selection.
      }
    }

    const needsSpace =
      start > 0 &&
      /\S/.test(value[start - 1]) &&
      !NO_SPACE_INPUT_TYPES.has(element.type);
    const insert = needsSpace ? ` ${text}` : text;

    setNativeValue(element, value.slice(0, start) + insert + value.slice(end));

    try {
      const caret = start + insert.length;
      element.setSelectionRange(caret, caret);
    } catch (error) {
      // Input type does not support selection ranges.
    }

    dispatchInput(element, "insertText", insert);

    return true;
  }

  function clearField(element) {
    if (!isTextField(element)) return false;

    element.focus();

    if (isContentEditable(element)) {
      const range = document.createRange();
      range.selectNodeContents(element);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);

      if (!document.execCommand("delete")) {
        element.textContent = "";
        element.dispatchEvent(
          new InputEvent("input", { bubbles: true, inputType: "deleteContent" })
        );
      }

      return true;
    }

    setNativeValue(element, "");
    dispatchInput(element, "deleteContentBackward");

    return true;
  }

  // Returns { ok, changed, reason }.
  function setChecked(element, checked) {
    if (!isCheckable(element)) return { ok: false, reason: "not-checkable" };

    const isNative = element instanceof HTMLInputElement;
    const current = isNative
      ? element.checked
      : element.getAttribute("aria-checked") === "true";

    if (current === checked) return { ok: true, changed: false };

    const isRadio = isNative
      ? element.type === "radio"
      : element.getAttribute("role") === "radio";

    if (isRadio && !checked) return { ok: false, reason: "radio" };

    // click() fires the same events as a real click, so page scripts update too.
    element.click();

    return { ok: true, changed: true };
  }

  // Selects the option whose text best matches `text` (or the Nth option when
  // `text` is a number). Returns the chosen option's text, or null.
  function chooseOption(select, text) {
    if (!(select instanceof HTMLSelectElement)) return null;

    const analyzer = window.VUI.PageAnalyzer;
    const options = [...select.options].filter(option => !option.disabled);
    let best = null;
    let bestScore = 0;

    for (const option of options) {
      const score = Math.max(
        analyzer.scoreName(text, option.text),
        analyzer.scoreName(text, option.value)
      );

      if (score > bestScore) {
        best = option;
        bestScore = score;
      }
    }

    if (!best || bestScore < 0.55) {
      const position = window.VUI.CommandParser.parseNumber(text.toLowerCase());
      best = position ? options[position - 1] : null;
    }

    if (!best) return null;

    select.focus();
    select.selectedIndex = best.index;
    dispatchInput(select, "insertReplacementText");

    return analyzer.cleanText(best.text);
  }

  function dispatchKey(target, key, code, keyCode) {
    for (const type of ["keydown", "keypress", "keyup"]) {
      if (type === "keypress" && key !== "Enter") continue;

      target.dispatchEvent(new KeyboardEvent(type, {
        key,
        code,
        keyCode,
        which: keyCode,
        bubbles: true,
        cancelable: true,
        composed: true
      }));
    }
  }

  // Returns a short description of what happened.
  function pressKey(key, target) {
    const element = target || document.body;

    if (key === "escape") {
      dispatchKey(element, "Escape", "Escape", 27);
      return "Pressed escape.";
    }

    if (element.matches?.("a[href], button, summary, [role='button'], [role='link']")) {
      element.click();
      return "Pressed enter.";
    }

    const form = element.form || element.closest?.("form");

    if (form && element !== document.body) {
      if (form.requestSubmit) {
        form.requestSubmit();
      } else {
        form.submit();
      }

      return "Submitted the form.";
    }

    // Many search boxes outside a <form> submit on an Enter key handler.
    dispatchKey(element, "Enter", "Enter", 13);

    return "Pressed enter.";
  }

  function scroll(direction, amount = 600) {
    const distance =
      direction === "up"
        ? -amount
        : amount;

    window.scrollBy({
      top: distance,
      behavior: "smooth"
    });
  }

  function scrollByPercentage(direction, percent) {
    const maxScroll =
      document.documentElement.scrollHeight - window.innerHeight;

    if (maxScroll <= 0) {
      return false;
    }

    const distance =
      maxScroll * (percent / 100);

    window.scrollBy({
      top: direction === "up" ? -distance : distance,
      behavior: "smooth"
    });

    return true;
  }

  function scrollToPercentage(percent) {
    const maxScroll =
      document.documentElement.scrollHeight - window.innerHeight;

    if (maxScroll <= 0) {
      return false;
    }

    window.scrollTo({
      top: maxScroll * (percent / 100),
      behavior: "smooth"
    });

    return true;
  }

  function scrollToTop() {
    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  }

  function scrollToBottom() {
    window.scrollTo({
      top: document.documentElement.scrollHeight,
      behavior: "smooth"
    });
  }

  function goBack() {
    window.history.back();
  }

  function goForward() {
    window.history.forward();
  }

  window.VUI.ActionEngine = {
    isTextField,
    isCheckable,
    clickElement,
    focusElement,
    typeText,
    clearField,
    setChecked,
    chooseOption,
    pressKey,
    scroll,
    scrollByPercentage,
    scrollToPercentage,
    scrollToTop,
    scrollToBottom,
    goBack,
    goForward
  };
})();
