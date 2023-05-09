import * as msgpack from "@msgpack/msgpack"
import { AuthToken, StorageAddress } from "~/entries/shared/privileged/state"
import { MergeableFile } from "./merge"
import { SerializationError } from "./utils"
import { AutofillMode } from "~/entries/shared/autofill"

export type Vault = {
    readonly id: "vault"
    readonly fileId: string
    readonly addresses: readonly StorageAddress[]
    readonly vaultKey: Uint8Array
    readonly setAsDefaultOn?: number

    // For each vault, there is a "personal vault key"
    // derived from our super-key using HKDF and the
    // following salt.
    readonly personalVaultSalt: Uint8Array
    // This "personal vault key" is used to encrypt/decrypt the
    // "vault super key" which is stored here encrypted:
    readonly encryptedVaultSuperKey: Uint8Array
}

export type KeyPair = {
    readonly id: "keyPair"
    readonly name?: string
    readonly privateKeySalt: Uint8Array
    readonly encryptedPrivateKey: Uint8Array
    readonly publicKey: Uint8Array
}

export type RootInfo = {
    readonly id: "rootInfo"
    readonly name: string
    readonly secretSentence: string
}

export type GeneratorSettings = {
    readonly id: "generatorSettings"
    readonly passwordLength: number
    readonly passwordLetters: boolean
    readonly passwordDigits: boolean
    readonly passwordSymbols: boolean
    readonly passwordExtra: string
}

export type HistoryEntry = {
    readonly id: "historyEntry"
    readonly type: "generated" | "deleted" | "changed"
    readonly origins: string[]
    readonly name: string
    readonly autofillMode: AutofillMode
    readonly value: string
    readonly entropy?: number
}

export type RootFileItem =
    | Vault
    | AuthToken
    | KeyPair
    | RootInfo
    | GeneratorSettings
    | HistoryEntry
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
    return msgpack.encode(data)
}
