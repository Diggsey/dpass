import { FC } from "react"
import { sendMessage } from "../messages"
import { RootInfo } from "../privileged/state"
import { cn, usePromiseState } from "../ui"
import { IconButton } from "./iconButton"
import { RelativeDate } from "./relativeDate"
import { Status } from "./status"

export const LockButtons: FC<{ isUnlocked: boolean }> = ({ isUnlocked }) => {
    const [locking, lock] = usePromiseState(
        (unenroll: boolean) => sendMessage({ id: "lock", unenroll }),
        []
    )
    const lockError = locking.lastError ? (
        <div className="field">
            <Status level="danger" colorText={true}>
                {locking.lastError.toString()}
            </Status>
        </div>
    ) : null

    const lockButtonClass = cn({
        button: true,
        isWarning: true,
        isLoading: locking.inProgress,
    })
    const unenrollButtonClass = cn({
        button: true,
        isDanger: true,
        isLoading: locking.inProgress,
    })

    return (
        <div className="field">
            {lockError}
            <div className="is-flex is-flex-wrap-wrap gap-1">
                {isUnlocked ? (
                    <IconButton
                        className={lockButtonClass}
                        iconClass="fas fa-lock"
                        onClick={() => lock(false)}
                        disabled={locking.inProgress}
                    >
                        Lock
                    </IconButton>
                ) : null}
                <IconButton
                    className={unenrollButtonClass}
                    iconClass="fas fa-eraser"
                    onClick={() => lock(true)}
                    disabled={locking.inProgress}
                >
                    Unenroll device
                </IconButton>
            </div>
        </div>
    )
}

export const LockPanel: FC<{ rootInfo: RootInfo }> = ({ rootInfo }) => {
    const [changingPassword, changePassword] = usePromiseState(async () => {
        const oldPassword = prompt("Enter current password:")
        if (!oldPassword) {
            return
        }
        const newPassword = prompt(
            "Enter new master password (8 character minimum):"
        )
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

    const disabled = changingPassword.inProgress || changingName.inProgress
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
    return (
        <article className="panel is-success">
            <p className="panel-heading">
                <div className="icon-text">
                    <span className="icon">
                        <i className="fas fa-unlock" />
                    </span>
                    <span>Unlocked: {rootInfo.name}</span>
                    <span className="icon">
                        <a
                            className={changeNameButtonClass}
                            onClick={changeName}
                        >
                            <i className="fas fa-pen" />
                        </a>
                    </span>
                    <span className="is-flex-grow-1 has-text-right is-size-6">
                        <span>Created: </span>
                        <RelativeDate timestamp={rootInfo.creationTimestamp} />
                    </span>
                </div>
            </p>
            <div className="panel-block">
                <form>
                    <LockButtons isUnlocked={true} />
                    <div className="field">
                        <div className="is-flex is-flex-wrap-wrap gap-1">
                            <IconButton
                                className={changePasswordButtonClass}
                                iconClass="fas fa-key"
                                onClick={changePassword}
                                disabled={disabled}
                            >
                                Change Password
                            </IconButton>
                        </div>
                    </div>
                </form>
            </div>
        </article>
    )
}
