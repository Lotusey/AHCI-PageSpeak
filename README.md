# AHCI-PageSpeak
PageSpeak is a project built to bridge the gap between vocal commands and web page browsing through the integration of VUI and GUI controls. 

The voice interface lives in `VUI_Implementation/`, a Chrome extension. It listens for a spoken command, maps it to a page action (scrolling, clicking, typing, and so on), and can put numbered labels on the buttons, links and inputs on screen so any of them can be reached by saying its number.

## Installing the extension

1. In Chrome, open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select the `VUI_Implementation` folder.
2. Open any website. The Voice Web Navigation panel appears in the bottom-right corner.
3. Press **Listen** and say a command.

The first time you press **Listen** on a website, Chrome asks for permission to use the microphone.

After pulling new changes, press the reload icon on the extension's card in `chrome://extensions` and reload any open tabs.

## Voice commands

Say **"What can I say?"** at any time to see examples in the panel.

### Labels
| Say | What happens |
| --- | --- |
| "show labels" / "show numbers" | Numbers every link, button and input on screen. Links are blue, buttons purple, inputs green. |
| "show links" / "show buttons" / "show inputs" | Labels only that kind of element. |
| "click 12", "12", "number twelve" | Clicks the element showing label 12. |
| "hide labels", "do not show labels", "turn off numbers" | Removes the labels. |

Labels follow the page as you scroll. An element keeps its number while it stays on screen; elements that scroll into view take the lowest free numbers.

### Clicking and focusing
| Say | What happens |
| --- | --- |
| "click sign in", "open the about us link" | Clicks the element with that name (close mis-hearings are tolerated). |
| "click the second link", "click button 3" | Clicks by position among links or buttons. |
| "go to the search field", "focus 5" | Moves focus without clicking. |
| "highlight 7", "highlight the news link" | Outlines an element without activating it. |

If several elements match a name (for example three "Reply" buttons), only those get labels and you are asked to say the number of the one you want.

### Forms
| Say | What happens |
| --- | --- |
| "type hello world" | Types into the focused field at the cursor. Saying "type" again adds to the text. |
| "type hello into 5", "type cats in the search box" | Types into a specific field. |
| "clear", "clear 5" | Empties a field. |
| "next field", "previous field" | Moves between form fields. |
| "check 3", "check remember me", "uncheck this" | Ticks or unticks a checkbox. |
| "choose Canada", "choose Canada from country", "set country to Canada" | Picks a dropdown option. |
| "press enter" / "submit", "press escape", "press tab" | Submits the form, closes a popup, or moves focus. |

### Scrolling, reading and the browser
| Say | What happens |
| --- | --- |
| "scroll down" / "scroll up" | Scrolls one step. |
| "scroll down 20 percent" | Scrolls by part of the page. |
| "scroll to half of the page", "go to 75 percent" | Jumps to a position. |
| "go to the top" / "go to the bottom" | Jumps to the start or end. |
| "read this page", "stop" | Reads the title, headings and main text aloud, and stops reading. |
| "show headings" | Lists the page headings. |
| "go back", "go forward", "reload" | Navigates. |
| "new tab", "close tab" | Opens or closes a tab. |
| "zoom in", "zoom out", "reset zoom" | Changes page zoom. |
| "search for cute cats" | Searches with your default search engine. |

Polite wording such as "can you…" or "…please" is ignored, so "can you scroll down please" works.

## Local LLM command interpretation

The rule-based command parser is the fast path. If none of the recognized phrasings match a command, or the element named in a command is not on the page, the transcript and a short list of on-screen element names are sent to Ollama running on the same computer. The model's response is validated against the supported command actions before it runs. If Ollama is not installed, the rule-based commands still work.

1. Install Ollama at 'https://ollama.com/download' with your respective operating system.

2. Download the configured model once in PowerShell:

	powershell:
	ollama pull llama3.2:3b

3. Copy the extension ID shown on the extension's card in `chrome://extensions`.

4. Ollama must allow this extension's origin. In Windows, open **Edit environment variables for your account** and add a user variable named `OLLAMA_ORIGINS` with this value, replacing the placeholder with the copied extension ID:

	text:
	chrome-extension://YOUR_EXTENSION_ID

5. Quit Ollama from its system-tray menu and reopen it so the environment setting takes effect. Ollama for Windows normally runs in the background; do not start a second `ollama serve` process if it is already running.

Ollama inference uses `http://127.0.0.1:11434` and does not require a paid model API. Requests time out after 15 seconds. The current speech transcription still uses the browser's Web Speech API, whose recognition may be provided by a browser service; local Ollama only guarantees that command interpretation stays on-device. The model and timeout can be changed in `VUI_Implementation/src/background.js`.

## Usage log for evaluation

Every voice command is logged locally (in the extension's `chrome.storage.local`, at most 2,000 entries) to support user studies. Each entry records the transcript and the other recognition guesses, whether the rule-based parser or the local model produced the command, the command, the outcome (`success`, `failure`, `ambiguous`, `unknown` or `error`), the time from receiving the transcript to finishing the command, and the website's host name. Entries are stored under the `pagespeakLog` key and include anything dictated with "type".

## Code overview

| File | Purpose |
| --- | --- |
| `src/content.js` | Wires everything together: receives transcripts, resolves targets, runs commands, logs results. |
| `src/commandParser.js` | Rule-based parser from spoken text to command objects. |
| `src/ollamaParser.js` | Validates commands returned by the local model. |
| `src/background.js` | Ollama requests, browser commands (tabs, zoom, search), and log storage. |
| `src/speech.js` | Speech recognition (Web Speech API) and text-to-speech. |
| `src/labels.js` | Assigns and maintains label numbers. |
| `src/overlay.js` / `src/styles.css` | Panel, label badges and highlights, drawn inside a shadow root so page CSS cannot affect them. |
| `src/pageAnalyzer.js` | Finds interactive elements, their names and visibility, and does fuzzy name matching. |
| `src/actionEngine.js` | Performs page actions: click, focus, type, clear, check, choose option, key presses, scrolling. |

Known limitations: labels and commands only cover the top-level page, not content inside iframes. Custom (non-`<select>`) dropdowns are opened by clicking them and their options by name.
