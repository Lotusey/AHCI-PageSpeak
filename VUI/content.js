(() => {
  window.VUI = window.VUI || {};

  const {
    PageAnalyzer: Analyzer,
    ActionEngine: Actions,
    CommandParser,
    OllamaParser,
    Overlay,
    Labels,
    Logger
  } = window.VUI;

  Overlay.createOverlay();

  const speech = new VUI.SpeechController();

  // A command waiting for the user to pick one of several matches.
  let pending = null;
  // The last text field or dropdown the user was in, so typing still works
  // after focus moves (e.g. to the Listen button).
  let lastField = null;
  // What the results area of the panel is showing: "labels", "headings", "help" or null.
  let resultsMode = null;

  const HELP = [
    { title: "Labels", examples: ["show labels", "show links", "show buttons", "show inputs", "click 4", "hide labels"] },
    { title: "Click and focus", examples: ["click sign in", "click the second link", "go to the search field", "highlight 7"] },
    { title: "Forms", examples: ["type hello", "type hello into 5", "clear", "next field", "check 3", "choose Canada", "set country to Canada", "press enter"] },
    { title: "Scrolling", examples: ["scroll down", "scroll down 20 percent", "scroll to half of the page", "go to the top"] },
    { title: "Browser", examples: ["go back", "reload", "new tab", "close tab", "zoom in", "reset zoom", "search for cats"] },
    { title: "Other", examples: ["read this page", "stop", "show headings", "stop listening", "what can I say"] }
  ];

  const SPEECH_ERRORS = {
    "not-allowed": "Microphone permission was denied.",
    "network": "Speech recognition could not reach its recognition service. Press Listen to try again.",
    "audio-capture": "No microphone was available.",
    "service-not-allowed": "Speech recognition is not allowed on this page."
  };

  function ok(message, extra = {}) {
    return { outcome: "success", message, ...extra };
  }

  function fail(message, extra = {}) {
    return { outcome: "failure", message, ...extra };
  }

  function report(result) {
    Overlay.setStatus(result.message);

    if (result.speak !== false) {
      VUI.speak(result.message);
    }
  }

  function describe(item) {
    if (item.name) return item.name;
    return item.label ? `${item.role} ${item.label}` : item.role;
  }

  function ordinal(n) {
    const suffix = n % 100 >= 11 && n % 100 <= 13
      ? "th"
      : { 1: "st", 2: "nd", 3: "rd" }[n % 10] || "th";
    return `${n}${suffix}`;
  }

  function showResults(mode, render) {
    resultsMode = mode;
    render();
  }

  // ---- Focus tracking ----

  document.addEventListener("focusin", event => {
    const element = event.composedPath()[0];

    if (Actions.isTextField(element) || element instanceof HTMLSelectElement) {
      lastField = element;
    }
  }, true);

  function activeElement() {
    const element = Analyzer.deepActiveElement();

    if (!element || element === document.body || Overlay.isOwnElement(element)) {
      return null;
    }

    return element;
  }

  function currentField() {
    const active = activeElement();

    if (active && (Actions.isTextField(active) || active instanceof HTMLSelectElement)) {
      return active;
    }

    if (lastField && lastField.isConnected && Analyzer.isVisible(lastField)) {
      return lastField;
    }

    return null;
  }

  // ---- Resolving which element a command refers to ----

  function hasReference(command) {
    return command.label != null || command.index != null || Boolean(command.target);
  }

  function withoutReference(command) {
    const { label, index, target, targetType, fallbackText, ...rest } = command;
    return rest;
  }

  function inferType(command) {
    if (command.targetType) return command.targetType;

    const target = (command.target || "").toLowerCase();
    if (["link", "links"].includes(target)) return "links";
    if (["button", "buttons"].includes(target)) return "buttons";
    if (["field", "fields", "input", "inputs"].includes(target)) return "inputs";
    return null;
  }

  // Returns { item }, { candidates }, or { error }.
  function resolveTarget(command, fieldsOnly = false) {
    if (command.label != null) {
      if (!Labels.isVisible()) {
        showLabelList("all");
        return { error: fail("Labels are now shown. Say the number again.") };
      }

      const item = Labels.get(command.label);
      return item
        ? { item }
        : { error: fail(`There is no label ${command.label} on screen.`) };
    }

    const type = fieldsOnly ? "inputs" : inferType(command);

    if (command.index != null) {
      const list = type
        ? Analyzer.getElementsByType(type)
        : Analyzer.getInteractiveElements();
      const item = list[command.index - 1];
      const noun = { links: "link", buttons: "button", inputs: "field" }[type] || "element";

      return item
        ? { item }
        : { error: fail(`There is no ${ordinal(command.index)} ${noun}.`) };
    }

    if (command.target) {
      return Analyzer.resolveByName(command.target, type) ||
        { error: fail(`I could not find ${command.target}.`) };
    }

    return { error: fail("Please say which element you mean.") };
  }

  function askToChoose(command, candidates) {
    pending = { command };
    const items = Labels.showCandidates(candidates);
    showResults("labels", () => Overlay.showList(items, "label"));

    return {
      outcome: "ambiguous",
      message: `I found ${candidates.length} matches for ${command.target}. Say the number of the one you want.`
    };
  }

  function withTarget(command, run, fieldsOnly = false) {
    const resolved = resolveTarget(command, fieldsOnly);

    if (resolved.error) return resolved.error;
    if (resolved.candidates) return askToChoose(command, resolved.candidates);

    const result = run(resolved.item);

    if (resolved.alsoMatched && result.outcome === "success") {
      result.message += ` ${resolved.alsoMatched} other matches are off screen.`;
    }

    return result;
  }

  // ---- Labels ----

  function showLabelList(type) {
    const items = Labels.show(type);
    showResults("labels", () => Overlay.showList(items, "label"));
    return items;
  }

  Labels.onChange(items => {
    if (resultsMode !== "labels") return;

    if (items.length || Labels.isVisible()) {
      Overlay.showList(items, "label");
    } else {
      Overlay.clearResults();
      resultsMode = null;
    }
  });

  // ---- Form commands ----

  function typeInto(element, text, name) {
    Overlay.highlightElement(element, { scroll: false });

    return Actions.typeText(element, text)
      ? ok(name ? `Typed into ${name}.` : "Text entered.")
      : fail("I could not enter text here.");
  }

  function typeCommand(command) {
    // "type ... in 5" while labels are hidden is most likely plain dictation.
    const skipReference = command.fallbackText && command.label != null && !Labels.isVisible();

    if (hasReference(command) && !skipReference) {
      const resolved = resolveTarget(command, true);

      if (resolved.item && Actions.isTextField(resolved.item.element)) {
        return typeInto(resolved.item.element, command.text, describe(resolved.item));
      }

      if (!command.fallbackText) {
        if (resolved.candidates) return askToChoose(command, resolved.candidates);
        return resolved.error || fail(`${describe(resolved.item)} is not a text field.`);
      }
    }

    const field = currentField();

    if (!field || !Actions.isTextField(field)) {
      return fail("Please focus a text field first, or say type, then your text, then into and a label number.");
    }

    return typeInto(field, command.fallbackText || command.text);
  }

  function clearCommand(command) {
    const clear = (element, name) => Actions.clearField(element)
      ? ok(name ? `Cleared ${name}.` : "Field cleared.")
      : fail("I can only clear text fields.");

    if (hasReference(command)) {
      return withTarget(command, item => clear(item.element, describe(item)), true);
    }

    const field = currentField();
    return field ? clear(field) : fail("Please focus a text field first.");
  }

  function checkCommand(command) {
    const checked = command.checked !== false;

    const apply = (element, name) => {
      const result = Actions.setChecked(element, checked);

      if (!result.ok) {
        return fail(result.reason === "radio"
          ? "A radio button cannot be unchecked. Choose another option instead."
          : `${name} is not a checkbox.`);
      }

      const verb = checked ? "checked" : "unchecked";
      return ok(result.changed ? `${name} ${verb}.` : `${name} was already ${verb}.`);
    };

    if (hasReference(command)) {
      return withTarget(command, item => apply(item.element, describe(item)));
    }

    const active = activeElement();

    if (active && Actions.isCheckable(active)) {
      return apply(active, Analyzer.getName(active) || "The box");
    }

    return fail("Say check followed by a label number or the name of the box.");
  }

  async function chooseOptionCommand(command) {
    const apply = (element, name) => {
      if (element instanceof HTMLSelectElement) {
        const chosen = Actions.chooseOption(element, command.option);
        return chosen
          ? ok(`Selected ${chosen}.`)
          : fail(`There is no option ${command.option} in ${name || "this list"}.`);
      }

      // "set name to Sam" on a text field replaces its contents.
      if (Actions.isTextField(element)) {
        Actions.clearField(element);
        return typeInto(element, command.option, name);
      }

      return fail(`${name || "That element"} is not a dropdown list.`);
    };

    if (hasReference(command)) {
      return withTarget(command, item => apply(item.element, describe(item)));
    }

    const field = currentField();
    if (field instanceof HTMLSelectElement) return apply(field);

    const selects = Analyzer.getElementsByType("inputs").filter(item =>
      item.element instanceof HTMLSelectElement && Analyzer.isInViewport(item.element)
    );

    if (selects.length === 1) return apply(selects[0].element, selects[0].name);

    // No dropdown in play: "choose sign in" most likely means click it.
    return execute({ action: "click", target: command.option });
  }

  function moveFocus(step, fieldsOnly) {
    const items = fieldsOnly
      ? Analyzer.getElementsByType("inputs")
      : Analyzer.getInteractiveElements();

    if (!items.length) {
      return fail(fieldsOnly ? "There are no fields on this page." : "There is nothing to focus on this page.");
    }

    const current = fieldsOnly ? currentField() : activeElement();
    const index = items.findIndex(item => item.element === current);
    const nextIndex = index === -1
      ? (step > 0 ? 0 : items.length - 1)
      : (index + step + items.length) % items.length;
    const next = items[nextIndex];

    Overlay.highlightElement(next.element);
    Actions.focusElement(next.element);

    return ok(`Focused ${describe(next)}.`);
  }

  // ---- Browser commands (handled by the background worker) ----

  async function browserAction(command) {
    const response = await chrome.runtime.sendMessage({
      type: "VUI_BROWSER_ACTION",
      command
    });

    return response?.ok
      ? ok(response.message)
      : fail(response?.message || "That browser command failed.");
  }

  // ---- Command execution ----

  async function execute(command) {
    switch (command.action) {
      case "stopReading":
        VUI.stopSpeaking();
        return ok("Stopped", { speak: false });

      case "help":
        showResults("help", () => Overlay.showHelp(HELP));
        return ok("Here are some things you can say.");

      case "readPage": {
        const summary = Analyzer.getPageSummary();
        const text = [
          summary.title,
          ...summary.headings,
          ...summary.paragraphs
        ]
          .filter(Boolean)
          .join(". ");

        if (!text) {
          return fail("I could not find readable page content.");
        }

        VUI.speak(text);
        return ok("Reading page", { speak: false });
      }

      case "back":
        setTimeout(() => Actions.goBack(), 250);
        return ok("Going back");

      case "forward":
        setTimeout(() => Actions.goForward(), 250);
        return ok("Going forward");

      case "reload":
        setTimeout(() => window.location.reload(), 250);
        return ok("Reloading");

      case "newTab":
      case "closeTab":
      case "search":
      case "zoom":
        return browserAction(command);

      case "scroll":
        Actions.scroll(command.direction);
        return ok(command.direction === "down" ? "Scrolling down" : "Scrolling up", { speak: false });

      case "scrollPercent":
        return Actions.scrollByPercentage(command.direction, command.percent)
          ? ok(`Scrolled ${command.direction} ${command.percent} percent.`)
          : fail("This page cannot be scrolled.");

      case "scrollToPercent":
        return Actions.scrollToPercentage(command.percent)
          ? ok(`Moved to ${command.percent} percent of the page.`)
          : fail("This page cannot be scrolled.");

      case "top":
        Actions.scrollToTop();
        return ok("At the top", { speak: false });

      case "bottom":
        Actions.scrollToBottom();
        return ok("At the bottom", { speak: false });

      case "showLabels": {
        const type = command.type || "all";
        const items = showLabelList(type);
        const noun = type === "all" ? "labels" : type;

        return items.length
          ? ok(`Showing ${items.length} ${noun}.`)
          : fail(`No ${type === "all" ? "elements" : type} on screen.`);
      }

      case "hideLabels":
        if (!Labels.isVisible()) {
          return fail("No labels are shown.");
        }

        Labels.hide();
        return ok("Labels hidden.");

      case "listHeadings": {
        const items = Analyzer.getElementsByType("headings");
        showResults("headings", () => Overlay.showList(items, "index"));
        return ok(`Found ${items.length} headings.`);
      }

      case "highlight":
        return withTarget(command, item => {
          Overlay.highlightElement(item.element);
          return ok(`Highlighted ${describe(item)}.`);
        });

      case "click":
        return withTarget(command, item => {
          Overlay.highlightElement(item.element);
          Actions.clickElement(item.element);
          return ok(`Clicked ${describe(item)}.`);
        });

      case "focus":
        return withTarget(command, item => {
          Overlay.highlightElement(item.element);
          Actions.focusElement(item.element);
          return ok(`Focused ${describe(item)}.`);
        });

      case "type":
        return typeCommand(command);

      case "clear":
        return clearCommand(command);

      case "check":
        return checkCommand(command);

      case "chooseOption":
        return chooseOptionCommand(command);

      case "pressKey":
        if (command.key === "tab") return moveFocus(1, false);
        if (command.key === "shiftTab") return moveFocus(-1, false);
        return ok(Actions.pressKey(command.key, activeElement() || currentField()));

      case "nextField":
        return moveFocus(1, true);

      case "previousField":
        return moveFocus(-1, true);

      case "cancel":
        return { outcome: "cancelled", message: "Okay." };

      case "stopListening":
        speech.stop();
        return ok("Stopped listening.");

      default:
        return {
          outcome: "unknown",
          message: `I did not understand "${command.text || "that command"}".`
        };
    }
  }

  async function runCommand(command) {
    const previousPending = pending;
    pending = null;

    let result;

    if (command.action === "choose") {
      // A bare number answers a "which one?" question, or clicks that label.
      result = previousPending
        ? await execute({ ...withoutReference(previousPending.command), label: command.label })
        : await execute({ action: "click", label: command.label });

      if (previousPending && result.outcome === "failure" && Labels.isShowingCandidates()) {
        pending = previousPending;
      }
    } else {
      result = await execute(command);
    }

    if (!pending && Labels.isShowingCandidates()) {
      Labels.endCandidates();
    }

    return result;
  }

  // ---- Speech handling ----

  function isResolvable(command) {
    if (!command.target || command.label != null || command.index != null) return true;
    if (command.action === "type" && command.fallbackText) return true;
    return Analyzer.resolveByName(command.target, inferType(command)) !== null;
  }

  // Tries each recognition alternative with the rule-based parser. Prefers one
  // whose target exists on the page ("sign in" over "sine in").
  function pickCommand(alternatives) {
    let fallback = null;

    for (const { transcript } of alternatives) {
      const command = CommandParser.parse(transcript);
      if (command.action === "unknown") continue;

      if (isResolvable(command)) {
        return { command, usedTranscript: transcript, resolvable: true };
      }

      fallback = fallback || { command, usedTranscript: transcript, resolvable: false };
    }

    return fallback || { command: null, usedTranscript: null, resolvable: false };
  }

  function briefList(items, key, limit) {
    return items.slice(0, limit).map(item => ({
      [key]: item[key],
      role: item.role,
      name: item.name.slice(0, 80)
    }));
  }

  function modelTargets() {
    return {
      labels: Labels.isVisible() ? briefList(Labels.items(), "label", 80) : [],
      links: briefList(Analyzer.getElementsByType("links"), "index", 60),
      buttons: briefList(Analyzer.getElementsByType("buttons"), "index", 40),
      inputs: briefList(Analyzer.getElementsByType("inputs"), "index", 30)
    };
  }

  async function handleSpeech(alternatives) {
    const startedAt = performance.now();
    const transcript = alternatives[0].transcript;

    Overlay.clearHighlights();
    Overlay.setTranscript(transcript);

    let { command, usedTranscript, resolvable } = pickCommand(alternatives);
    let source = command ? "rules" : "none";
    let result;

    try {
      if (!resolvable) {
        // Unknown wording, or a target that is not on the page: ask the local model.
        Overlay.setStatus("Interpreting with local model...");

        try {
          const modelCommand = await OllamaParser.parse(transcript, modelTargets());

          if (modelCommand.action !== "unknown" || !command) {
            command = modelCommand;
            usedTranscript = transcript;
            source = "llm";
          }
        } catch (error) {
          if (!command) {
            throw new Error(`Local command interpretation failed: ${error.message}`);
          }

          console.warn("Local model unavailable; using the rule-based command.", error);
        }
      }

      if (command.action === "unknown") {
        command = { action: "unknown", text: transcript };
      }

      result = await runCommand(command);
    } catch (error) {
      console.error("Voice command failed:", error);
      result = {
        outcome: "error",
        message: error?.message || "Something went wrong."
      };
    }

    report(result);

    Logger.record({
      transcript,
      alternatives: alternatives.map(alternative => alternative.transcript),
      confidence: alternatives[0].confidence,
      usedTranscript,
      source,
      command,
      outcome: result.outcome,
      message: result.message,
      latencyMs: Math.round(performance.now() - startedAt)
    });
  }

  speech.onStateChange = state => {
    Overlay.setListening(state === "listening");
  };

  // Commands said in quick succession run one after another, in order.
  let commandQueue = Promise.resolve();

  speech.onResult = alternatives => {
    commandQueue = commandQueue
      .then(() => handleSpeech(alternatives))
      .catch(error => console.error("Voice command failed:", error));
  };

  speech.onError = error => {
    Overlay.setStatus(SPEECH_ERRORS[error] || `Speech recognition error: ${error}`);
  };

  // ---- Panel buttons ----

  function onPanelButton(id, handler) {
    const button = Overlay.$(id);

    // Keep focus in the page (e.g. in a text field the user is filling in).
    button.addEventListener("mousedown", event => event.preventDefault());
    button.addEventListener("click", handler);
  }

  // Listen keeps listening until pressed again, Stop is pressed, or the
  // user says "stop listening".
  onPanelButton("ps-mic", () => {
    if (speech.isListening()) {
      speech.stop();
      Overlay.setStatus("Stopped listening");
    } else {
      speech.start();
    }
  });

  onPanelButton("ps-stop", () => {
    speech.stop();
    VUI.stopSpeaking();
    Overlay.setStatus("Stopped");
  });

  onPanelButton("ps-close", () => Overlay.hidePanel());
  onPanelButton("ps-reopen", () => Overlay.showPanel());

  Overlay.setStatus(
    speech.isSupported()
      ? "Ready"
      : "Speech recognition unavailable"
  );
})();
