import { KeyIcon } from "@heroicons/react/24/outline"
import { FC, FormEvent, useId } from "react"
import { sendMessage } from "../messages"
import { cn } from "../ui"
import { usePromiseState } from "../ui/hooks"
import { LockButtons } from "./lockForm"
import { PasswordInput } from "./passwordInput"
import { Status } from "./status"

type UnlockFormProps = {
    isSetUp: boolean
}

export const UnlockForm: FC<UnlockFormProps> = ({ isSetUp }) => {
    const passwordId = useId()
    const secretSentenceId = useId()
    const [unlocking, unlock] = usePromiseState(
        async (e: FormEvent<HTMLFormElement>) => {
            e.preventDefault()
            const formData = new FormData(e.currentTarget)
            const secretSentence = formData.get("secretSentence") as
                | string
                | null
            const masterPassword = formData.get("masterPassword") as string
            if (masterPassword) {
                await sendMessage({
                    id: "unlock",
                    masterPassword,
                    secretSentence,
                })
            }
        },
        []
    )
    const unlockError = unlocking.lastError ? (
        <Status level="danger" colorText={true}>
            {unlocking.lastError.toString()}
        </Status>
    ) : null

    const buttonClass = cn({
        button: true,
        isPrimary: true,
        isLoading: unlocking.inProgress,
    })
    return (
        <form
            onSubmit={unlock}
            className="grid max-w-2xl grid-cols-1 gap-x-6 gap-y-6"
        >
            <div className="max-w-md">
                <label
                    htmlFor={passwordId}
                    className="block text-sm font-medium leading-6 text-gray-900"
                >
                    Master password
                </label>
                <PasswordInput
                    className="mt-2"
                    name="masterPassword"
                    inputId={passwordId}
                    autoFocus
                />
                {unlockError}
            </div>
            {!isSetUp ? (
                <div className="max-w-md">
                    <label
                        htmlFor={secretSentenceId}
                        className="block text-sm font-medium leading-6 text-gray-900"
                    >
                        Secret sentence
                    </label>
                    <div className="relative mt-2 rounded-md shadow-sm">
                        <input
                            className="block w-full rounded-md border-0 py-1.5 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                            type="text"
                            name="secretSentence"
                        />
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                            <KeyIcon
                                className="h-5 w-5 text-gray-400"
                                aria-hidden="true"
                            />
                        </div>
                    </div>
                </div>
            ) : null}
            <div className="field">
                <div className="control">
                    <button type="submit" className={buttonClass}>
                        Unlock
                    </button>
                </div>
            </div>
            {unlockError && isSetUp ? <LockButtons isUnlocked={false} /> : null}
        </form>
    )
}

type UnlockPanelProps = {
    isSetUp: boolean
    isUnlocked: boolean
}

export const UnlockPanel: FC<UnlockPanelProps> = ({ isSetUp, isUnlocked }) => {
    const status = isUnlocked
        ? "protected"
        : isSetUp
        ? "locked"
        : "device not enrolled"
    return (
        <div className="divide-y divide-gray-200 overflow-hidden sm:rounded-lg bg-white shadow">
            <div className="px-4 py-5 sm:px-6">
                <div className="icon-text">
                    <h3 className="text-base font-semibold leading-6 text-gray-900">
                        Identity status: {status}
                    </h3>
                </div>
            </div>
            <div className="px-4 py-5 sm:p-6">
                <UnlockForm isSetUp={isSetUp} />
            </div>
        </div>
    )
}
