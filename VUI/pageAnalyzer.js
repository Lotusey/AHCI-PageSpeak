(() => {
  window.VUI = window.VUI || {};

  const FIELD_SELECTOR = [
    "input:not([type='hidden']):not([type='password']):not([type='file'])",
    "textarea",
    "select",
    "[contenteditable='true']",
    "[contenteditable='']",
    "[role='textbox']",
    "[role='searchbox']",
    "[role='combobox']"
  ].join(",");

  const INTERACTIVE_SELECTOR = [
    "a[href]",
    "button",
    "summary",
    FIELD_SELECTOR,
    "[role='button']",
    "[role='link']",
    "[role='checkbox']",
    "[role='radio']",
    "[role='switch']",
    "[role='tab']",
    "[role='menuitem']",
    "[role='option']",
    "[tabindex]:not([tabindex='-1'])"
  ].join(",");

  // Elements whose descendants should not get a separate label (e.g. <a><span tabindex=0>).
  const ACTIVATABLE_SELECTOR = "a[href], button, [role='button'], [role='link']";

  const TYPE_SELECTORS = {
    links: "a[href], [role='link']",
    buttons: "button, input[type='button'], input[type='submit'], input[type='reset'], [role='button']",
    inputs: FIELD_SELECTOR,
    headings: "h1, h2, h3, h4, h5, h6"
  };

  function cleanText(value) {
    return (value || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function isVisible(element) {
    if (!element || !element.isConnected) return false;

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

  function isInViewport(element) {
    if (!isVisible(element)) return false;

    const rect = element.getBoundingClientRect();

    return (
      rect.bottom > 0 &&
      rect.right > 0 &&
      rect.top < window.innerHeight &&
      rect.left < window.innerWidth
    );
  }

  // True when the element is not covered by something else (a modal, sticky header, or our panel).
  function isUnobscured(element) {
    const rect = element.getBoundingClientRect();
    const clampX = x => Math.min(Math.max(x, 0), window.innerWidth - 1);
    const clampY = y => Math.min(Math.max(y, 0), window.innerHeight - 1);
    const points = [
      [clampX(rect.left + rect.width / 2), clampY(rect.top + rect.height / 2)],
      [clampX(rect.left + 2), clampY(rect.top + 2)]
    ];

    return points.some(([x, y]) => {
      const hit = document.elementFromPoint(x, y);
      return Boolean(hit) && (
        hit === element ||
        element.contains(hit) ||
        hit.contains(element)
      );
    });
  }

  function isDisabled(element) {
    return element.disabled === true ||
      element.getAttribute("aria-disabled") === "true";
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

    if (element.labels && element.labels.length) {
      const text = cleanText(
        [...element.labels].map(label => label.innerText).join(" ")
      );
      if (text) return text;
    }

    const title = cleanText(element.getAttribute("title"));
    if (title) return title;

    const placeholder = cleanText(element.getAttribute("placeholder"));
    if (placeholder) return placeholder;

    if (
      element instanceof HTMLInputElement &&
      ["button", "submit", "reset"].includes(element.type)
    ) {
      const value = cleanText(element.value);
      if (value) return value;
    }

    if (!(element instanceof HTMLSelectElement)) {
      const text = cleanText(element.innerText || element.textContent);
      if (text) return text;
    }

    const imageAlt = cleanText(element.querySelector("img[alt]")?.getAttribute("alt"));
    if (imageAlt) return imageAlt;

    const svgTitle = cleanText(element.querySelector("svg title")?.textContent);
    if (svgTitle) return svgTitle;

    return cleanText(element.getAttribute("name"));
  }

  function getRole(element) {
    const explicitRole = cleanText(element.getAttribute("role"));
    if (explicitRole) return explicitRole;

    const tag = element.tagName.toLowerCase();

    if (tag === "a") return "link";
    if (tag === "button" || tag === "summary") return "button";
    if (tag === "input") {
      if (["button", "submit", "reset"].includes(element.type)) return "button";
      if (["checkbox", "radio"].includes(element.type)) return element.type;
      if (element.type === "range") return "slider";
      return "textbox";
    }
    if (tag === "textarea") return "textbox";
    if (tag === "select") return "combobox";
    if (tag === "nav") return "navigation";
    if (/^h[1-6]$/.test(tag)) return "heading";
    if (element.isContentEditable) return "textbox";

    return tag;
  }

  // Coarse category used to colour labels.
  function getKind(element, role) {
    if (role === "link") return "link";
    if (element.matches(FIELD_SELECTOR) || ["checkbox", "radio", "switch", "slider"].includes(role)) {
      return "input";
    }
    if (["button", "tab", "menuitem", "option"].includes(role)) return "button";
    return "other";
  }

  function toItem(element, index) {
    const role = getRole(element);

    return {
      index: index + 1,
      element,
      role,
      name: getName(element),
      kind: getKind(element, role)
    };
  }

  function dedupeNested(elements) {
    const activatable = new Set(
      elements.filter(element => element.matches(ACTIVATABLE_SELECTOR))
    );

    return elements.filter(element => {
      if (element.matches(FIELD_SELECTOR)) return true;

      for (let parent = element.parentElement; parent; parent = parent.parentElement) {
        if (activatable.has(parent)) return false;
      }

      return true;
    });
  }

  function getElementsByType(type) {
    const selector = TYPE_SELECTORS[type];
    if (!selector) return [];

    return [...document.querySelectorAll(selector)]
      .filter(element => isVisible(element) && !isDisabled(element))
      .map(toItem);
  }

  function getVisibleElementsByType(type) {
    return getElementsByType(type)
      .filter(item => isInViewport(item.element));
  }

  function getInteractiveElements() {
    const elements = [...document.querySelectorAll(INTERACTIVE_SELECTOR)]
      .filter(element => isVisible(element) && !isDisabled(element));

    return dedupeNested(elements).map(toItem);
  }

  function deepActiveElement() {
    let element = document.activeElement;

    while (element && element.shadowRoot && element.shadowRoot.activeElement) {
      element = element.shadowRoot.activeElement;
    }

    return element;
  }

  // ---- Fuzzy name matching ----

  function normalizeName(value) {
    return cleanText(value)
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function levenshtein(a, b) {
    let previous = Array.from({ length: b.length + 1 }, (_, i) => i);

    for (let i = 1; i <= a.length; i++) {
      const current = [i];

      for (let j = 1; j <= b.length; j++) {
        current[j] = Math.min(
          previous[j] + 1,
          current[j - 1] + 1,
          previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
        );
      }

      previous = current;
    }

    return previous[b.length];
  }

  function similarity(a, b) {
    const longest = Math.max(a.length, b.length);
    return longest === 0 ? 1 : 1 - levenshtein(a, b) / longest;
  }

  // Scores how well a spoken name matches an element name: 1 for an exact match,
  // ~0.8-0.9 for containment (shorter names score higher), up to ~0.75 for
  // near-misses such as "sine in" vs "sign in", and 0 for no match.
  function scoreName(query, name) {
    const q = normalizeName(query);
    const n = normalizeName(name);

    if (!q || !n) return 0;
    if (n === q) return 1;

    const lengthPenalty = 0.1 * (1 - q.length / n.length);

    if (` ${n} `.includes(` ${q} `)) return 0.9 - lengthPenalty;
    if (q.length >= 3 && n.includes(q)) return 0.8 - lengthPenalty;
    if (q.length < 4) return 0;

    const queryWords = q.split(" ");
    const nameWords = n.split(" ");
    let best = similarity(q, n);

    for (let size = Math.max(1, queryWords.length - 1); size <= queryWords.length + 1; size++) {
      for (let start = 0; start + size <= nameWords.length; start++) {
        best = Math.max(
          best,
          similarity(q, nameWords.slice(start, start + size).join(" "))
        );
      }
    }

    return best >= 0.75 ? best * 0.75 : 0;
  }

  function dedupeSameDestination(items) {
    const seen = new Set();

    return items.filter(item => {
      const href = item.element.getAttribute("href");
      if (!href) return true;
      if (seen.has(href)) return false;
      seen.add(href);
      return true;
    });
  }

  // Returns { item }, { candidates } when several elements match equally well,
  // or null when nothing matches.
  function resolveByName(query, type = null) {
    const pool = type && TYPE_SELECTORS[type]
      ? getElementsByType(type)
      : getInteractiveElements();

    const scored = pool
      .map(item => ({ item, score: scoreName(query, item.name) }))
      .filter(match => match.score >= 0.55)
      .sort((a, b) => b.score - a.score);

    if (!scored.length) return null;

    const top = scored[0].score;
    const tied = dedupeSameDestination(
      scored
        .filter(match => top - match.score <= 0.02)
        .map(match => match.item)
    );

    if (tied.length === 1) return { item: tied[0] };

    const onScreen = tied.filter(item => isInViewport(item.element));

    if (onScreen.length === 1) return { item: onScreen[0] };
    if (onScreen.length > 1) return { candidates: onScreen.slice(0, 9) };

    return { item: tied[0], alsoMatched: tied.length - 1 };
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
    isInViewport,
    isUnobscured,
    cleanText,
    getName,
    getRole,
    getElementsByType,
    getVisibleElementsByType,
    getInteractiveElements,
    deepActiveElement,
    scoreName,
    resolveByName,
    getPageSummary
  };
})();
