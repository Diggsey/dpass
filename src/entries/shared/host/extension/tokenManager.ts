import browser from "webextension-polyfill"
import {
    AuthToken,
    AuthTokenPayload,
    ConnectionInfo,
    OauthConnectionInfo,
} from "../../privileged/state"
import { loadToken, storeToken } from "./tokens"

const MIN_EXPIRY_BUFFER_MS = 10000

function urlParams(url: string, params: { [param: string]: string }) {
    const res = new URL(url)
    for (const [k, v] of Object.entries(params)) {
        res.searchParams.append(k, v)
    }
    return res.href
}

class TokenManager {
    async #requestGoogleOauthToken(
        connectionInfo: OauthConnectionInfo
    ): Promise<AuthToken> {
        const authUrl = urlParams("https://accounts.google.com/o/oauth2/auth", {
            client_id:
                "711430196916-b8dqrl7bg50kb6b1lsnkrtutd6s704qu.apps.googleusercontent.com",
            response_type: "token",
            redirect_uri: browser.identity.getRedirectURL(),
            scope: "openid https://www.googleapis.com/auth/drive.file",
            login_hint: connectionInfo.userId,
        })
        const redirectUrl = new URL(
            await browser.identity.launchWebAuthFlow({
                url: authUrl,
                interactive: true,
            })
        )
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

        const response = await fetch(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            }
        )
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

        return {
            id: "authToken",
            connectionInfo,
            expiresAt,
            payload: {
                id: "oauth",
                accessToken,
            },
        }
    }
    async #requestOauthToken(
        connectionInfo: OauthConnectionInfo
    ): Promise<AuthToken> {
        switch (connectionInfo.serverId) {
            case "com.google":
                return await this.#requestGoogleOauthToken(connectionInfo)
        }
    }
    async request(
        connectionInfo: ConnectionInfo
    ): Promise<[AuthTokenPayload, ConnectionInfo]> {
        let token = await loadToken(connectionInfo)
        if (
            token === null ||
            token.expiresAt < Date.now() + MIN_EXPIRY_BUFFER_MS
        ) {
            switch (connectionInfo.id) {
                case "oauth":
                    token = await this.#requestOauthToken(connectionInfo)
                    connectionInfo = token.connectionInfo
                    break
                case "none":
                    throw new Error("Cannot request `none` token")
            }
            await storeToken(connectionInfo, token)
        }
        return [token.payload, connectionInfo]
    }
}

const TOKEN_MANAGER = new TokenManager()

export function requestToken(
    connectionInfo: ConnectionInfo
): Promise<[AuthTokenPayload, ConnectionInfo]> {
    return TOKEN_MANAGER.request(connectionInfo)
}
