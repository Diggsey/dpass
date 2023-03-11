import { decodeHeader, encodeHeader } from "./header"
import * as msgpack from "@msgpack/msgpack"
import { SerializationError } from "./utils"

export type EncryptedRootFile = {
    version: number
    passwordSalt: Uint8Array
    sentenceSalt: Uint8Array
    keySalt: Uint8Array
    encryptedData: Uint8Array
}

type RootFileBody = {
    passwordSalt: Uint8Array
    sentenceSalt: Uint8Array
    keySalt: Uint8Array
    encryptedData: Uint8Array
}

export function decodeRoot(src: Uint8Array): EncryptedRootFile {
    const { version, body } = decodeHeader(src)
    switch (version) {
        case 0: {
            const res = msgpack.decode(body) as RootFileBody
            return {
                version,
                ...res,
            }
        }
        default:
            throw new SerializationError("Unknown future version")
    }
}

export function encodeRoot(src: RootFileBody): Uint8Array {
    const version = 0
    const body = msgpack.encode(src)
    return encodeHeader({ version, body })
}
