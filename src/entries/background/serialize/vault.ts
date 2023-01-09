import { decodeHeader, encodeHeader } from "./header"
import * as msgpack from "@msgpack/msgpack"
import { SerializationError } from "./utils"

export type EncryptedVaultFile = {
    version: number,
    iv: Uint8Array,
    encryptedData: Uint8Array,
}

type VaultFileBody = {
    iv: Uint8Array,
    encryptedData: Uint8Array,
}

export function decodeVault(src: Uint8Array): EncryptedVaultFile {
    const { version, body } = decodeHeader(src)
    switch (version) {
        case 0:
            {
                const res = msgpack.decode(body) as VaultFileBody
                return {
                    version,
                    ...res
                }
            }
        default:
            throw new SerializationError("Unknown future version")
    }
}

export function encodeVault(src: VaultFileBody): Uint8Array {
    const version = 0;
    const body = msgpack.encode(src)
    return encodeHeader({ version, body })
}