import { ArchiveBoxIcon } from "@heroicons/react/24/outline"
import { useCallback } from "react"
import { openFilePicker } from "~/entries/shared"
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
        openFilePicker(
            {
                accept: ".zip,application/zip",
            },
            ([url]) => restore(url)
        )
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
