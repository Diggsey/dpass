import { FC, useCallback, useState } from "react"
import { PrivilegedVault } from "../../shared/privileged/state"
import { RelativeDate } from "../../shared/components/relativeDate"
import {
    Card,
    OutlineButton,
    TextButton,
} from "../../shared/components/styledElem"
import { Slide } from "~/entries/shared/components/slide"
import { ChangeNameForm } from "./details/changeNameForm"
import { sendMessage } from "~/entries/shared/messages"
import {
    setLocalState,
    usePromiseState,
    useSharedPromiseState,
} from "~/entries/shared/ui/hooks"
import { ButtonIcon } from "~/entries/shared/components/buttonIcon"
import { Loader } from "~/entries/shared/components/icons/loader"

type DetailsListProps = {
    vaultId: string
    vault: PrivilegedVault
    isDefault: boolean
    openForm: (form: ActiveForm) => void
}

const DetailsList = ({
    vaultId,
    vault,
    isDefault,
    openForm,
}: DetailsListProps) => {
    const vaultAction = useSharedPromiseState()

    const [removingVault, removeVault] = usePromiseState(
        async () => {
            await sendMessage({
                id: "removeVault",
                vaultId,
            })
            setLocalState("activeVaultId", null)
        },
        [],
        vaultAction
    )

    const [settingVaultAsDefault, setVaultAsDefault] = usePromiseState(
        async () => {
            await sendMessage({
                id: "setVaultAsDefault",
                vaultId,
            })
        },
        [],
        vaultAction
    )

    return (
        <dl className="sm:divide-y sm:divide-gray-200">
            <div className="py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6 sm:py-5">
                <dt className="text-sm font-medium text-gray-500">Name</dt>
                <dd className="mt-1 flex text-sm text-gray-900 sm:col-span-2 sm:mt-0">
                    <span className="flex-grow">{vault.name}</span>
                    <span className="ml-4 flex-shrink-0">
                        <TextButton
                            type="button"
                            onClick={() => openForm(ActiveForm.ChangeName)}
                        >
                            Change
                        </TextButton>
                    </span>
                </dd>
            </div>
            <div className="py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6 sm:py-5">
                <dt className="text-sm font-medium text-gray-500">
                    Default vault
                </dt>
                <dd className="mt-1 flex text-sm text-gray-900 sm:col-span-2 sm:mt-0">
                    <span className="flex-grow">
                        {isDefault ? "Yes" : "No"}
                    </span>
                    <span className="ml-4 flex-shrink-0">
                        {!isDefault && (
                            <TextButton
                                type="button"
                                onClick={setVaultAsDefault}
                            >
                                {settingVaultAsDefault.inProgress && (
                                    <ButtonIcon icon={Loader} />
                                )}
                                <span>Make default</span>
                            </TextButton>
                        )}
                    </span>
                </dd>
            </div>
            <div className="py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6 sm:py-5">
                <dt className="text-sm font-medium text-gray-500">Created</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:col-span-2 sm:mt-0">
                    <RelativeDate timestamp={vault.creationTimestamp} />
                </dd>
            </div>
            <div className="py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6 sm:py-5">
                <dt className="text-sm font-medium text-gray-500">Updated</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:col-span-2 sm:mt-0">
                    <RelativeDate timestamp={vault.updateTimestamp} />
                </dd>
            </div>
            <div className="py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6 sm:py-5">
                <dt className="text-sm font-medium text-gray-500">Actions</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:col-span-2 sm:mt-0">
                    <OutlineButton onClick={removeVault}>
                        {removingVault.inProgress && (
                            <ButtonIcon icon={Loader} />
                        )}
                        <span>Remove Vault</span>
                    </OutlineButton>
                </dd>
            </div>
        </dl>
    )
}

enum ActiveForm {
    None,
    ChangeName,
}

export const DetailsPanel: FC<{
    vaultId: string
    vault: PrivilegedVault
    isDefault: boolean
}> = ({ vaultId, vault, isDefault }) => {
    const [activeForm, setActiveForm] = useState(ActiveForm.None)
    const [formOpen, setFormOpen] = useState(false)
    const openForm = useCallback((form: ActiveForm) => {
        setActiveForm(form)
        setFormOpen(true)
    }, [])
    const closeForm = useCallback(() => setFormOpen(false), [])

    let renderedForm
    switch (activeForm) {
        case ActiveForm.None:
            renderedForm = null
            break
        case ActiveForm.ChangeName:
            renderedForm = (
                <ChangeNameForm
                    vaultId={vaultId}
                    currentName={vault.name}
                    close={closeForm}
                />
            )
            break
    }

    return (
        <Card>
            <Card.Header>
                <h3 className="text-base font-semibold leading-6 text-gray-900">
                    Vault: {vault.name}
                </h3>
            </Card.Header>
            <Slide open={formOpen}>
                <Slide.Left>
                    <Card.Body>
                        <DetailsList
                            vaultId={vaultId}
                            vault={vault}
                            isDefault={isDefault}
                            openForm={openForm}
                        />
                    </Card.Body>
                </Slide.Left>
                <Slide.Right>
                    <Card.Body>{renderedForm}</Card.Body>
                </Slide.Right>
            </Slide>
        </Card>
    )
}
