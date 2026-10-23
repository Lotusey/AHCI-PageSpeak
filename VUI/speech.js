(() => {
  window.VUI = window.VUI || {};

  const LANG = "en-US";
  const MAX_ALTERNATIVES = 3;

  // Chrome ends a recognition session after a while (or after silence) even
  // in continuous mode, so it is restarted until the user stops listening.
  const RESTART_DELAY_MS = 250;
  // Give up after this many errors in a row without hearing anything.
  const MAX_CONSECUTIVE_ERRORS = 5;
  // Errors that restarting cannot fix.
  const FATAL_ERRORS = new Set([
    "not-allowed",
    "service-not-allowed",
    "audio-capture",
    "language-not-supported"
  ]);

  // The controller to pause while the extension is talking.
  let activeController = null;

  function getRecognitionConstructor() {
    return (
      window.SpeechRecognition ||
      window.webkitSpeechRecognition ||
      null
    );
  }

  function readAlternatives(result) {
    return Array.from({ length: result.length }, (_, i) => ({
      transcript: result[i].transcript.trim(),
      confidence: result[i].confidence
    })).filter(alternative => alternative.transcript);
  }

  class SpeechController {
    constructor() {
      this.recognition = null;
      // True from pressing Listen until Stop (or a fatal error).
      this.active = false;
      // True while the browser's recognition session is actually running.
      this.running = false;
      // Reasons recognition is temporarily paused: "speaking", "hidden".
      this.pauses = new Set();
      this.consecutiveErrors = 0;
      this.restartTimer = null;

      this.onResult = null;
      this.onStateChange = null;
      this.onError = null;

      const Recognition = getRecognitionConstructor();

      if (!Recognition) {
        return;
      }

      this.recognition = new Recognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = false;
      this.recognition.maxAlternatives = MAX_ALTERNATIVES;
      this.recognition.lang = LANG;

      this.recognition.onstart = () => {
        this.running = true;
      };

      this.recognition.onend = () => {
        this.running = false;
        this.scheduleRestart();
      };

      // In continuous mode each finished phrase arrives as a new result.
      // Every recognition guess is passed on so the caller can pick the one
      // that matches something on the page.
      this.recognition.onresult = (event) => {
        this.consecutiveErrors = 0;

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (!result.isFinal) continue;

          const alternatives = readAlternatives(result);

          if (alternatives.length && this.onResult) {
            this.onResult(alternatives);
          }
        }
      };

      this.recognition.onerror = (event) => {
        // Silence and our own pauses are expected; just keep listening.
        if (event.error === "no-speech" || event.error === "aborted") {
          return;
        }

        this.consecutiveErrors++;

        if (
          FATAL_ERRORS.has(event.error) ||
          this.consecutiveErrors >= MAX_CONSECUTIVE_ERRORS
        ) {
          this.deactivate();

          if (this.onError) {
            this.onError(event.error);
          }
        }
      };

      // Only listen in the tab the user is looking at.
      document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
          this.pause("hidden");
        } else {
          this.resume("hidden");
        }
      });
    }

    isSupported() {
      return this.recognition !== null;
    }

    isListening() {
      return this.active;
    }

    setActive(active) {
      if (this.active === active) return;

      this.active = active;

      if (this.onStateChange) {
        this.onStateChange(active ? "listening" : "idle");
      }
    }

    start() {
      if (!this.recognition || this.active) {
        return;
      }

      this.consecutiveErrors = 0;
      activeController = this;
      this.setActive(true);
      this.startRecognition();
    }

    stop() {
      this.deactivate();
    }

    deactivate() {
      clearTimeout(this.restartTimer);
      this.setActive(false);
      this.abortRecognition();
    }

    startRecognition() {
      if (!this.active || this.running || this.pauses.size) return;

      try {
        this.recognition.start();
      } catch (error) {
        // Already started.
      }
    }

    abortRecognition() {
      if (!this.recognition) return;

      try {
        this.recognition.abort();
      } catch (error) {
        // Recognition may already have stopped.
      }
    }

    scheduleRestart() {
      clearTimeout(this.restartTimer);

      if (!this.active || this.pauses.size) return;

      this.restartTimer = setTimeout(
        () => this.startRecognition(),
        RESTART_DELAY_MS
      );
    }

    pause(reason) {
      this.pauses.add(reason);
      clearTimeout(this.restartTimer);

      if (this.running) {
        this.abortRecognition();
      }
    }

    resume(reason) {
      this.pauses.delete(reason);
      this.scheduleRestart();
    }
  }

  let currentUtterance = null;

  // Speaks text aloud. Listening pauses until it finishes, so the
  // microphone does not pick up the extension's own voice as a command.
  function speak(text) {
    if (!("speechSynthesis" in window)) {
      return;
    }

    window.speechSynthesis.cancel();

    const utterance =
      new SpeechSynthesisUtterance(text);

    utterance.lang = LANG;
    utterance.rate = 1;
    utterance.pitch = 1;

    const controller = activeController;
    let watcher = null;

    const finished = () => {
      if (currentUtterance !== utterance) return;

      currentUtterance = null;
      clearInterval(watcher);

      if (controller) {
        controller.resume("speaking");
      }
    };

    currentUtterance = utterance;
    utterance.onend = finished;
    utterance.onerror = finished;

    if (controller) {
      controller.pause("speaking");
    }

    window.speechSynthesis.speak(utterance);

    // Chrome occasionally never fires "end"; don't let listening stay paused.
    watcher = setInterval(() => {
      if (!window.speechSynthesis.speaking && !window.speechSynthesis.pending) {
        finished();
      }
    }, 500);
  }

  function stopSpeaking() {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }

  window.VUI.SpeechController = SpeechController;
  window.VUI.speak = speak;
  window.VUI.stopSpeaking = stopSpeaking;
})();
