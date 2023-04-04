import { KeyIcon } from "@heroicons/react/24/outline"
import { FC, FormEvent, useId } from "react"
import { sendMessage } from "../messages"
import { cn } from "../ui"
import { usePromiseState } from "../ui/hooks"
import { ButtonIcon } from "./buttonIcon"
import { Loader } from "./loader"
import { LockButtons } from "./lockButtons"
import { PasswordInput } from "./passwordInput"
import { Card, PrimaryButton } from "./styledElem"

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
        <p className="text-sm text-red-600">{unlocking.lastError.toString()}</p>
    ) : null

    return (
        <form
            onSubmit={unlock}
            className="grid max-w-lg grid-cols-1 gap-x-6 gap-y-4 mx-auto"
        >
            <div>
                <label
                    htmlFor={passwordId}
                    className="block text-sm font-medium leading-6 text-gray-900"
                >
                    Master password
                </label>
                <PasswordInput
                    name="masterPassword"
                    inputId={passwordId}
                    aria-invalid={!!unlockError}
                    autoFocus
                />
            </div>
            {!isSetUp ? (
                <div>
                    <label
                        htmlFor={secretSentenceId}
                        className="block text-sm font-medium leading-6 text-gray-900"
                    >
                        Secret sentence
                    </label>
                    <div className="relative mt-2 rounded-md shadow-sm">
                        <input
                            className={cn(
                                "block w-full rounded-md border-0 py-1.5 pr-10 ring-1 ring-inset placeholder:text-gray-400 focus:ring-2 focus:ring-inset sm:text-sm sm:leading-6",
                                unlockError
                                    ? "text-red-900 ring-red-300 focus:ring-red-500"
                                    : "text-gray-900 ring-gray-300 focus:ring-indigo-600"
                            )}
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
            {unlockError}
            <div className="flex items-center justify-end gap-3">
                {unlockError && isSetUp ? (
                    <LockButtons isUnlocked={false} />
                ) : null}
                <PrimaryButton type="submit">
                    {unlocking.inProgress && <ButtonIcon icon={Loader} />}
                    <span>{isSetUp ? "Unlock" : "Enroll device"}</span>
                </PrimaryButton>
            </div>
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
        <Card>
            <Card.Header>
                <h3 className="text-base font-semibold leading-6 text-gray-900">
                    Identity status: {status}
                </h3>
            </Card.Header>
            <Card.Body>
                <UnlockForm isSetUp={isSetUp} />
            </Card.Body>
        </Card>
    )
}
