import {
    PersistentKeyType,
    RootAddressesChangedHandler,
    UnlockWithKeyHandler,
} from ".."
import { Json, objectKey, splitN } from "../.."
import { importKey, exportKey } from "../../crypto"
import {
    AuthToken,
    ConnectionInfo,
    StorageAddress,
} from "../../privileged/state"
import {
    MessagePrefix,
    RawMessage,
    postRawMessage,
    sendRequest,
} from "./channel"

type StorageChangedMessage = {
    key: string
}

enum StoragePrefix {
    RootAddresses = "rootAddresses",
    PersistentKey = "persistentKey",
    Token = "token",
}

const rootAddressChangedHandlers: RootAddressesChangedHandler[] = []

function encodeBase64(data: Uint8Array | Blob): Promise<string> {
    return new Promise<string>((resolve) => {
        const blob =
            data instanceof Blob
                ? data
                : new Blob([data], { type: "application/octet-binary" })
        const reader = new FileReader()

        reader.onload = () => {
            const dataUrl = reader.result as string
            const [_, base64] = dataUrl.split(",", 2)
            resolve(base64)
        }

        reader.readAsDataURL(blob)
    })
}

async function decodeBase64(base64: string): Promise<Uint8Array> {
    const dataUrl = "data:application/octet-binary;base64," + base64
    const resp = await fetch(dataUrl)
    const arrayBuffer = await resp.arrayBuffer()

    return new Uint8Array(arrayBuffer)
}

export function handleStorageChanged(message: Json | undefined) {
    const m = message as StorageChangedMessage
    const parts = splitN(2, m.key, ":")
    if (parts === null) {
        return
    }
    switch (parts[0] as StoragePrefix) {
        case StoragePrefix.RootAddresses:
            for (const handler of rootAddressChangedHandlers) {
                handler()
            }
            break
    }
}

async function readStorage(prefix: StoragePrefix, name: string): Promise<Json> {
    const key = `${prefix}:${name}`
    const response = await sendRequest(MessagePrefix.ReadStorage, { key }, [])
    return response.message as Json
}

async function writeStorage(
    prefix: StoragePrefix,
    name: string,
    value: Json
): Promise<void> {
    const key = `${prefix}:${name}`
    await sendRequest(MessagePrefix.WriteStorage, { key, value }, [])
}

export function onRootAddressesChanged(handler: RootAddressesChangedHandler) {
    rootAddressChangedHandlers.push(handler)
}

export async function storeRootAddresses(
    rootAddresses: StorageAddress[]
): Promise<void> {
    await writeStorage(StoragePrefix.RootAddresses, "", rootAddresses)
}

export async function loadRootAddresses(): Promise<StorageAddress[]> {
    const rootAddresses = (await readStorage(
        StoragePrefix.RootAddresses,
        ""
    )) as StorageAddress[] | null
    return rootAddresses ?? []
}

export async function storeKey(
    keyType: PersistentKeyType,
    key: CryptoKey
): Promise<void> {
    const rawKey = await exportKey(key)
    const rawKeyBase64 = await encodeBase64(rawKey)
    await writeStorage(StoragePrefix.PersistentKey, keyType, rawKeyBase64)
}
export async function loadKey(
    keyType: PersistentKeyType
): Promise<CryptoKey | null> {
    const rawKeyBase64 = await readStorage(StoragePrefix.PersistentKey, keyType)
    if (rawKeyBase64 === null) {
        return null
    }
    const rawKey = await decodeBase64(rawKeyBase64 as string)
    return await importKey(rawKey)
}
export async function deleteKey(keyType: PersistentKeyType): Promise<void> {
    await writeStorage(StoragePrefix.PersistentKey, keyType, null)
}

export async function storeToken(
    connectionInfo: ConnectionInfo,
    token: AuthToken
): Promise<void> {
    await writeStorage(StoragePrefix.Token, objectKey(connectionInfo), token)
}
export async function loadToken(
    connectionInfo: ConnectionInfo
): Promise<AuthToken | null> {
    return (await readStorage(
        StoragePrefix.Token,
        objectKey(connectionInfo)
    )) as AuthToken | null
}

export async function beginDownload(filename: string, blob: Blob) {
    postRawMessage({
        prefix: MessagePrefix.BeginDownload,
        message: {
            filename,
            data: await encodeBase64(blob),
            contentType: blob.type,
        },
        ports: [],
    })
}

export async function rememberKey(key: CryptoKey): Promise<void> {
    const rawKey = await exportKey(key)
    const rawKeyBase64 = await encodeBase64(rawKey)
    await sendRequest(MessagePrefix.RememberKey, rawKeyBase64, [])
}

const unlockWithKeyHandlers: UnlockWithKeyHandler[] = []

export async function handleUnlockWithKey(
    rawKeyBase64: string
): Promise<RawMessage> {
    try {
        const rawKey = await decodeBase64(rawKeyBase64 as string)
        const key = await importKey(rawKey)

        for (const handler of unlockWithKeyHandlers) {
            await handler(key)
        }
        return {
            prefix: MessagePrefix.Response,
            message: undefined,
            ports: [],
        }
    } catch (ex) {
        return {
            prefix: MessagePrefix.Error,
            message: `${ex}`,
            ports: [],
        }
    }
}

export function onUnlockWithKey(handler: UnlockWithKeyHandler): void {
    unlockWithKeyHandlers.push(handler)
}
