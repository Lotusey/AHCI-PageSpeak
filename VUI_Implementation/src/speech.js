(() => {
  window.VUI = window.VUI || {};

  function getRecognitionConstructor() {
    return (
      window.SpeechRecognition ||
      window.webkitSpeechRecognition ||
      null
    );
  }

  class SpeechController {
    constructor() {
      this.recognition = null;
      this.listening = false;
      this.onResult = null;
      this.onStateChange = null;
      this.onError = null;

      const Recognition = getRecognitionConstructor();

      if (!Recognition) {
        return;
      }

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

    isSupported() {
      return this.recognition !== null;
    }

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

  function stopSpeaking() {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }

  window.VUI.SpeechController = SpeechController;
  window.VUI.speak = speak;
  window.VUI.stopSpeaking = stopSpeaking;
})();
