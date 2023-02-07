import { AuthToken, ConnectionInfo, OauthConnectionInfo, OauthTokenPayload } from "./privileged/state";
import browser from "webextension-polyfill";
import { objectKey } from ".";

function getTokenKey(connectionInfo: ConnectionInfo): string {
    return `token-${objectKey(connectionInfo)}`
}

const MIN_EXPIRY_BUFFER_MS = 10000

function url_params(url: string, params: { [param: string]: string }) {
    const res = new URL(url)
    for (const [k, v] of Object.entries(params)) {
        res.searchParams.append(k, v)
    }
    return res.href
}

class TokenManager {
    async #requestGoogleOauthToken(connectionInfo: OauthConnectionInfo): Promise<[AuthToken, ConnectionInfo]> {
        const authUrl = url_params(
            "https://accounts.google.com/o/oauth2/auth",
            {
                "client_id": "711430196916-b8dqrl7bg50kb6b1lsnkrtutd6s704qu.apps.googleusercontent.com",
                "response_type": "token",
                "redirect_uri": browser.identity.getRedirectURL(),
                "scope": "openid https://www.googleapis.com/auth/drive.file",
                "login_hint": connectionInfo.userId
            }
        )
        const redirectUrl = new URL(await browser.identity.launchWebAuthFlow({ url: authUrl, interactive: true }))
        const hashParams = new URLSearchParams(redirectUrl.hash.slice(1))
        const error = hashParams.get("error")
        if (error) {
            throw new Error(`Google OAuth failure: ${error}`)
        }
        const accessToken = hashParams.get("access_token")
        const expiresIn = hashParams.get("expires_in")
        if (!accessToken || !expiresIn) {
            throw new Error(`Unknown Google OAuth failure: ${redirectUrl.hash}`)
        }
        const expiresAt = parseInt(expiresIn) * 1000 + Date.now()

        const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
            headers: {
                "Authorization": `Bearer ${accessToken}`
            }
        })
        if (!response.ok) {
            const message = await response.text()
            throw new Error(`Failed to validate Google OAuth token ${message}`)
        }
        const tokenInfo = await response.json()
        if (tokenInfo["sub"] != connectionInfo.userId) {
            connectionInfo = {
                ...connectionInfo,
                userId: tokenInfo["sub"],
            }
        }

        return [{
            id: "authToken",
            connectionInfo,
            expiresAt,
            payload: {
                id: "oauth",
                accessToken,
            }
        }, connectionInfo]
    }
    async #requestOauthToken(connectionInfo: OauthConnectionInfo): Promise<[AuthToken, ConnectionInfo]> {
        switch (connectionInfo.serverId) {
            case "google":
                return await this.#requestGoogleOauthToken(connectionInfo)
        }
    }
    async request(connectionInfo: ConnectionInfo): Promise<[OauthTokenPayload, ConnectionInfo]> {
        let tokenKey = getTokenKey(connectionInfo)
        const res = await browser.storage.local.get(tokenKey)
        let token: AuthToken | undefined = res[tokenKey]
        if (!token || token.expiresAt < Date.now() + MIN_EXPIRY_BUFFER_MS) {
            switch (connectionInfo.id) {
                case "oauth":
                    [token, connectionInfo] = await this.#requestOauthToken(connectionInfo)
                    break
                case "none":
                    throw new Error("Cannot request `none` token")
            }
            tokenKey = getTokenKey(connectionInfo)
            await browser.storage.local.set({
                tokenKey: token
            })
        }
        return [token.payload, connectionInfo]
    }
}

export const TOKEN_MANAGER = new TokenManager()
