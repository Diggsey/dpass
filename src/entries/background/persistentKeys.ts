import browser from "webextension-polyfill"

import { exportKey, importKey } from "./crypto"

export enum PersistentKeyType {
    setupKey = "setupKey",
}

export async function storeKey(keyType: PersistentKeyType, key: CryptoKey) {
    const rawKey = await exportKey(key)
    await browser.storage.local.set({ [`key-${keyType}`]: Array.from(rawKey) })
}

export async function loadKey(
    keyType: PersistentKeyType
): Promise<CryptoKey | null> {
    const k = `key-${keyType}`
    const record = await browser.storage.local.get(k)
    if (record[k]) {
        return await importKey(new Uint8Array(record[k]))
    } else {
        return null
    }
}

export async function deleteKey(keyType: PersistentKeyType) {
    await browser.storage.local.remove(`key-${keyType}`)
}
