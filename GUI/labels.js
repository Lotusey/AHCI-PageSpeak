(() => {
  window.VUI = window.VUI || {};

  // Numbered labels on the interactive elements currently on screen.
  //
  // Numbers stay attached to an element for as long as it stays on screen, so
  // "click 12" always means the element that is showing badge 12. Elements that
  // scroll into view take the lowest free numbers, which keeps numbers short.
  const state = {
    visible: false,
    filter: "all",          // all | links | buttons | inputs | candidates
    candidates: null,       // items being disambiguated, numbered 1..n
    previousFilter: null,   // what to restore after disambiguation
    byLabel: new Map(),
    byElement: new Map(),
    href: location.href
  };

  let observer = null;
  let mutationTimer = null;
  let scrollTimer = null;
  let changeListener = null;

  function collect() {
    const analyzer = window.VUI.PageAnalyzer;

    if (state.filter === "candidates") {
      return state.candidates.filter(item => analyzer.isInViewport(item.element));
    }

    const items = state.filter === "all"
      ? analyzer.getInteractiveElements()
      : analyzer.getElementsByType(state.filter);

    return items.filter(item =>
      analyzer.isInViewport(item.element) &&
      analyzer.isUnobscured(item.element)
    );
  }

  function assignNumbers(items) {
    const byLabel = new Map();

    if (state.filter === "candidates") {
      items.forEach(item => byLabel.set(state.candidates.indexOf(item) + 1, item));
      return byLabel;
    }

    const fresh = [];

    for (const item of items) {
      const previous = state.byElement.get(item.element);

      if (previous !== undefined && !byLabel.has(previous)) {
        byLabel.set(previous, item);
      } else {
        fresh.push(item);
      }
    }

    let next = 1;

    for (const item of fresh) {
      while (byLabel.has(next)) next++;
      byLabel.set(next, item);
    }

    return byLabel;
  }

  function items() {
    return [...state.byLabel.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([label, item]) => ({ ...item, label }));
  }

  function refresh() {
    clearTimeout(mutationTimer);
    clearTimeout(scrollTimer);
    mutationTimer = null;
    scrollTimer = null;

    if (!state.visible) return;

    // Single-page apps change the URL without reloading; start numbering afresh.
    if (location.href !== state.href) {
      state.href = location.href;
      state.byElement = new Map();
    }

    state.byLabel = assignNumbers(collect());
    state.byElement = new Map(
      [...state.byLabel].map(([label, item]) => [item.element, label])
    );

    const current = items();
    window.VUI.Overlay.renderBadges(current);

    if (changeListener) changeListener(current);
  }

  function onScroll() {
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(refresh, 200);
  }

  function onMutation(mutations) {
    const relevantMutation = mutations.some(mutation => {
      const target = mutation.target.nodeType === Node.ELEMENT_NODE
        ? mutation.target
        : mutation.target.parentElement;

      if (target?.closest("#ps-label-layer, #vui-overlay, #vui-reopen")) {
        return false;
      }

      if (mutation.type === "childList") {
        const changedNodes = [
          ...mutation.addedNodes,
          ...mutation.removedNodes
        ];

        if (
          changedNodes.length &&
          changedNodes.every(node => {
            const element = node.nodeType === Node.ELEMENT_NODE
              ? node
              : node.parentElement;
            return element?.closest("#ps-label-layer, #vui-overlay, #vui-reopen");
          })
        ) {
          return false;
        }
      }

      return true;
    });

    if (!relevantMutation) return;

    // Throttle rather than debounce, so pages that animate constantly still refresh.
    if (!mutationTimer) {
      mutationTimer = setTimeout(refresh, 400);
    }
  }

  function watch() {
    if (observer) return;

    observer = new MutationObserver(onMutation);
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "style", "hidden", "aria-hidden", "disabled", "aria-expanded"]
    });

    window.addEventListener("scroll", onScroll, { capture: true, passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
  }

  function unwatch() {
    observer?.disconnect();
    observer = null;

    window.removeEventListener("scroll", onScroll, { capture: true });
    window.removeEventListener("resize", onScroll);

    clearTimeout(mutationTimer);
    clearTimeout(scrollTimer);
    mutationTimer = null;
    scrollTimer = null;
  }

  function show(filter = "all") {
    if (state.filter !== filter) {
      state.byElement = new Map();
    }

    state.filter = filter;
    state.candidates = null;
    state.previousFilter = null;
    state.visible = true;

    watch();
    refresh();

    return items();
  }

  function showCandidates(candidates) {
    if (state.filter !== "candidates") {
      state.previousFilter = state.visible ? state.filter : null;
    }

    state.filter = "candidates";
    state.candidates = candidates;
    state.byElement = new Map();
    state.visible = true;

    watch();
    refresh();

    return items();
  }

  function endCandidates() {
    if (state.filter !== "candidates") return;

    const previous = state.previousFilter;

    if (previous) {
      show(previous);
    } else {
      hide();
    }
  }

  function hide() {
    state.visible = false;
    state.filter = "all";
    state.candidates = null;
    state.previousFilter = null;
    state.byLabel = new Map();
    state.byElement = new Map();

    unwatch();
    window.VUI.Overlay.renderBadges([]);

    if (changeListener) changeListener([]);
  }

  function get(label) {
    if (!state.visible) return null;

    const item = state.byLabel.get(label);

    return item && item.element.isConnected
      ? { ...item, label }
      : null;
  }

  window.VUI.Labels = {
    show,
    showCandidates,
    endCandidates,
    hide,
    get,
    items,
    isVisible: () => state.visible,
    isShowingCandidates: () => state.visible && state.filter === "candidates",
    onChange: listener => {
      changeListener = listener;
    }
  };
})();
