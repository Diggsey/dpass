import { FunctionalComponent } from "preact";
import { sendMessage } from "~/entries/shared";
import { RootInfo } from "../privileged/state";
import { cn, usePromiseState } from "../ui";
import { IconButton } from "./iconButton";
import { RelativeDate } from "./relativeDate";
import { Status } from "./status";

export const LockPanel: FunctionalComponent<{ rootInfo: RootInfo }> = ({ rootInfo }) => {

    const [locking, lock] = usePromiseState(() => sendMessage({ id: "lock" }), [])
    const [changingPassword, changePassword] = usePromiseState(async () => {
        const oldPassword = prompt("Enter current password:")
        if (!oldPassword) {
            return
        }
        const newPassword = prompt("Enter new master password (8 character minimum):")
        if (!newPassword) {
            return
        }
        await sendMessage({
            id: "changeRootPassword",
            oldPassword,
            newPassword,
        })
    }, [])
    const [changingName, changeName] = usePromiseState(async () => {
        const name = prompt("Enter new name:")
        if (!name) {
            return
        }
        await sendMessage({
            id: "editRootName",
            name,
        })
    }, [])
    const lockError = locking.lastError ? <div class="field">
        <Status level="danger" colorText={true}>{locking.lastError.toString()}</Status>
    </div> : null

    const disabled = locking.inProgress || changingPassword.inProgress || changingName.inProgress
    const lockButtonClass = cn({
        button: true,
        isDanger: true,
        isLoading: locking.inProgress,
    })
    const changePasswordButtonClass = cn({
        button: true,
        isInfo: true,
        isLoading: changingPassword.inProgress,
    })
    const changeNameButtonClass = cn({
        hasTextDark: true,
        isLoading: changingName.inProgress,
        isStatic: disabled,
    })
    return <article class="panel is-success">
        <p class="panel-heading">
            <div class="icon-text">
                <span class="icon">
                    <i class="fas fa-unlock" />
                </span>
                <span>Unlocked: {rootInfo.name}</span>
                <span class="icon">
                    <a class={changeNameButtonClass} onClick={changeName}>
                        <i class="fas fa-pen" />
                    </a>
                </span>
                <span class="is-flex-grow-1 has-text-right is-size-6">
                    <span>Created: </span>
                    <RelativeDate timestamp={rootInfo.creationTimestamp} />
                </span>
            </div>
        </p>
        <div class="panel-block">
            {lockError}
            <div class="is-flex is-flex-wrap-wrap gap-1">
                <IconButton
                    class={lockButtonClass}
                    iconClass="fas fa-lock"
                    onClick={lock}
                    disabled={disabled}
                >
                    Lock
                </IconButton>
                <IconButton
                    class={changePasswordButtonClass}
                    iconClass="fas fa-key"
                    onClick={changePassword}
                    disabled={disabled}
                >
                    Change Password
                </IconButton>
            </div>
        </div>
    </article>
}