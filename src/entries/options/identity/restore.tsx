import { ArchiveBoxIcon } from "@heroicons/react/24/outline"
import { useCallback } from "react"
import { ButtonIcon } from "~/entries/shared/components/buttonIcon"
import { Loader } from "~/entries/shared/components/icons/loader"
import { OutlineButton } from "~/entries/shared/components/styledElem"
import { sendMessage } from "~/entries/shared/messages"
import { usePromiseState } from "~/entries/shared/ui/hooks"

export const RestoreButton = () => {
    const [restoring, restore] = usePromiseState(async (url: string) => {
        await sendMessage({ id: "restore", url })
    }, [])
    const pickFileToRestore = useCallback(() => {
        const input = document.createElement("input")
        input.type = "file"
        input.accept = ".zip,application/zip"
        input.onchange = () => {
            const file = input.files && input.files[0]
            if (file) {
                const url = URL.createObjectURL(file)
                void restore(url)
            }
        }
        input.click()
    }, [])

    return (
        <OutlineButton
            onClick={pickFileToRestore}
            disabled={restoring.inProgress}
        >
            <ButtonIcon icon={restoring.inProgress ? Loader : ArchiveBoxIcon} />
            Restore
        </OutlineButton>
    )
}
