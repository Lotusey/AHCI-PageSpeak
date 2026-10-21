(() => {
  // Coordinate speech recognition, command handling, page actions, and UI.
  window.VUI = window.VUI || {};

  // Build the voice panel and initialize its speech and control references.
  VUI.Overlay.createOverlay();

  const speech = new VUI.SpeechController();

  const micButton =
    document.getElementById("vui-mic");

  const stopButton =
    document.getElementById("vui-stop");

  const closeButton =
    document.getElementById("vui-close");

  let shownListType = null;
  let showingLabels = false;

  // Explain when speech recognition cannot be used in this browser.
  if (!speech.isSupported()) {
    VUI.Overlay.setStatus(
      "Speech recognition is not supported in this browser."
    );
  }

  // Keep the interface status and spoken confirmation in sync.
  function speakAndShow(message) {
    VUI.Overlay.setStatus(message);
    VUI.speak(message);
  }

  // Retrieve a categorized list of targets for parsing or execution.
  function getTargetList(type) {
    if (type === "focusables") {
      return VUI.PageAnalyzer.getInteractiveElements();
    }

    return VUI.PageAnalyzer.getElementsByType(type);
  }

  // Resolve a visible badge number before falling back to list positions.
  function findTarget(command, items) {
    if (command.index) {
      if (!command.targetType && VUI.Labels.isVisible()) {
        const labeledItem = VUI.Labels.get(command.index);
        if (labeledItem) return labeledItem;
      }

      return items[command.index - 1] || null;
    }

    return VUI.PageAnalyzer.findByName(
      command.target,
      command.targetType || null
    ) || null;
  }

  // Display the stable numbers used by on-page labels.
  function showLabels() {
    showingLabels = true;
    shownListType = null;
    const items = VUI.Labels.show();
    VUI.Overlay.showList(
      items.map(item => ({ ...item, index: item.label }))
    );
    VUI.Overlay.setStatus(`Showing ${items.length} numbered labels`);
    VUI.speak(`${items.length} numbered labels shown.`);
  }

  // Execute a parsed action and report its outcome through the interface.
  function executeCommand(command) {
    VUI.Logger.record({
      event: "command",
      action: command.action
    }).catch(error => {
      console.error("Could not record PageSpeak usage:", error);
    });

    switch (command.action) {
      case "stopReading":
        VUI.stopSpeaking();
        VUI.Overlay.setStatus("Stopped");
        return;

      case "readPage": {
        const summary =
          VUI.PageAnalyzer.getPageSummary();

        const text = [
          summary.title,
          ...summary.headings,
          ...summary.paragraphs
        ]
          .filter(Boolean)
          .join(". ");

        if (!text) {
          speakAndShow("I could not find readable page content.");
          return;
        }

        VUI.Overlay.setStatus("Reading page");
        VUI.speak(text);
        return;
      }

      case "back":
        speakAndShow("Going back");
        setTimeout(() => VUI.ActionEngine.goBack(), 250);
        return;

      case "forward":
        speakAndShow("Going forward");
        setTimeout(() => VUI.ActionEngine.goForward(), 250);
        return;

      case "scroll":
        VUI.ActionEngine.scroll(command.direction);
        VUI.Overlay.setStatus(
          command.direction === "down"
            ? "Scrolling down"
            : "Scrolling up"
        );
        return;

      case "scrollPercent": {
        const success =
          VUI.ActionEngine.scrollByPercentage(
            command.direction,
            command.percent
          );

        if (!success) {
          speakAndShow("This page cannot be scrolled.");
          return;
        }

        speakAndShow(
          `Scrolled ${command.direction} ${command.percent} percent.`
        );

        return;
      }

      case "scrollToPercent": {
        const success =
          VUI.ActionEngine.scrollToPercentage(
            command.percent
          );

        if (!success) {
          speakAndShow("This page cannot be scrolled.");
          return;
        }

        speakAndShow(
          `Moved to ${command.percent} percent of the page.`
        );

        return;
      }

      case "top":
        VUI.ActionEngine.scrollToTop();
        VUI.Overlay.setStatus("At the top");
        return;

      case "bottom":
        VUI.ActionEngine.scrollToBottom();
        VUI.Overlay.setStatus("At the bottom");
        return;

      case "list": {
        const items =
          getTargetList(command.type);

        VUI.Overlay.showList(items);
        shownListType = command.type;

        VUI.Overlay.setStatus(
          `Found ${items.length} ${command.type}`
        );

        VUI.speak(
          `${items.length} ${command.type} found.`
        );

        return;
      }

      case "listVisibleLinks": {
        const items =
          VUI.PageAnalyzer.getVisibleElementsByType("links");

        VUI.Overlay.showList(items);
        VUI.Overlay.highlightVisibleElements(items);
        shownListType = "links";
        VUI.Overlay.setStatus(`Found ${items.length} visible links`);
        VUI.speak(`${items.length} visible links found.`);
        return;
      }

      case "hideLinks":
        if (shownListType !== "links") {
          speakAndShow("Cannot hide links without links being shown.");
          return;
        }

        VUI.Overlay.clearResults();
        shownListType = null;
        speakAndShow("Links hidden.");
        return;

      case "showLabels":
        showLabels();
        return;

      case "hideLabels":
        showingLabels = false;
        VUI.Labels.hide();
        VUI.Overlay.clearResults();
        VUI.Overlay.setStatus("Labels hidden");
        VUI.speak("Labels hidden.");
        return;

      case "highlight": {
        const items = command.targetType
          ? getTargetList(command.targetType)
          : VUI.PageAnalyzer.getInteractiveElements();
        const target = findTarget(command, items);

        if (!target) {
          speakAndShow(`I could not find ${command.target}.`);
          return;
        }

        VUI.Overlay.highlightElement(target.element);
        speakAndShow(`Highlighted ${target.name}.`);
        return;
      }

      case "click": {
        let items;

        if (command.targetType) {
          items = getTargetList(command.targetType);
        } else if (command.target === "link" || command.target === "links") {
          items = getTargetList("links");
        } else if (
          command.target === "button" ||
          command.target === "buttons"
        ) {
          items = getTargetList("buttons");
        } else {
          items = VUI.PageAnalyzer.getInteractiveElements();
        }

        const target = findTarget(command, items);

        if (!target) {
          speakAndShow(
            `I could not find ${command.target}.`
          );
          return;
        }

        VUI.Overlay.highlightElement(target.element);

        const success =
          VUI.ActionEngine.clickElement(target);

        if (success) {
          speakAndShow(
            `Opening ${target.name}.`
          );
        }

        return;
      }

      case "focus": {
        const interactiveElements = command.targetType
          ? getTargetList(command.targetType)
          : VUI.PageAnalyzer.getInteractiveElements();

        const target = findTarget(command, interactiveElements);

        if (!target) {
          speakAndShow(
            `I could not find ${command.target}.`
          );
          return;
        }

        VUI.Overlay.highlightElement(
          target.element
        );

        VUI.ActionEngine.focusElement(target);

        speakAndShow(
          `Focused ${target.name}.`
        );

        return;
      }

      case "type": {
        const active =
          document.activeElement;

        if (
          !active ||
          !(
            active instanceof HTMLInputElement ||
            active instanceof HTMLTextAreaElement
          )
        ) {
          speakAndShow(
            "Please focus a text field first."
          );
          return;
        }

        const item = {
          element: active
        };

        const success =
          VUI.ActionEngine.typeText(
            item,
            command.text
          );

        if (success) {
          speakAndShow("Text entered.");
        } else {
          speakAndShow(
            "I could not enter text here."
          );
        }

        return;
      }

      default:
        speakAndShow(
          `I did not understand "${command.text || "that command"}".`
        );
    }
  }

  // Keep the panel list synchronized with visible badge numbers.
  VUI.Labels.onChange(items => {
    if (showingLabels) {
      VUI.Overlay.showList(
        items.map(item => ({ ...item, index: item.label }))
      );
    }
  });

  // Reflect microphone recognition state in the overlay controls.
  speech.onStateChange = (state) => {
    if (state === "listening") {
      VUI.Overlay.setStatus("Listening...");
      micButton.classList.add("vui-listening");
      micButton.querySelector("span").textContent =
        "Listening";
    } else {
      micButton.classList.remove("vui-listening");
      micButton.querySelector("span").textContent =
        "Listen";

      if (
        document.getElementById("vui-status").textContent ===
        "Listening..."
      ) {
        VUI.Overlay.setStatus("Ready");
      }
    }
  };

  // Parse recognized speech locally first, then use Ollama as a fallback.
  speech.onResult = (transcript) => {
    VUI.Overlay.clearHighlights();
    VUI.Overlay.setTranscript(transcript);

    const parsedCommand =
      VUI.CommandParser.parse(transcript);

    if (parsedCommand.action !== "unknown") {
      executeCommand(parsedCommand);
      return;
    }

    VUI.Overlay.setStatus("Interpreting with local model...");

    const targets = {
      links: getTargetList("links")
        .slice(0, 100)
        .map(item => ({ role: item.role, name: item.name.slice(0, 120) })),
      buttons: getTargetList("buttons")
        .slice(0, 100)
        .map(item => ({ role: item.role, name: item.name.slice(0, 120) })),
      focusables: VUI.PageAnalyzer.getInteractiveElements()
        .slice(0, 100)
        .map(item => ({ role: item.role, name: item.name.slice(0, 120) }))
    };

    VUI.OllamaParser.parse(transcript, targets)
      .then(command => {
        if (command.action === "unknown") {
          executeCommand({ ...command, text: transcript });
          return;
        }

        executeCommand(command);
      })
      .catch(error => {
        const detail = error?.message || "Unknown local model error.";
        console.error("Local command interpretation failed:", error);
        speakAndShow(`Local command interpretation failed: ${detail}`);
      });
  };

  // Translate browser recognition errors into messages for the user.
  speech.onError = (error) => {
    const messages = {
      "not-allowed":
        "Microphone permission was denied.",
      "no-speech":
        "I did not hear anything.",
      "network":
        "Speech recognition could not reach its recognition service.",
      "audio-capture":
        "No microphone was available."
    };

    const message =
      messages[error] ||
      `Speech recognition error: ${error}`;

    VUI.Overlay.setStatus(message);
  };

  // Connect panel buttons to listening, stopping, and close/reopen behavior.
  micButton.addEventListener("click", () => {
    speech.start();
  });

  stopButton.addEventListener("click", () => {
    speech.stop();
    VUI.stopSpeaking();
    VUI.Overlay.setStatus("Stopped");
  });

  closeButton.addEventListener("click", () => {
    document.getElementById("vui-overlay").remove();

    const reopen = document.createElement("button");

    reopen.id = "vui-reopen";
    reopen.textContent = "🎤 Voice";
    reopen.title = "Open Voice Web Navigation";

    reopen.addEventListener("click", () => {
      VUI.Overlay.createOverlay();
      window.location.reload();
    });

    document.body.appendChild(reopen);
  });

  // Display the initial state based on browser speech-recognition support.
  VUI.Overlay.setStatus(
    speech.isSupported()
      ? "Ready"
      : "Speech recognition unavailable"
  );
})();