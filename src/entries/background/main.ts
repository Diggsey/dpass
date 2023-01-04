import browser, { Runtime, Action, Tabs } from "webextension-polyfill";
import { Message, sendMessageToTab } from "../shared"

// Check that we are not run from a content script
const allowedProtocols = [
  "chrome-extension:",
  "moz-extension:",
]
if (!allowedProtocols.includes(location.protocol)) {
  throw new Error(`Background script was loaded in an unprivileged context (${location.protocol})`)
}

let passwords = [
  { "origin": "https://accounts.google.com", "username": "foo", "password": "bar" },
  { "origin": "https://accounts.google.com", "username": "baz", "password": "bam" },
  { "origin": "https://github.com", "username": "cat", "password": "dog" },
]

function browserActionClicked(tab: Tabs.Tab, _event: Action.OnClickData | undefined) {
  if (tab.id !== undefined) {
    browserActionClickedAsync(tab.id)
  }
}

async function browserActionClickedAsync(tabId: number) {
  // Make sure our content script has been injected. We can't directly trigger
  // anything via this injection because it will have no effect on the second injection.
  await browser.scripting.executeScript({
    target: {
      allFrames: true,
      tabId,
    },
    files: ["/src/entries/content/main.js"],
    injectImmediately: true
  })
  // We don't know which frame is active, so send a message to all of them.
  // Only the active frame will request auto-fill.
  const response = await sendMessageToTab(tabId, { id: "pokeActiveFrame" })
  if (!response) {
    console.warn("No active frame found")
  }
}

function handleMessage(message: Message, sender: Runtime.MessageSender) {
  switch (message.id) {
    case "requestAutofill": return requestAutoFill(sender)
    default:
      console.warn(`Received unknown message type: ${message.id}`)
      return
  }
}

async function requestAutoFill(sender: Runtime.MessageSender) {
  const origin = sender.url ? new URL(sender.url).origin : null
  const relevantPasswords = passwords.filter(pw => pw.origin === origin)

  return relevantPasswords
}

browser.browserAction.onClicked.addListener(browserActionClicked)
browser.runtime.onMessage.addListener(handleMessage)
