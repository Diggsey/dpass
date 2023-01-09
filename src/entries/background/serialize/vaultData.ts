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
    payload: Uint8Array,
}

type VaultItemData = PlainVaultItemData | EncryptedVaultItemData
type VaultItem = {
    origin: string | null,
    name: string | null,
    data: VaultItemData
}

type NormalItem = {
    id: "normal",
    inner: VaultItem,
}

type VaultNameItem = {
    id: "vaultName",
    name: string,
}

export type VaultFileItem = NormalItem | VaultNameItem
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
