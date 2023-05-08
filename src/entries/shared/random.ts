export function randomInt(upperBound: number): number {
    let result
    const maxInt = 0x100000000
    const limit = maxInt - (maxInt % upperBound)
    const arr = new Uint32Array(1)
    do {
        result = crypto.getRandomValues(arr)[0]
    } while (result >= limit)
    return result % upperBound
}
