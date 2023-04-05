import { FormEvent } from "react"
import { ButtonIcon } from "~/entries/shared/components/buttonIcon"
import { FormInput } from "~/entries/shared/components/formInput"
import { InputValidationIcon } from "~/entries/shared/components/inputValidationIcon"
import { Loader } from "~/entries/shared/components/icons/loader"
import {
    Label,
    PrimaryButton,
    SecondaryButton,
    ValidationError,
} from "~/entries/shared/components/styledElem"
import { sendMessage } from "~/entries/shared/messages"
import { useFormData, usePromiseState } from "~/entries/shared/ui/hooks"

export const ChangeNameForm = ({
    currentName,
    close,
}: {
    currentName: string
    close: () => void
}) => {
    const { data, setData, ids, validity, allValid } = useFormData<{
        name: string | null
    }>(
        {
            name: {
                initial: null,
                validator: (v) => v.length > 0,
            },
        },
        []
    )
    const [changingName, changeName] = usePromiseState(
        async (e: FormEvent) => {
            e.preventDefault()
            if (!allValid) {
                return
            }
            await sendMessage({
                id: "editRootName",
                name: data.name,
            })
            close()
        },
        [close, data, allValid]
    )

    return (
        <form className="grid gap-4" onSubmit={changeName}>
            <div className="text-base font-semibold leading-6 text-gray-900">
                Change name
            </div>
            <div>
                <Label htmlFor={ids.name}>Name</Label>
                <div className="relative mt-2 rounded-md shadow-sm">
                    <FormInput
                        type="text"
                        id={ids.name}
                        aria-invalid={validity.name === false}
                        onCommit={(e) => setData("name", e.currentTarget.value)}
                        autoFocus
                        defaultValue={currentName}
                    />
                    <InputValidationIcon valid={validity.name} />
                </div>
                {validity.name === false && (
                    <ValidationError>Name is required.</ValidationError>
                )}
            </div>
            <div className="flex items-center justify-end gap-3">
                <SecondaryButton type="button" onClick={close}>
                    Cancel
                </SecondaryButton>
                <PrimaryButton type="submit" disabled={!allValid}>
                    {changingName.inProgress && <ButtonIcon icon={Loader} />}
                    <span>Save</span>
                </PrimaryButton>
            </div>
        </form>
    )
}
