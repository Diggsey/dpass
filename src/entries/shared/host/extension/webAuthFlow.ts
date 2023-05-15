import browser from "webextension-polyfill"
import { WebAuthFlowOptions } from ".."

export function getRedirectURL(): string {
    return browser.identity.getRedirectURL()
}

export async function launchWebAuthFlow(
    options: WebAuthFlowOptions
): Promise<string> {
    return await browser.identity.launchWebAuthFlow(options)
}
