import { GDriveStorageAddress } from "~/entries/shared/privileged/state"
import { Disposable } from "../../shared/mixins/disposable"
import { TOKEN_MANAGER } from "../../shared/tokens"
import { storageConnection } from "./connection"
import { DataAndEtag, ETagMismatchError, IStorage } from "./interface"

type File = {
    id: string,
}

type FileList = {
    kind: "drive#fileList",
    nextPageToken?: string,
    incompleteSearch: boolean,
    files: File[]
}

const BASE_URL = "https://www.googleapis.com"

export class GDriveStorage extends Disposable(EventTarget) implements IStorage {
    readonly address: GDriveStorageAddress

    constructor(address: GDriveStorageAddress) {
        super()
        this.address = address
    }
    static async open(address: GDriveStorageAddress): Promise<GDriveStorage> {
        const [_token, connectionInfo] = await TOKEN_MANAGER.request(storageConnection(address))
        if (connectionInfo.id !== "oauth") {
            throw new Error("Connection type should be oauth")
        }
        return new GDriveStorage({
            ...address,
            userId: connectionInfo.userId
        })
    }
    async #getToken(): Promise<string> {
        return (await TOKEN_MANAGER.request(storageConnection(this.address)))[0].accessToken
    }
    async #fetch(...args: ConstructorParameters<typeof Request>): Promise<Response> {
        const request = new Request(...args)
        const token = await this.#getToken()
        request.headers.set("Authorization", `Bearer ${token}`)
        const response = await fetch(request)
        if (!response.ok) {
            if (response.status == 412) {
                throw new ETagMismatchError()
            }
            throw new Error(`GDrive request failed: ${request} => ${response}`)
        }
        return response
    }
    async #fetchJson<T>(...args: ConstructorParameters<typeof Request>): Promise<T> {
        const request = new Request(...args)
        request.headers.set("Accept", "application/json")
        const response = await this.#fetch(request)
        return await response.json()
    }
    #fileName(fileId: string): string {
        return `${fileId}.dpass`
    }
    async #getGDriveFileId(fileId: string): Promise<string | null> {
        const folderId = this.address.folderId
        const fileName = this.#fileName(fileId)
        const filters = [
            `'${folderId}' in parents`,
            `name = '${fileName}'`,
            `mimeType != 'application/vnd.google-apps.folder'`,
            `trashed = false`,
        ]
        const fileList: FileList = await this.#fetchJson(`${BASE_URL}/drive/v3/files?` + new URLSearchParams({
            fields: "files(id)",
            q: filters.join(" and "),
            supportsAllDrives: "true",
            includeItemsFromAllDrives: "true",
        }))

        if (fileList.files.length > 1) {
            throw new Error(`GDrive has multiple files with the same name (${fileName}) in the same folder (${folderId})`)
        } else if (fileList.files.length == 0) {
            // No file present
            return null
        }
        return fileList.files[0].id
    }
    async downloadFile(fileId: string): Promise<DataAndEtag | undefined> {
        const gdriveId = await this.#getGDriveFileId(fileId)
        if (!gdriveId) {
            return
        }
        const response = await this.#fetch(`${BASE_URL}/drive/v3/files/${gdriveId}?alt=media&supportsAllDrives=true`)
        const etag = response.headers.get("ETag")
        if (!etag) {
            throw new Error("GDrive did not return ETag on response")
        }
        const data = new Uint8Array(await response.arrayBuffer())
        return {
            etag,
            data,
        }
    }
    async uploadFile(fileId: string, expectedEtag: string | null, data: Uint8Array): Promise<string> {
        let gdriveId = await this.#getGDriveFileId(fileId)
        const fileName = this.#fileName(fileId)
        if (!gdriveId) {
            // Create empty file
            const newFile: File = await this.#fetchJson(`${BASE_URL}/drive/v3/files?supportsAllDrives=true`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    parents: [this.address.folderId],
                    name: fileName,
                    mimeType: "application/octet-stream"
                })
            })
            gdriveId = newFile.id
            expectedEtag = null
        }
        // Upload file contents
        const response = await this.#fetch(`${BASE_URL}/upload/drive/v3/files/${gdriveId}?uploadType=media&supportsAllDrives=true`, {
            method: "PATCH",
            headers: expectedEtag ? {
                "If-Match": expectedEtag
            } : {},
            body: data
        })
        const etag = response.headers.get("ETag")
        if (!etag) {
            throw new Error("GDrive did not return ETag on response")
        }
        return etag
    }
    async deleteFile(fileId: string, expectedEtag: string): Promise<void> {
        const gdriveId = await this.#getGDriveFileId(fileId)
        if (!gdriveId) {
            return
        }
        await this.#fetch(`${BASE_URL}/drive/v3/files/${gdriveId}?supportsAllDrives=true`, {
            method: "DELETE",
            headers: expectedEtag ? {
                "If-Match": expectedEtag
            } : {}
        })
    }
}