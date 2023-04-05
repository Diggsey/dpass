import { FC } from "react"
import { sendMessage } from "../messages"
import { usePromiseState } from "../ui/hooks"
import { ButtonIcon } from "./buttonIcon"
import { Loader } from "./icons/loader"
import { OutlineButton, PrimaryButton } from "./styledElem"

export const LockButtons: FC<{ isUnlocked: boolean }> = ({ isUnlocked }) => {
    const tmp = (unenroll: boolean) => sendMessage({ id: "lock", unenroll })
    const [locking, lock] = usePromiseState(tmp, [])
    const lockError = locking.lastError ? (
        <p className="text-sm text-red-600">{locking.lastError.toString()}</p>
    ) : null

    return (
        <div>
            {lockError}
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
                    className="relative inline-flex items-center gap-x-1.5 rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-600 hover:bg-gray-50 disabled:bg-white disabled:text-gray-600 disabled:ring-gray-300"
                    onClick={() => lock(true)}
                    disabled={locking.inProgress}
                >
                    {locking.inProgress && <ButtonIcon icon={Loader} />}
                    <span>Unenroll device</span>
                </OutlineButton>
            </div>
        </div>
    )
}
