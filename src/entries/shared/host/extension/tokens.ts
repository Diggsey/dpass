import browser from "webextension-polyfill"
import { objectKey } from "../.."
import { AuthToken, ConnectionInfo } from "../../privileged/state"

function getTokenKey(connectionInfo: ConnectionInfo): string {
    return `token-${objectKey(connectionInfo)}`
}

export async function storeToken(
    connectionInfo: ConnectionInfo,
    token: AuthToken
): Promise<void> {
    const tokenKey = getTokenKey(connectionInfo)
    await browser.storage.local.set({
        [tokenKey]: token,
    })
}
export async function loadToken(
    connectionInfo: ConnectionInfo
): Promise<AuthToken | null> {
    const tokenKey = getTokenKey(connectionInfo)
    const res = await browser.storage.local.get(tokenKey)
    return res[tokenKey] ?? null
}
