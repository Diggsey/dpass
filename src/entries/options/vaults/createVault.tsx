import { FormEvent } from "react"
import { ButtonIcon } from "~/entries/shared/components/buttonIcon"
import { FormInput } from "~/entries/shared/components/formInput"
import { InputValidationIcon } from "~/entries/shared/components/inputValidationIcon"
import { Loader } from "~/entries/shared/components/icons/loader"
import {
    Card,
    Label,
    PrimaryButton,
    SecondaryButton,
    ValidationError,
} from "~/entries/shared/components/styledElem"
import { sendMessage } from "~/entries/shared/messages"
import { useFormData, usePromiseState } from "~/entries/shared/ui/hooks"

export const CreateVaultForm = ({ close }: { close: () => void }) => {
    const { data, setData, ids, validity, allValid } = useFormData<{
        name: string | null
        copyStorage: boolean
    }>(
        {
            name: {
                initial: null,
                validator: (v) => v.length > 0,
            },
            copyStorage: {
                initial: true,
            },
        },
        []
    )
    const [creatingVault, createVault] = usePromiseState(
        async (e: FormEvent) => {
            e.preventDefault()
            if (!allValid) {
                return
            }
            await sendMessage({
                id: "createVault",
                name: data.name,
            })
            close()
        },
        [close, data, allValid]
    )

    return (
        <div className="container grid mx-auto max-w-7xl sm:px-6 lg:px-8">
            <Card>
                <Card.Body>
                    <form className="grid gap-4" onSubmit={createVault}>
                        <div className="text-base font-semibold leading-6 text-gray-900">
                            Create new vault
                        </div>
                        <div>
                            <Label htmlFor={ids.name}>Name</Label>
                            <div className="relative mt-2 rounded-md shadow-sm">
                                <FormInput
                                    type="text"
                                    id={ids.name}
                                    aria-invalid={validity.name === false}
                                    onCommit={(e) =>
                                        setData("name", e.currentTarget.value)
                                    }
                                    autoFocus
                                />
                                <InputValidationIcon valid={validity.name} />
                            </div>
                            {validity.name === false && (
                                <ValidationError>
                                    Name is required.
                                </ValidationError>
                            )}
                        </div>
                        <label
                            className="relative flex items-center leading-6 cursor-pointer"
                            htmlFor={ids.copyStorage}
                        >
                            <input
                                id={ids.copyStorage}
                                type="checkbox"
                                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600 cursor-pointer"
                                onChange={(e) =>
                                    setData(
                                        "copyStorage",
                                        e.currentTarget.checked
                                    )
                                }
                                defaultChecked={true}
                            />
                            <span className="ml-3 text-sm font-medium text-gray-900">
                                Store with my identity
                            </span>
                        </label>
                        <div className="flex items-center justify-end gap-3">
                            <SecondaryButton type="button" onClick={close}>
                                Cancel
                            </SecondaryButton>
                            <PrimaryButton type="submit" disabled={!allValid}>
                                {creatingVault.inProgress && (
                                    <ButtonIcon icon={Loader} />
                                )}
                                <span>Save</span>
                            </PrimaryButton>
                        </div>
                    </form>
                </Card.Body>
            </Card>
        </div>
    )
}
