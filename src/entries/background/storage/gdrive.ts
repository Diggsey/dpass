import { GDriveStorageAddress } from "~/entries/shared/privileged/state"
import { Disposable } from "../../shared/mixins/disposable"
import { storageConnection } from "./connection"
import { DataAndEtag, ETagMismatchError, IStorage } from "./interface"
import host from "~/entries/shared/host"

const FILE_FIELDS = "id,headRevisionId,etag"

type File = {
    id: string
    headRevisionId: string
    etag: string
}

type FileList = {
    kind: "drive#fileList"
    nextPageToken?: string
    incompleteSearch: boolean
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
        const [_token, connectionInfo] = await host.requestToken(
            storageConnection(address)
        )
        if (connectionInfo.id !== "oauth") {
            throw new Error("Connection type should be oauth")
        }
        return new GDriveStorage({
            ...address,
            userId: connectionInfo.userId,
        })
    }
    async #getToken(): Promise<string> {
        return (await host.requestToken(storageConnection(this.address)))[0]
            .accessToken
    }
    async #fetch(
        ...args: ConstructorParameters<typeof Request>
    ): Promise<Response> {
        const request = new Request(...args)
        const token = await this.#getToken()
        request.headers.set("Authorization", `Bearer ${token}`)
        const response = await fetch(request)
        if (!response.ok) {
            if (response.status == 412) {
                throw new ETagMismatchError()
            }
            throw new Error(`GDrive request failed: ${await response.text()}`)
        }
        return response
    }
    async #fetchJson<T>(
        ...args: ConstructorParameters<typeof Request>
    ): Promise<T> {
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
        const fileList: FileList = await this.#fetchJson(
            `${BASE_URL}/drive/v3/files?` +
                new URLSearchParams({
                    fields: "files(id)",
                    q: filters.join(" and "),
                    supportsAllDrives: "true",
                    includeItemsFromAllDrives: "true",
                })
        )

        if (fileList.files.length > 1) {
            throw new Error(
                `GDrive has multiple files with the same name (${fileName}) in the same folder (${folderId})`
            )
        } else if (fileList.files.length == 0) {
            // No file present
            return null
        }
        return fileList.files[0].id
    }
    async #getGDriveFile(gdriveId: string): Promise<File> {
        return await this.#fetchJson(
            `${BASE_URL}/drive/v2/files/${gdriveId}?` +
                new URLSearchParams({
                    supportsAllDrives: "true",
                    fields: FILE_FIELDS,
                })
        )
    }
    async #downloadGDriveRevision(
        gdriveId: string,
        revisionId: string
    ): Promise<Response> {
        return await this.#fetch(
            `${BASE_URL}/download/drive/v2/files/${gdriveId}?` +
                new URLSearchParams({
                    supportsAllDrives: "true",
                    alt: "media",
                    revisionId,
                })
        )
    }
    async #createGDriveFile(fileName: string): Promise<File> {
        return await this.#fetchJson(
            `${BASE_URL}/drive/v2/files?` +
                new URLSearchParams({
                    supportsAllDrives: "true",
                    fields: FILE_FIELDS,
                }),
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    parents: [
                        {
                            id: this.address.folderId,
                        },
                    ],
                    title: fileName,
                    mimeType: "application/octet-stream",
                }),
            }
        )
    }
    async #updateGDriveFile(
        gdriveId: string,
        expectedEtag: string,
        data: Uint8Array
    ): Promise<File> {
        return await this.#fetchJson(
            `${BASE_URL}/upload/drive/v2/files/${gdriveId}?` +
                new URLSearchParams({
                    supportsAllDrives: "true",
                    uploadType: "media",
                    fields: FILE_FIELDS,
                }),
            {
                method: "PUT",
                headers: {
                    "If-Match": expectedEtag,
                },
                body: data,
            }
        )
    }
    async #deleteGDriveFile(
        gdriveId: string,
        expectedEtag: string | null
    ): Promise<Response> {
        return await this.#fetch(
            `${BASE_URL}/drive/v2/files/${gdriveId}?` +
                new URLSearchParams({
                    supportsAllDrives: "true",
                }),
            {
                method: "DELETE",
                headers: expectedEtag
                    ? {
                          "If-Match": expectedEtag,
                      }
                    : {},
            }
        )
    }
    async downloadFile(fileId: string): Promise<DataAndEtag | undefined> {
        const gdriveId = await this.#getGDriveFileId(fileId)
        if (!gdriveId) {
            return
        }
        const file: File = await this.#getGDriveFile(gdriveId)
        if (!file.etag) {
            throw new Error("GDrive did not return ETag on response")
        }
        const response = await this.#downloadGDriveRevision(
            gdriveId,
            file.headRevisionId
        )
        const data = new Uint8Array(await response.arrayBuffer())
        return {
            etag: file.etag,
            data,
        }
    }
    async uploadFile(
        fileId: string,
        expectedEtag: string | null,
        data: Uint8Array
    ): Promise<string> {
        let gdriveId = await this.#getGDriveFileId(fileId)
        const fileName = this.#fileName(fileId)
        if (!gdriveId) {
            // Create empty file
            const newFile: File = await this.#createGDriveFile(fileName)
            gdriveId = newFile.id
            expectedEtag = newFile.etag
        } else if (!expectedEtag) {
            throw new ETagMismatchError()
        }
        // Upload file contents
        const file = await this.#updateGDriveFile(gdriveId, expectedEtag, data)
        if (!file.etag) {
            throw new Error("GDrive did not return ETag on response")
        }
        return file.etag
    }
    async deleteFile(
        fileId: string,
        expectedEtag: string | null
    ): Promise<void> {
        const gdriveId = await this.#getGDriveFileId(fileId)
        if (!gdriveId) {
            return
        }
        await this.#deleteGDriveFile(gdriveId, expectedEtag)
    }
}
