import { ExclamationTriangleIcon } from "@heroicons/react/24/outline"
import { FC, useEffect } from "react"
import host from "~/entries/shared/host"
import { useModalDialog, usePromiseState } from "../ui/hooks"
import { ButtonIcon } from "./buttonIcon"
import { ErrorText } from "./errorText"
import { Loader } from "./icons/loader"
import { ModalDialog } from "./modalDialog"
import { DangerButton, OutlineButton, PrimaryButton } from "./styledElem"

export const LockButtons: FC<{ isUnlocked: boolean }> = ({ isUnlocked }) => {
    const [locking, lock, clearLockError] = usePromiseState(
        (unenroll: boolean) => host.sendMessage({ id: "lock", unenroll }),
        []
    )

    const [
        unenrollDeviceDialog,
        openUnenrollDeviceDialog,
        unenrollDeviceDialogOpen,
    ] = useModalDialog(({ close, initialFocusRef }) => (
        <>
            <ModalDialog.Body>
                <ModalDialog.Icon
                    icon={ExclamationTriangleIcon}
                    className="bg-red-100 text-red-600"
                />
                <div>
                    <ModalDialog.Title>Unenroll device</ModalDialog.Title>
                    <p>
                        Are you sure you want to unenroll this device? You will
                        no longer be able to log into the current identity.
                    </p>
                    <ErrorText state={locking} />
                </div>
            </ModalDialog.Body>
            <ModalDialog.Footer>
                <DangerButton
                    onClick={async () => {
                        await lock(true)
                        close()
                    }}
                >
                    {locking.inProgress && <ButtonIcon icon={Loader} />}
                    <span>Unenroll</span>
                </DangerButton>
                <OutlineButton ref={initialFocusRef} onClick={close}>
                    Cancel
                </OutlineButton>
            </ModalDialog.Footer>
        </>
    ))

    useEffect(clearLockError, [unenrollDeviceDialogOpen])

    return (
        <div>
            {unenrollDeviceDialog}
            <ErrorText state={locking} />
            <div className="flex flex-wrap gap-3">
                {isUnlocked ? (
                    <PrimaryButton
                        type="button"
                        onClick={() => lock(false)}
                        disabled={locking.inProgress}
                    >
                        {locking.inProgress && <ButtonIcon icon={Loader} />}
                        <span>Lock</span>
                    </PrimaryButton>
                ) : null}
                <OutlineButton
                    type="button"
                    onClick={openUnenrollDeviceDialog}
                    disabled={locking.inProgress}
                >
                    Unenroll device
                </OutlineButton>
            </div>
        </div>
    )
}
