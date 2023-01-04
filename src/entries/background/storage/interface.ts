
export type DataAndEtag = {
    data: ArrayBuffer,
    etag: string,
}

export class ETagMismatchError extends Error { }

export interface IStorage {
    downloadFile(fileId: string): Promise<DataAndEtag | undefined>
    uploadFile(fileId: string, expectedEtag: string | null, data: ArrayBuffer): Promise<void>
    deleteFile(fileId: string, expectedEtag: string): Promise<void>
}