import { FunctionalComponent } from "preact";
import { sendMessage } from "~/entries/shared";
import { cn, usePromiseState } from "../ui";
import { Status } from "./status";

export const UnlockForm: FunctionalComponent = () => {

    const [unlocking, unlock] = usePromiseState(async (e: Event) => {
        e.preventDefault()
        const formData = new FormData(e.target as HTMLFormElement)
        const masterPassword = formData.get("masterPassword") as string
        if (masterPassword) {
            await sendMessage({
                id: "unlock",
                masterPassword
            })
        }
    }, [])
    const unlockError = unlocking.lastError ? <Status level="danger" colorText={true}>{unlocking.lastError.toString()}</Status> : null

    const buttonClass = cn({
        button: true,
        isPrimary: true,
        isLoading: unlocking.inProgress,
    })
    return <form onSubmit={unlock}>
        <div class="field">
            <label class="label">Master password</label>
            <div class="control has-icons-right">
                <input class="input is-danger" type="password" name="masterPassword" autofocus />
                <span class="icon is-right">
                    <i class="fas fa-key" />
                </span>
            </div>
            {unlockError}
        </div>
        <div class="field">
            <div class="control">
                <button type="submit" class={buttonClass}>Unlock</button>
            </div>
        </div>
    </form>
}

type UnlockPanelProps = {
    isUnlocked: boolean,
}

export const UnlockPanel: FunctionalComponent<UnlockPanelProps> = ({ isUnlocked }) => {
    const title = isUnlocked ? "Protected" : "Locked"
    return <article class="panel is-danger">
        <p class="panel-heading">
            <div class="icon-text">
                <span class="icon">
                    <i class="fas fa-lock"></i>
                </span>
                <span>{title}</span>
            </div>
        </p>
        <div class="panel-block">
            <UnlockForm />
        </div>
    </article>
}