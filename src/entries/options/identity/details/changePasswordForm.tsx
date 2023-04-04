import { FormEvent } from "react"
import { ButtonIcon } from "~/entries/shared/components/buttonIcon"
import { Loader } from "~/entries/shared/components/loader"
import { PasswordInput } from "~/entries/shared/components/passwordInput"
import {
    HelpText,
    Label,
    PrimaryButton,
    SecondaryButton,
    ValidationError,
} from "~/entries/shared/components/styledElem"
import { sendMessage } from "~/entries/shared/messages"
import { useFormData, usePromiseState } from "~/entries/shared/ui/hooks"

type Data = {
    currentPassword: string | null
    masterPassword: string | null
    retypePassword: string | null
}

export const ChangePasswordForm = ({ close }: { close: () => void }) => {
    const { data, setData, ids, validity, allValid } = useFormData<Data>(
        {
            currentPassword: {
                initial: null,
                validator: (v) => v.length > 0,
            },
            masterPassword: {
                initial: null,
                validator: (v) => v.length >= 8,
            },
            retypePassword: {
                initial: null,
                validator: (v, d) => v === d.masterPassword,
            },
        },
        []
    )
    const [changingPassword, changePassword] = usePromiseState(
        async (e: FormEvent) => {
            e.preventDefault()
            if (!allValid) {
                return
            }
            await sendMessage({
                id: "changeRootPassword",
                oldPassword: data.currentPassword,
                newPassword: data.masterPassword,
            })
            close()
        },
        [close, data]
    )

    return (
        <form className="grid gap-4" onSubmit={changePassword}>
            <div className="text-base font-semibold leading-6 text-gray-900">
                Change master password
            </div>
            <div>
                <Label htmlFor={ids.currentPassword}>Current password</Label>
                <PasswordInput
                    inputId={ids.currentPassword}
                    aria-invalid={
                        validity.currentPassword === false ||
                        !!changingPassword.lastError
                    }
                    onCommit={(e) =>
                        setData("currentPassword", e.currentTarget.value)
                    }
                />
                {changingPassword.lastError ? (
                    <ValidationError>Incorrect password.</ValidationError>
                ) : validity.currentPassword === false ? (
                    <ValidationError>
                        Current password is required.
                    </ValidationError>
                ) : null}
            </div>
            <div>
                <Label htmlFor={ids.masterPassword}>New password</Label>
                <PasswordInput
                    inputId={ids.masterPassword}
                    aria-invalid={validity.masterPassword === false}
                    onCommit={(e) =>
                        setData("masterPassword", e.currentTarget.value)
                    }
                />
                <HelpText>
                    Password must be at least 8 characters long.
                </HelpText>
                {validity.masterPassword === false && (
                    <ValidationError>Password is invalid.</ValidationError>
                )}
            </div>
            <div>
                <Label htmlFor={ids.retypePassword}>
                    Re-enter new password
                </Label>
                <PasswordInput
                    inputId={ids.retypePassword}
                    aria-invalid={validity.retypePassword === false}
                    onCommit={(e) =>
                        setData("retypePassword", e.currentTarget.value)
                    }
                />
                {validity.retypePassword === false && (
                    <ValidationError>Passwords do not match.</ValidationError>
                )}
            </div>
            <div className="flex items-center justify-end gap-3">
                <SecondaryButton type="button" onClick={close}>
                    Cancel
                </SecondaryButton>
                <PrimaryButton type="submit" disabled={!allValid}>
                    {changingPassword.inProgress && (
                        <ButtonIcon icon={Loader} />
                    )}
                    <span>Save</span>
                </PrimaryButton>
            </div>
        </form>
    )
}
