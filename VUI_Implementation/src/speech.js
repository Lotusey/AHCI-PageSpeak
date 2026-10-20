(() => {
  // Share speech features with the other content scripts.
  window.VUI = window.VUI || {};

  // Select the browser-specific Web Speech recognition implementation.
  function getRecognitionConstructor() {
    return (
      window.SpeechRecognition ||
      window.webkitSpeechRecognition ||
      null
    );
  }

  // Manage microphone recognition and expose speech events to the UI.
  class SpeechController {
    constructor() {
      this.recognition = null;
      this.listening = false;
      this.onResult = null;
      this.onStateChange = null;
      this.onError = null;

      const Recognition = getRecognitionConstructor();

      // Leave recognition unavailable when the browser lacks speech support.
      if (!Recognition) {
        return;
      }

      // Configure one-shot English recognition and forward its lifecycle events.
      this.recognition = new Recognition();
      this.recognition.continuous = false;
      this.recognition.interimResults = false;
      this.recognition.maxAlternatives = 1;
      this.recognition.lang = "en-US";

      this.recognition.onstart = () => {
        this.listening = true;

        if (this.onStateChange) {
          this.onStateChange("listening");
        }
      };

      this.recognition.onend = () => {
        this.listening = false;

        if (this.onStateChange) {
          this.onStateChange("idle");
        }
      };

      this.recognition.onresult = (event) => {
        const transcript =
          event.results[0][0].transcript.trim();

        if (this.onResult) {
          this.onResult(transcript);
        }
      };

      this.recognition.onerror = (event) => {
        this.listening = false;

        if (this.onError) {
          this.onError(event.error);
        }

        if (this.onStateChange) {
          this.onStateChange("idle");
        }
      };
    }

    // Report whether the browser created a recognition instance.
    isSupported() {
      return this.recognition !== null;
    }

    // Start listening unless recognition is unavailable or already active.
    start() {
      if (!this.recognition || this.listening) {
        return;
      }

      try {
        this.recognition.start();
      } catch (error) {
        if (this.onError) {
          this.onError(error.message);
        }
      }
    }

    // Stop active recognition; the browser may already have stopped it.
    stop() {
      if (!this.recognition) {
        return;
      }

      try {
        this.recognition.stop();
      } catch (error) {
        // Recognition may already have stopped.
      }
    }
  }

  // Speak a message aloud, replacing any speech that is already playing.
  function speak(text) {
    if (!("speechSynthesis" in window)) {
      return;
    }

    window.speechSynthesis.cancel();

    const utterance =
      new SpeechSynthesisUtterance(text);

    utterance.lang = "en-US";
    utterance.rate = 1;
    utterance.pitch = 1;

    window.speechSynthesis.speak(utterance);
  }

  // Cancel current speech synthesis without starting another utterance.
  function stopSpeaking() {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }

  // Publish the controller and speech helpers for the other scripts.
  window.VUI.SpeechController = SpeechController;
  window.VUI.speak = speak;
  window.VUI.stopSpeaking = stopSpeaking;
})();
