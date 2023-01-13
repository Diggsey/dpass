const IV_BYTE_LENGTH = 12
const SALT_BYTE_LENGTH = 32
const ENCRYPTION_KEY_PARAMS = { "name": "AES-GCM", "length": 256 }
const ROOT_KEY_APPLICATION = new TextEncoder().encode("rootKey")

export function generateIv(): Uint8Array {
    const iv = new Uint8Array(IV_BYTE_LENGTH)
    return crypto.getRandomValues(iv)
}

export function generateSalt(): Uint8Array {
    const salt = new Uint8Array(SALT_BYTE_LENGTH)
    return crypto.getRandomValues(salt)
}

// Presumably there is some way to create the key with this ability in the first place???
// But I couldn't find it...
export async function convertKeyForHkdf(key: CryptoKey): Promise<CryptoKey> {
    const rawKey = await crypto.subtle.exportKey("raw", key)
    return await crypto.subtle.importKey(
        "raw",
        rawKey,
        "HKDF",
        false,
        ["deriveKey"],
    );
}

export async function deriveSuperKeyFromPassword(masterPassword: string, passwordSalt: Uint8Array): Promise<CryptoKey> {
    const enc = new TextEncoder();
    const passwordKey = await crypto.subtle.importKey(
        "raw",
        enc.encode(masterPassword),
        "PBKDF2",
        false,
        ["deriveKey"],
    );
    return await convertKeyForHkdf(await crypto.subtle.deriveKey({
        name: "PBKDF2",
        hash: "SHA-256",
        salt: passwordSalt,
        iterations: 100000,
    }, passwordKey, ENCRYPTION_KEY_PARAMS, true, []))
}

export async function deriveKeyFromSuperKey(superKey: CryptoKey, keySalt: Uint8Array): Promise<CryptoKey> {
    return await crypto.subtle.deriveKey({
        name: "HKDF",
        hash: "SHA-256",
        salt: keySalt,
        info: ROOT_KEY_APPLICATION,
    }, superKey, ENCRYPTION_KEY_PARAMS, false, ["encrypt", "decrypt"])
}

export async function encrypt(key: CryptoKey, iv: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
    return new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data))
}

export async function decrypt(key: CryptoKey, iv: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
    return new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data))
}
