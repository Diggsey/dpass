import { FC, useCallback, useState } from "react"
import { PrivilegedVault } from "../../shared/privileged/state"
import { RelativeDate } from "../../shared/components/relativeDate"
import {
    Card,
    DangerButton,
    OutlineButton,
    TextButton,
} from "../../shared/components/styledElem"
import { Slide } from "~/entries/shared/components/slide"
import { ChangeNameForm } from "./details/changeNameForm"
import host from "~/entries/shared/host"
import {
    setLocalState,
    useModalDialog,
    usePromiseState,
    useSharedPromiseState,
} from "~/entries/shared/ui/hooks"
import { ButtonIcon } from "~/entries/shared/components/buttonIcon"
import { Loader } from "~/entries/shared/components/icons/loader"
import { ModalDialog } from "~/entries/shared/components/modalDialog"
import {
    ArrowDownTrayIcon,
    ArrowUpTrayIcon,
    ExclamationTriangleIcon,
} from "@heroicons/react/24/outline"
import { ErrorText } from "~/entries/shared/components/errorText"
import { openFilePicker } from "~/entries/shared"

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
        async (wipe: boolean) => {
            if (wipe) {
                for (const storageAddress of vault.addresses) {
                    await host.sendMessage({
                        id: "editStorageAddresses",
                        vaultId,
                        action: {
                            id: "remove",
                            wipe: true,
                            storageAddress,
                        },
                    })
                }
            }
            await host.sendMessage({
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
            await host.sendMessage({
                id: "setVaultAsDefault",
                vaultId,
            })
        },
        [],
        vaultAction
    )

    const [removeVaultDialog, openRemoveVaultDialog] = useModalDialog(
        ({ close, initialFocusRef }) => (
            <>
                <ModalDialog.Body>
                    <ModalDialog.Icon
                        icon={ExclamationTriangleIcon}
                        className="bg-red-100 text-red-600"
                    />
                    <div>
                        <ModalDialog.Title>Remove vault</ModalDialog.Title>
                        <p>
                            Are you sure you want to remove this vault? You will
                            no longer be able to access items which were stored
                            here. If you choose to wipe this vault, the data
                            will also be permanently deleted from all storage
                            locations.
                        </p>
                        <ErrorText state={removingVault} />
                    </div>
                </ModalDialog.Body>
                <ModalDialog.Footer>
                    <DangerButton
                        onClick={async () => {
                            await removeVault(true)
                            close()
                        }}
                    >
                        {removingVault.inProgress &&
                            removingVault.lastArgs[0] === true && (
                                <ButtonIcon icon={Loader} />
                            )}
                        <span>Wipe and remove</span>
                    </DangerButton>
                    <DangerButton
                        onClick={async () => {
                            await removeVault(false)
                            close()
                        }}
                    >
                        {removingVault.inProgress &&
                            removingVault.lastArgs[0] === false && (
                                <ButtonIcon icon={Loader} />
                            )}
                        <span>Remove only</span>
                    </DangerButton>
                    <OutlineButton ref={initialFocusRef} onClick={close}>
                        Cancel
                    </OutlineButton>
                </ModalDialog.Footer>
            </>
        )
    )

    const [exportingVaultItems, exportVaultItems] =
        usePromiseState(async () => {
            await host.sendMessage({ id: "exportVaultItems", vaultId })
        }, [])
    const [importingVaultItems, importVaultItems] = usePromiseState(
        async (url: string) => {
            await host.sendMessage({ id: "importVaultItems", vaultId, url })
        },
        []
    )
    const pickFileToImport = useCallback(() => {
        openFilePicker(
            {
                accept: ".csv,text/csv,text/comma-separated-values",
            },
            ([url]) => importVaultItems(url)
        )
    }, [])

    return (
        <>
            {removeVaultDialog}
            <dl className="sm:divide-y sm:divide-gray-200">
                <div className="py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6 sm:py-5">
                    <dt className="text-sm font-medium text-gray-500">Name</dt>
                    <dd className="mt-1 flex text-sm text-gray-900 sm:col-span-2 sm:mt-0">
                        <span className="flex-grow">{vault.name}</span>
                        <span className="ml-4 flex-shrink-0">
                            <TextButton
                                type="button"
                                disabled={vault.missing}
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
                    <dt className="text-sm font-medium text-gray-500">
                        Created
                    </dt>
                    <dd className="mt-1 text-sm text-gray-900 sm:col-span-2 sm:mt-0">
                        {vault.missing ? (
                            "-"
                        ) : (
                            <RelativeDate timestamp={vault.creationTimestamp} />
                        )}
                    </dd>
                </div>
                <div className="py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6 sm:py-5">
                    <dt className="text-sm font-medium text-gray-500">
                        Updated
                    </dt>
                    <dd className="mt-1 text-sm text-gray-900 sm:col-span-2 sm:mt-0">
                        {vault.missing ? (
                            "-"
                        ) : (
                            <RelativeDate timestamp={vault.updateTimestamp} />
                        )}
                    </dd>
                </div>
                <div className="py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6 sm:py-5">
                    <dt className="text-sm font-medium text-gray-500">
                        Actions
                    </dt>
                    <dd className="mt-1 text-sm text-gray-900 sm:col-span-2 sm:mt-0">
                        <OutlineButton onClick={openRemoveVaultDialog}>
                            Remove Vault
                        </OutlineButton>
                    </dd>
                </div>
                <div className="py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6 sm:py-5">
                    <dt className="text-sm font-medium text-gray-500">
                        Export
                    </dt>
                    <dd className="mt-1 text-sm text-gray-900 sm:col-span-2 sm:mt-0">
                        <div className="flex flex-wrap gap-3">
                            <OutlineButton
                                onClick={exportVaultItems}
                                disabled={exportingVaultItems.inProgress}
                            >
                                <ButtonIcon
                                    icon={
                                        exportingVaultItems.inProgress
                                            ? Loader
                                            : ArrowDownTrayIcon
                                    }
                                />
                                Export Items
                            </OutlineButton>
                            <OutlineButton
                                onClick={pickFileToImport}
                                disabled={importingVaultItems.inProgress}
                            >
                                <ButtonIcon
                                    icon={
                                        importingVaultItems.inProgress
                                            ? Loader
                                            : ArrowUpTrayIcon
                                    }
                                />
                                Import Items
                            </OutlineButton>
                        </div>
                    </dd>
                </div>
            </dl>
        </>
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
                    <span>Vault: </span>
                    {vault.missing ? (
                        <span className="text-red-700">Missing</span>
                    ) : (
                        <span>{vault.name}</span>
                    )}
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
