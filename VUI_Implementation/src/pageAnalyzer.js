(() => {
  window.VUI = window.VUI || {};

  const ignoredInputTypes = new Set([
    "password",
    "hidden",
    "file"
  ]);

  function isVisible(element) {
    if (!element) return false;

    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();

    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      style.opacity !== "0" &&
      rect.width > 0 &&
      rect.height > 0
    );
  }

  function cleanText(value) {
    return (value || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function getName(element) {
    const ariaLabel = cleanText(element.getAttribute("aria-label"));
    if (ariaLabel) return ariaLabel;

    const labelledBy = element.getAttribute("aria-labelledby");
    if (labelledBy) {
      const labels = labelledBy
        .split(/\s+/)
        .map(id => document.getElementById(id))
        .filter(Boolean)
        .map(el => cleanText(el.innerText))
        .filter(Boolean);

      if (labels.length) return labels.join(" ");
    }

    const title = cleanText(element.getAttribute("title"));
    if (title) return title;

    const placeholder = cleanText(element.getAttribute("placeholder"));
    if (placeholder) return placeholder;

    return cleanText(element.innerText || element.textContent);
  }

  function getRole(element) {
    const explicitRole = cleanText(element.getAttribute("role"));
    if (explicitRole) return explicitRole;

    const tag = element.tagName.toLowerCase();

    if (tag === "a") return "link";
    if (tag === "button") return "button";
    if (tag === "input") return "textbox";
    if (tag === "textarea") return "textbox";
    if (tag === "select") return "combobox";
    if (tag === "nav") return "navigation";
    if (/^h[1-6]$/.test(tag)) return "heading";

    return tag;
  }

  function getElementsByType(type) {
    const selectors = {
      links: "a[href]",
      buttons: "button, input[type='button'], input[type='submit'], [role='button']",
      inputs: "input:not([type='hidden']):not([type='password']):not([type='file']), textarea, select",
      headings: "h1, h2, h3, h4, h5, h6"
    };

    const selector = selectors[type];
    if (!selector) return [];

    return [...document.querySelectorAll(selector)]
      .filter(isVisible)
      .map((element, index) => ({
        index: index + 1,
        element,
        role: getRole(element),
        name: getName(element)
      }));
  }

  function getInteractiveElements() {
    const selector = [
      "a[href]",
      "button",
      "input:not([type='hidden']):not([type='password']):not([type='file'])",
      "textarea",
      "select",
      "[role='button']",
      "[role='link']",
      "[role='textbox']",
      "[tabindex]:not([tabindex='-1'])"
    ].join(",");

    return [...document.querySelectorAll(selector)]
      .filter(isVisible)
      .map((element, index) => ({
        index: index + 1,
        element,
        role: getRole(element),
        name: getName(element)
      }))
      .filter(item => item.name);
  }

  function findByName(query, type = null) {
    const normalized = cleanText(query).toLowerCase();

    let candidates;

    if (type) {
      candidates = getElementsByType(type);
    } else {
      candidates = getInteractiveElements();
    }

    return candidates.find(item =>
      item.name.toLowerCase() === normalized
    ) || candidates.find(item =>
      item.name.toLowerCase().includes(normalized)
    );
  }

  function getPageSummary() {
    const title = cleanText(document.title);
    const headings = getElementsByType("headings")
      .slice(0, 10)
      .map(item => item.name)
      .filter(Boolean);

    const paragraphs = [...document.querySelectorAll("main p, article p, p")]
      .filter(isVisible)
      .map(p => cleanText(p.innerText))
      .filter(text => text.length > 20)
      .slice(0, 8);

    return {
      title,
      headings,
      paragraphs
    };
  }

  window.VUI.PageAnalyzer = {
    isVisible,
    cleanText,
    getName,
    getRole,
    getElementsByType,
    getInteractiveElements,
    findByName,
    getPageSummary
  };
})();
