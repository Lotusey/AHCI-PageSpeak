(() => {
  // Expose browser-page actions to the command controller.
  window.VUI = window.VUI || {};

  // Scroll a matched control into view and activate it.
  function clickElement(item) {
    if (!item || !item.element) return false;

    item.element.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });

    setTimeout(() => {
      item.element.click();
    }, 250);

    return true;
  }

  // Scroll a matched control into view and move keyboard focus to it.
  function focusElement(item) {
    if (!item || !item.element) return false;

    item.element.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });

    setTimeout(() => {
      item.element.focus();
    }, 250);

    return true;
  }

  // Enter text into a supported text field and notify page listeners.
  function typeText(item, text) {
    if (!item || !item.element) return false;

    const element = item.element;

    if (
      !(element instanceof HTMLInputElement) &&
      !(element instanceof HTMLTextAreaElement)
    ) {
      return false;
    }

    element.focus();
    element.value = text;

    element.dispatchEvent(
      new Event("input", { bubbles: true })
    );

    element.dispatchEvent(
      new Event("change", { bubbles: true })
    );

    return true;
  }

  // Scroll by a fixed pixel amount in the requested direction.
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

  // Move through the scrollable portion of the page by a relative percentage.
  function scrollByPercentage(direction, percent) {
    const documentHeight =
      document.documentElement.scrollHeight;

    const viewportHeight =
      window.innerHeight;

    const maxScroll =
      documentHeight - viewportHeight;

    if (maxScroll <= 0) {
      return false;
    }

    const distance =
      maxScroll * (percent / 100);

    const amount =
      direction === "up"
        ? -distance
        : distance;

    window.scrollBy({
      top: amount,
      behavior: "smooth"
    });

    return true;
  }

  // Move to an absolute percentage of the page's scrollable distance.
  function scrollToPercentage(percent) {
    const documentHeight =
      document.documentElement.scrollHeight;

    const viewportHeight =
      window.innerHeight;

    const maxScroll =
      documentHeight - viewportHeight;

    if (maxScroll <= 0) {
      return false;
    }

    const position =
      maxScroll * (percent / 100);

    window.scrollTo({
      top: position,
      behavior: "smooth"
    });

    return true;
  }

  // Navigate to the start of the document.
  function scrollToTop() {
    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  }

  // Navigate to the end of the document.
  function scrollToBottom() {
    window.scrollTo({
      top: document.documentElement.scrollHeight,
      behavior: "smooth"
    });
  }

  // Use the browser's current-tab history navigation.
  function goBack() {
    window.history.back();
  }

  function goForward() {
    window.history.forward();
  }

  // Publish the actions that parsed voice commands can invoke.
  window.VUI.ActionEngine = {
    clickElement,
    focusElement,
    typeText,
    scroll,
    scrollByPercentage,
    scrollToPercentage,
    scrollToTop,
    scrollToBottom,
    goBack,
    goForward
  };
})();