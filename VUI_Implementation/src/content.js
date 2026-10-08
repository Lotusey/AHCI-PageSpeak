(() => {
  window.VUI = window.VUI || {};

  VUI.Overlay.createOverlay();

  const speech = new VUI.SpeechController();

  const micButton =
    document.getElementById("vui-mic");

  const stopButton =
    document.getElementById("vui-stop");

  const closeButton =
    document.getElementById("vui-close");

  if (!speech.isSupported()) {
    VUI.Overlay.setStatus(
      "Speech recognition is not supported in this browser."
    );
  }

  function speakAndShow(message) {
    VUI.Overlay.setStatus(message);
    VUI.speak(message);
  }

  function getTargetList(type) {
    return VUI.PageAnalyzer.getElementsByType(type);
  }

  function executeCommand(command) {
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

        VUI.Overlay.setStatus(
          `Found ${items.length} ${command.type}`
        );

        VUI.speak(
          `${items.length} ${command.type} found.`
        );

        return;
      }

      case "click": {
        let items;

        if (command.target === "link" || command.target === "links") {
          items = getTargetList("links");
        } else if (
          command.target === "button" ||
          command.target === "buttons"
        ) {
          items = getTargetList("buttons");
        } else {
          items = VUI.PageAnalyzer.getInteractiveElements();
        }

        let target = null;

        if (command.index) {
          target = items[command.index - 1];
        } else {
          target =
            VUI.PageAnalyzer.findByName(command.target);
        }

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
        const interactiveElements =
          VUI.PageAnalyzer.getInteractiveElements();

        let target = null;

        if (command.index) {
          target =
            interactiveElements[command.index - 1];
        } else {
          target =
            VUI.PageAnalyzer.findByName(
              command.target
            );
        }

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

  speech.onResult = (transcript) => {
    VUI.Overlay.setTranscript(transcript);

    const command =
      VUI.CommandParser.parse(transcript);

    executeCommand(command);
  };

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

  VUI.Overlay.setStatus(
    speech.isSupported()
      ? "Ready"
      : "Speech recognition unavailable"
  );
})();
