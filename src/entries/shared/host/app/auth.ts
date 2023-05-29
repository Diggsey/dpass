import { AuthTokenPayload, ConnectionInfo } from "../../privileged/state"
import { MessagePrefix, sendRequest } from "./channel"

export async function requestToken(
    connectionInfo: ConnectionInfo
): Promise<[AuthTokenPayload, ConnectionInfo]> {
    const resp = await sendRequest(
        MessagePrefix.RequestToken,
        connectionInfo,
        []
    )
    return resp.message as [AuthTokenPayload, ConnectionInfo]
}
