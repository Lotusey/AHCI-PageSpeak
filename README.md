# PageSpeak

<p align="center">
  <img src="icons/pagespeak.png" alt="PageSpeak logo" width="180">
</p>

<p align="center"><strong>Voice-first webpage navigation for Chrome</strong></p>

PageSpeak combines a voice user interface (VUI) with an on-page graphical user interface (GUI) to make webpages easier to browse. Speak a command to scroll, read, click, focus, type, search, or navigate. The extension can also place numbered labels on visible links, buttons, and form fields so you can reach them by voice.

## What is included

- Chrome extension with a floating voice-control panel.
- Browser speech recognition and text-to-speech.
- Rule-based command parsing for fast, predictable commands.
- Optional local Ollama interpretation for more conversational wording.
- Numbered on-page labels and visual highlights.
- Local usage logging for evaluation and user studies.

## Requirements

- Google Chrome or another browser.
- A copy of this repository.
- A microphone for voice commands.
- Ollama is optional. The rule-based commands work without it.

## Install and run

### 1. Get the project

Clone the repository or download it. Then open PowerShell in the project folder. If you cloned it with Git, use:

```powershell
git clone https://github.com/Lotusey/AHCI-PageSpeak.git
cd AHCI-PageSpeak
```

If you downloaded a ZIP file, extract it, open PowerShell in the extracted project folder, and skip the `git clone` command. The folder you select later must contain `manifest.json`.

### 2. Load the extension in Chrome

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. Click **Load unpacked**.
4. Select the extracted or cloned project folder—the folder containing `manifest.json`:

   ```text
   <your-project-folder>\AHCI-PageSpeak
   ```

5. Open any normal `http://` or `https://` webpage. The **Voice Web Navigation** panel appears in the bottom-right corner.
6. Click **Listen** and allow microphone access when Chrome asks.

After pulling new changes, click the reload icon on the extension card and reload any open webpages.

### 3. Optional: enable conversational commands with Ollama

The rule-based parser is the default fast path. Ollama is only needed when PageSpeak must interpret wording that does not match one of the built-in command patterns.

1. Install [Ollama](https://ollama.com/download).
2. Download the configured model:

   ```powershell
   & "$env:LOCALAPPDATA\Programs\Ollama\ollama.exe" pull llama3.2:3b
   ```

3. If Ollama is not already running, start it with:

   ```powershell
   & "$env:LOCALAPPDATA\Programs\Ollama\ollama.exe" serve
   ```

   Do not start a second server if Ollama is already running in the background.

4. Copy the extension ID from the extension card in `chrome://extensions`.
5. In Windows, open **Edit environment variables for your account** and add:

   ```text
   Variable: OLLAMA_ORIGINS
   Value: chrome-extension://*
   ```

   The wildcard allows Chrome's extension origin reliably. A specific value such as `chrome-extension://YOUR_EXTENSION_ID` can also be used.

6. Quit Ollama from its system-tray menu and reopen it so the environment variable takes effect.

Ollama runs at `http://127.0.0.1:11434`. It does not require a paid API or token. The model and request timeout can be changed in [`VUI/background.js`](VUI/background.js).

> **Privacy note:** PageSpeak's speech transcription uses the browser Web Speech API. Depending on the browser, recognition may use a browser-provided service. Ollama command interpretation remains on the local computer.

## Try these commands

Say **“What can I say?”** to display examples in the panel. Polite wording such as “can you” and “please” is supported.

### Labels and targets

| Say | Result |
| --- | --- |
| “show labels” / “show numbers” | Number visible links, buttons, and inputs. |
| “show links” / “show buttons” / “show inputs” | Label only that type of element. |
| “click 12” / “number twelve” | Click the element with label 12. |
| “hide labels” / “turn off numbers” | Remove the labels. |
| “highlight 7” / “highlight the news link” | Highlight without activating an element. |
| “click sign in” / “open the about us link” | Click a named element. |
| “click the second link” / “click button 3” | Click by position among links or buttons. |

Labels follow the page while scrolling. If several elements have the same name, PageSpeak labels the matching elements and asks you to choose by number.

### Forms

| Say | Result |
| --- | --- |
| “focus 5” / “go to the search field” | Focus a form field without clicking it. |
| “type hello world” | Type into the focused field. |
| “type cats in the search box” | Focus a matching field and type into it. |
| “clear” / “clear 5” | Empty a field. |
| “next field” / “previous field” | Move between form fields. |
| “check 3” / “uncheck this” | Check or uncheck a checkbox. |
| “choose Canada” / “set country to Canada” | Select a dropdown option. |
| “press enter” / “press escape” / “press tab” | Send a keyboard action. |

### Reading, scrolling, and browser navigation

| Say | Result |
| --- | --- |
| “read this page” | Read the page title, headings, and main text aloud. |
| “stop” | Stop speech. Use the **Stop** button to interrupt page reading. |
| “stop listening” | Turn off the microphone. |
| “scroll down” / “scroll up” | Scroll one step. |
| “scroll down 20 percent” | Scroll by a percentage of the page. |
| “scroll to half of the page” / “go to 75 percent” | Jump to a page position. |
| “go to the top” / “go to the bottom” | Jump to the start or end. |
| “go back” / “go forward” / “reload” | Navigate the current tab. |
| “new tab” / “close tab” | Open or close a browser tab. |
| “zoom in” / “zoom out” / “reset zoom” | Change page zoom. |
| “search for cute cats” | Search with the default search engine. |

## Project structure

```text
AHCI-PageSpeak/
├── manifest.json       # Chrome extension configuration
├── icons/
│   └── pagespeak.png   # Extension and panel logo
├── GUI/
│   ├── overlay.js      # Voice panel, labels, and highlights
│   ├── labels.js       # Number assignment for page elements
│   └── styles.css      # Shadow-root panel styling
└── VUI/
    ├── speech.js       # Speech recognition and text-to-speech
    ├── commandParser.js # Rule-based command parser
    ├── ollamaParser.js # Local LLM command validation
    ├── content.js      # Connects speech, UI, analysis, and actions
    ├── pageAnalyzer.js # Finds and names interactive elements
    ├── actionEngine.js # Performs webpage actions
    ├── background.js   # Ollama, browser commands, and storage
    └── logger.js       # Stores command results
```

## Usage log

Voice commands are logged locally in `chrome.storage.local`, with a maximum of 2,000 entries, to support evaluation and user studies. Entries include the transcript, recognition alternatives, parser source, command, outcome, duration, and website hostname. Anything dictated with “type” is included under the `pagespeakLog` key.

## Limitations

- Commands and labels currently cover the top-level page, not content inside iframes.
- Custom non-`<select>` dropdowns are opened and operated by their visible names.
- Speech recognition behavior depends on the browser and microphone permissions.
- Restricted browser pages such as `chrome://extensions` cannot be controlled by content scripts.

## Development notes

The extension is loaded directly from the repository; no build step is required. After editing JavaScript, CSS, the manifest, or the logo:

1. Go to `chrome://extensions`.
2. Click **Reload** on PageSpeak.
3. Reload the webpage being tested.

The logo is used both as the Chrome extension icon and in the voice panel header. See [`icons/pagespeak.png`](icons/pagespeak.png) and [`GUI/overlay.js`](GUI/overlay.js).
