(() => {
  window.VUI = window.VUI || {};

  // Usage log for evaluating the system. Entries are stored locally by the
  // background worker (chrome.storage.local) and never leave the computer.

  function record(entry) {
    return Promise.resolve().then(() => chrome.runtime.sendMessage({
      type: "VUI_LOG_APPEND",
      entry: {
        time: new Date().toISOString(),
        host: location.hostname,
        ...entry
      }
    }).then(response => {
      if (response?.error) {
        throw new Error(response.error);
      }
    }));
  }

  window.VUI.Logger = {
    record
  };
})();
