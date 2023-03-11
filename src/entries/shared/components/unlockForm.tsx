import { FunctionalComponent } from "preact"
import { sendMessage } from "../messages"
import { cn, usePromiseState } from "../ui"
import { LockButtons } from "./lockForm"
import { PasswordInput } from "./passwordInput"
import { Status } from "./status"

type UnlockFormProps = {
    isSetUp: boolean
}

export const UnlockForm: FunctionalComponent<UnlockFormProps> = ({
    isSetUp,
}) => {
    const [unlocking, unlock] = usePromiseState(async (e: Event) => {
        e.preventDefault()
        const formData = new FormData(e.target as HTMLFormElement)
        const secretSentence = formData.get("secretSentence") as string | null
        const masterPassword = formData.get("masterPassword") as string
        if (masterPassword) {
            await sendMessage({
                id: "unlock",
                masterPassword,
                secretSentence,
            })
        }
    }, [])
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
            <div class="field">
                <label class="label">Master password</label>
                <PasswordInput
                    name="masterPassword"
                    inputClass="is-danger"
                    autofocus
                />
                {unlockError}
            </div>
            {!isSetUp ? (
                <div class="field">
                    <label class="label">Secret sentence</label>
                    <div class="control has-icons-right">
                        <input
                            class="input is-danger"
                            type="text"
                            name="secretSentence"
                        />
                        <span class="icon is-right">
                            <i class="fas fa-key" />
                        </span>
                    </div>
                </div>
            ) : null}
            <div class="field">
                <div class="control">
                    <button type="submit" class={buttonClass}>
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

export const UnlockPanel: FunctionalComponent<UnlockPanelProps> = ({
    isSetUp,
    isUnlocked,
}) => {
    const title = isUnlocked ? "Protected" : "Locked"
    return (
        <article class="panel is-danger">
            <p class="panel-heading">
                <div class="icon-text">
                    <span class="icon">
                        <i class="fas fa-lock"></i>
                    </span>
                    <span>{title}</span>
                </div>
            </p>
            <div class="panel-block">
                <UnlockForm isSetUp={isSetUp} />
            </div>
        </article>
    )
}
