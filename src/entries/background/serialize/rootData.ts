import * as msgpack from "@msgpack/msgpack"
import { ConnectionInfo, StorageAddress } from "~/entries/shared/privileged/state"
import { MergeableFile } from "./merge"
import { SerializationError } from "./utils"

export type Vault = {
    id: "vault",
    name: string,
    fileId: string,
    addresses: StorageAddress[],
    vaultKey: Uint8Array,
    // Salt for decrypting the below key
    personalVaultSalt: Uint8Array,
    encryptedVaultSuperKey: Uint8Array,
}

export type OauthTokenPayload = {
    id: "oauth",
    accessToken: string,
}

export type AuthTokenPayload = OauthTokenPayload

export type AuthToken = {
    id: "authToken",
    connectionInfo: ConnectionInfo,
    expiresAt: number,
    payload: AuthTokenPayload,
}

export type KeyPair = {
    id: "keyPair",
    name?: string,
    privateKeySalt: Uint8Array,
    encryptedPrivateKey: Uint8Array,
    publicKey: Uint8Array,
}

export type RootFileItem = Vault | AuthToken | KeyPair
export type DecryptedRootFile = MergeableFile<RootFileItem>

export function decodeRootData(src: Uint8Array, version: number): DecryptedRootFile {
    switch (version) {
        case 0:
            {
                return msgpack.decode(src) as DecryptedRootFile
            }
        default:
            throw new SerializationError("Unknown future version")
    }
}

export function encodeRootData(data: DecryptedRootFile): Uint8Array {
    return msgpack.encode(data)
}
