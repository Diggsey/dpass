import * as msgpack from "@msgpack/msgpack"
import { AuthToken, StorageAddress } from "~/entries/shared/privileged/state"
import { MergeableFile } from "./merge"
import { SerializationError } from "./utils"

export type Vault = {
    id: "vault"
    fileId: string
    addresses: StorageAddress[]
    vaultKey: Uint8Array
    setAsDefaultOn?: number

    // For each vault, there is a "personal vault key"
    // derived from our super-key using HKDF and the
    // following salt.
    personalVaultSalt: Uint8Array
    // This "personal vault key" is used to encrypt/decrypt the
    // "vault super key" which is stored here encrypted:
    encryptedVaultSuperKey: Uint8Array
}

export type KeyPair = {
    id: "keyPair"
    name?: string
    privateKeySalt: Uint8Array
    encryptedPrivateKey: Uint8Array
    publicKey: Uint8Array
}

export type RootInfo = {
    id: "rootInfo"
    name: string
    secretSentence: string
}

export type RootFileItem = Vault | AuthToken | KeyPair | RootInfo
export type DecryptedRootFile = MergeableFile<RootFileItem>

export function decodeRootData(
    src: Uint8Array,
    version: number
): DecryptedRootFile {
    switch (version) {
        case 0: {
            return msgpack.decode(src) as DecryptedRootFile
        }
        default:
            throw new SerializationError("Unknown future version")
    }
}

export function encodeRootData(data: DecryptedRootFile): Uint8Array {
    console.dir(data)
    return msgpack.encode(data)
}
