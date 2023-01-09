import { StorageAddress } from "~/entries/shared/privileged/state";
import { Rc } from "../rc";
import { DataAndEtag, IStorage } from "./interface";

export class SharedStorage extends Rc<IStorage> implements IStorage {
    get address(): StorageAddress {
        return this.value.address
    }
    downloadFile(fileId: string): Promise<DataAndEtag | undefined> {
        return this.value.downloadFile(fileId)
    }
    uploadFile(fileId: string, expectedEtag: string | null, data: Uint8Array): Promise<string> {
        return this.value.uploadFile(fileId, expectedEtag, data)
    }
    deleteFile(fileId: string, expectedEtag: string): Promise<void> {
        return this.value.deleteFile(fileId, expectedEtag)
    }
}
