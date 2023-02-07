const IV_BYTE_LENGTH = 12
const SALT_BYTE_LENGTH = 32
const ENCRYPTION_KEY_PARAMS = { name: "AES-GCM", length: 256 }
const PBKDF2_ITERATIONS = 700000
const KEY_USAGES: KeyUsage[] = ["encrypt", "decrypt", "wrapKey", "unwrapKey"]

export enum KeyApplication {
    rootKey = "rootKey",
    personalVaultKey = "personalVaultKey",
    vaultKey = "vaultKey",
    itemKey = "itemKey",
}

export function generateIv(): Uint8Array {
    const iv = new Uint8Array(IV_BYTE_LENGTH)
    return crypto.getRandomValues(iv)
}

export function generateSalt(): Uint8Array {
    const salt = new Uint8Array(SALT_BYTE_LENGTH)
    return crypto.getRandomValues(salt)
}

export async function generateKey(): Promise<CryptoKey> {
    return await crypto.subtle.generateKey(ENCRYPTION_KEY_PARAMS, true, KEY_USAGES)
}

export async function exportKey(key: CryptoKey): Promise<Uint8Array> {
    return new Uint8Array(await crypto.subtle.exportKey("raw", key))
}

export async function importKey(rawKey: Uint8Array): Promise<CryptoKey> {
    return await crypto.subtle.importKey("raw", rawKey, ENCRYPTION_KEY_PARAMS, true, KEY_USAGES)
}

export async function encryptKey(key: CryptoKey, iv: Uint8Array, keyToEncrypt: CryptoKey): Promise<Uint8Array> {
    return new Uint8Array(await crypto.subtle.wrapKey("raw", keyToEncrypt, key, { name: "AES-GCM", iv }))
}

export async function decryptKey(key: CryptoKey, iv: Uint8Array, keyToDecrypt: Uint8Array): Promise<CryptoKey> {
    return await crypto.subtle.unwrapKey("raw", keyToDecrypt, key, { name: "AES-GCM", iv }, ENCRYPTION_KEY_PARAMS, true, KEY_USAGES)
}

// Presumably there is some way to create the key with this ability in the first place???
// But I couldn't find it...
export async function convertKeyForHkdf(key: CryptoKey): Promise<CryptoKey> {
    const rawKey = await crypto.subtle.exportKey("raw", key)
    return await crypto.subtle.importKey(
        "raw",
        rawKey,
        "HKDF",
        true,
        ["deriveKey"],
    );
}

export async function generateSuperKey(): Promise<CryptoKey> {
    return await convertKeyForHkdf(await generateKey())
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
        iterations: PBKDF2_ITERATIONS,
    }, passwordKey, ENCRYPTION_KEY_PARAMS, true, []))
}

export async function deriveKeyFromSuperKey(superKey: CryptoKey, keySalt: Uint8Array, application: KeyApplication): Promise<CryptoKey> {
    return await crypto.subtle.deriveKey({
        name: "HKDF",
        hash: "SHA-256",
        salt: keySalt,
        info: new TextEncoder().encode(application),
    }, superKey, ENCRYPTION_KEY_PARAMS, true, KEY_USAGES)
}

export async function encrypt(key: CryptoKey, iv: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
    return new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data))
}

export async function decrypt(key: CryptoKey, iv: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
    return new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data))
}
