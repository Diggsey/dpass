import { FC, FormEvent } from "react"
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
        <form onSubmit={unlock}>
            <div className="field">
                <label className="label">Master password</label>
                <PasswordInput
                    name="masterPassword"
                    inputClass="is-danger"
                    autoFocus
                />
                {unlockError}
            </div>
            {!isSetUp ? (
                <div className="field">
                    <label className="label">Secret sentence</label>
                    <div className="control has-icons-right">
                        <input
                            className="input is-danger"
                            type="text"
                            name="secretSentence"
                        />
                        <span className="icon is-right">
                            <i className="fas fa-key" />
                        </span>
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
    const title = isUnlocked ? "Protected" : "Locked"
    return (
        <article className="panel is-danger">
            <p className="panel-heading">
                <div className="icon-text">
                    <span className="icon">
                        <i className="fas fa-lock"></i>
                    </span>
                    <span>{title}</span>
                </div>
            </p>
            <div className="panel-block">
                <UnlockForm isSetUp={isSetUp} />
            </div>
        </article>
    )
}
