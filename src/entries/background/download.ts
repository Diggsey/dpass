import browser, { Downloads } from "webextension-polyfill"
import { onInit } from "./init"

class DownloadManager {
    #urlsToRevoke = new Map<number, string>()

    #revokeDownloadId(downloadId: number) {
        const url = this.#urlsToRevoke.get(downloadId)
        if (url !== undefined) {
            this.#urlsToRevoke.delete(downloadId)
            URL.revokeObjectURL(url)
        }
    }

    async #beginDownload(filename: string, blob: Blob) {
        const url = URL.createObjectURL(blob)
        let downloadId
        try {
            downloadId = await browser.downloads.download({ url, filename })
        } catch (ex) {
            URL.revokeObjectURL(url)
            throw ex
        }
        this.#urlsToRevoke.set(downloadId, url)

        // Handle race condition in case download completed before we were able
        // to store its ID in the map
        const downloadItems = await browser.downloads.search({ id: downloadId })
        for (const downloadItem of downloadItems) {
            if (
                downloadItem.state === "complete" ||
                downloadItem.state === "interrupted"
            ) {
                this.#revokeDownloadId(downloadId)
            }
        }
    }
    beginDownload(filename: string, blob: Blob) {
        void this.#beginDownload(filename, blob)
    }

    onChanged = (downloadDelta: Downloads.OnChangedDownloadDeltaType) => {
        const state = downloadDelta.state?.current
        if (state === "complete" || state === "interrupted") {
            this.#revokeDownloadId(downloadDelta.id)
        }
    }
}

export const DOWNLOAD_MANAGER = new DownloadManager()

onInit(() => {
    browser.downloads.onChanged.addListener(DOWNLOAD_MANAGER.onChanged)
})
