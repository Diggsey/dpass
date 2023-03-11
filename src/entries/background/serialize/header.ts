import { compareUint8Array, SerializationError } from "./utils"

type Header = {
    version: number
    body: Uint8Array
}

const MAGIC: Uint8Array = new TextEncoder().encode("dpass")

export function decodeHeader(src: Uint8Array): Header {
    if (!compareUint8Array(MAGIC, src.subarray(0, MAGIC.length))) {
        throw new SerializationError("Invalid file format")
    }
    const version = src.at(MAGIC.length)
    if (version === undefined) {
        throw new SerializationError("File truncated")
    }
    return {
        version,
        body: src.subarray(MAGIC.length + 1),
    }
}

export function encodeHeader({ version, body }: Header): Uint8Array {
    const res = new Uint8Array(body.length + MAGIC.length + 1)
    res.set(MAGIC, 0)
    res.set([version], MAGIC.length)
    res.set(body, MAGIC.length + 1)
    return res
}
