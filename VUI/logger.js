(() => {
  window.VUI = window.VUI || {};

  // Usage log for evaluating the system. Entries are stored locally by the
  // background worker (chrome.storage.local) and never leave the computer.

  function record(entry) {
    try {
      chrome.runtime.sendMessage({
        type: "VUI_LOG_APPEND",
        entry: {
          time: new Date().toISOString(),
          host: location.hostname,
          ...entry
        }
      }).catch(() => {});
    } catch (error) {
      // Thrown when the extension was reloaded after this page loaded.
    }
  }

  window.VUI.Logger = {
    record
  };
})();
