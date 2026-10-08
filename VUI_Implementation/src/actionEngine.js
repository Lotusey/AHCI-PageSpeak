(() => {
  window.VUI = window.VUI || {};

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