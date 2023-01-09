export class SerializationError extends Error { }

/** Returns true if the two arrays are equal */
export function compareUint8Array(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) {
        return false
    }
    for (let i = 0; i < a.length; ++i) {
        if (a[i] !== b[i]) {
            return false
        }
    }
    return true
}