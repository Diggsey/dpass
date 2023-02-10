import * as msgpack from "@msgpack/msgpack"
import { VaultItemPayload } from "~/entries/shared/state"
import { MergeableFile } from "./merge"
import { SerializationError } from "./utils"

type PlainVaultItemData = {
    encrypted: false,
    payload: VaultItemPayload,
}
type EncryptedVaultItemData = {
    encrypted: true,
    salt: Uint8Array,
    payload: Uint8Array,
}

export type VaultItemData = PlainVaultItemData | EncryptedVaultItemData

export type NormalItem = {
    id: "normal",
    origin: string,
    name: string,
    data: VaultItemData
}

export type VaultInfoItem = {
    id: "vaultInfo",
    name: string,
}

export type VaultFileItem = NormalItem | VaultInfoItem
export type DecryptedVaultFile = MergeableFile<VaultFileItem>

export function decodeVaultData(src: Uint8Array, version: number): DecryptedVaultFile {
    switch (version) {
        case 0:
            {
                return msgpack.decode(src) as DecryptedVaultFile
            }
        default:
            throw new SerializationError("Unknown future version")
    }
}

export function encodeVaultData(data: DecryptedVaultFile): Uint8Array {
    return msgpack.encode(data)
}
