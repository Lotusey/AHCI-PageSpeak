# AHCI-PageSpeak
PageSpeak is a project built to bridge the gap between vocal commands and web page browsing through the integration of VUI and GUI controls. 

## Local LLM command interpretation

The VUI implementation keeps its rule-based command parser as the fast path. If a transcript is not recognized, it sends the transcript and a limited list of visible interactive element names to Ollama running on the same computer. The model response is validated against the supported command actions before execution.

1. Install Ollama at 'https://ollama.com/download' with your respective operating system.

2. Download the configured model once in PowerShell:

	powershell:
	ollama pull llama3.2:3b

3. In Chrome, open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select the `VUI_Implementation` folder. Copy the extension ID shown on its card.

4. Ollama must allow this extension's origin. In Windows, open **Edit environment variables for your account** and add a user variable named `OLLAMA_ORIGINS` with this value, replacing the placeholder with the copied extension ID:

	text:
	chrome-extension://YOUR_EXTENSION_ID

5. Quit Ollama from its system-tray menu and reopen it so the environment setting takes effect. Ollama for Windows normally runs in the background; do not start a second `ollama serve` process if it is already running.

Ollama inference uses `http://127.0.0.1:11434` and does not require a paid model API. The current speech transcription still uses the browser's Web Speech API, whose recognition may be provided by a browser service; local Ollama only guarantees that command interpretation stays on-device. The model can be changed in `VUI_Implementation/src/background.js`.
