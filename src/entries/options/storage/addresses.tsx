import { FC, MouseEventHandler, ReactNode, useCallback, useState } from "react"
import { objectKey } from "~/entries/shared"
import { sendMessage } from "~/entries/shared/messages"
import { Status } from "~/entries/shared/components/status"
import {
    PrivilegedSyncState,
    StorageAddress,
} from "~/entries/shared/privileged/state"
import { Slide } from "~/entries/shared/components/slide"
import {
    ArrowsUpDownIcon,
    ChevronRightIcon,
    ExclamationTriangleIcon,
    PlusIcon,
    TrashIcon,
} from "@heroicons/react/24/outline"
import {
    useEventCallback,
    useModalDialog,
    usePromiseState,
    useSharedPromiseState,
} from "~/entries/shared/ui/hooks"
import {
    ReorderableItem,
    ReorderableList,
} from "~/entries/shared/components/reorderableList"
import { StorageAddressEditor } from "./editor"
import { STORAGE_PROVIDERS, STORAGE_PROVIDER_MAP } from "."
import { Loader } from "~/entries/shared/components/icons/loader"
import {
    Card,
    PrimaryButton,
    OutlineButton,
    DangerButton,
} from "~/entries/shared/components/styledElem"
import { ButtonIcon } from "~/entries/shared/components/buttonIcon"
import { ModalDialog } from "~/entries/shared/components/modalDialog"
import { ErrorText } from "~/entries/shared/components/errorText"

type StorageAddressRowProps = {
    index: number
    address: StorageAddress
    syncStates: PrivilegedSyncState
    onClick: MouseEventHandler
    disabled?: boolean
}

export const StorageAddressRow: FC<StorageAddressRowProps> = ({
    index,
    address,
    syncStates,
    onClick,
    disabled,
}) => {
    const storageProvider = STORAGE_PROVIDER_MAP[address.id]
    const storageKey = objectKey(address)
    const syncState = syncStates[storageKey] ?? { address, inProgress: true }
    let status: ReactNode = null
    if (syncState.inProgress) {
        status = <Status level="loading">Syncing...</Status>
    } else if (syncState.lastError) {
        status = <Status level="danger">{syncState.lastError}</Status>
    } else if (syncState.lastWarning) {
        status = <Status level="warning">{syncState.lastWarning}</Status>
    } else {
        status = <Status level="success">Synced</Status>
    }

    return (
        <ReorderableItem index={index}>
            {(dragHandleProps) => (
                <button
                    onClick={onClick}
                    className="flex items-center p-4 sm:px-6 bg-white hover:bg-gray-50 -outline-offset-4 w-full text-left gap-4"
                    disabled={disabled}
                >
                    <img
                        className="h-12 w-12"
                        src={storageProvider.icon}
                        alt=""
                    />
                    <div className="flex flex-col items-start flex-1">
                        <p className="truncate text-sm font-medium text-indigo-600">
                            {storageProvider.name}
                        </p>
                        <p
                            className="mt-2 p-1 flex items-center text-sm text-gray-500 hover:bg-gray-200"
                            onClick={(e) => e.stopPropagation()}
                            {...dragHandleProps}
                        >
                            <ArrowsUpDownIcon className="h-4 w-4 mr-1" />
                            <span>Reorder</span>
                        </p>
                    </div>
                    <div className="hidden md:block flex-1">
                        {/* <p className="text-sm text-gray-900">Applied on</p> */}
                        <p className="mt-2 flex items-center text-sm text-gray-500">
                            {status}
                        </p>
                    </div>
                    <div>
                        <ChevronRightIcon
                            className="h-5 w-5 text-gray-400"
                            aria-hidden="true"
                        />
                    </div>
                </button>
            )}
        </ReorderableItem>
    )
}

type StorageAddressesProps = {
    name: string
    vaultId: string | null
    addresses: StorageAddress[]
    syncState: PrivilegedSyncState
    isSetUp: boolean
}

type EditingAddressMode = {
    isNew: boolean
    address: StorageAddress
    isClosing: boolean
}

export const StorageAddresses: FC<StorageAddressesProps> = ({
    name,
    vaultId,
    addresses,
    syncState,
    isSetUp,
}) => {
    const [editingAddress, setEditingAddress] =
        useState<EditingAddressMode | null>(null)
    const [overrideAddresses, setOverrideAddresses] = useState<
        StorageAddress[] | null
    >(null)
    const effectiveAddresses = overrideAddresses ?? addresses

    const sharedPromiseState = useSharedPromiseState({
        inProgress: editingAddress?.isClosing,
    })
    const [_reorderingAddresses, reorderAddresses] = usePromiseState(
        useEventCallback(async (sourceIndex: number, destIndex: number) => {
            const newAddresses = [...addresses]
            const [movedAddress] = newAddresses.splice(sourceIndex, 1)
            newAddresses.splice(destIndex, 0, movedAddress)
            try {
                setOverrideAddresses(newAddresses)
                await sendMessage({
                    id: "editStorageAddresses",
                    vaultId,
                    action: {
                        id: "move",
                        storageAddress: effectiveAddresses[sourceIndex],
                        priority: destIndex,
                    },
                })
            } finally {
                setTimeout(() => setOverrideAddresses(null), 10)
            }
        }),
        [],
        sharedPromiseState
    )
    const close = useCallback(() => {
        setEditingAddress((a) => a && { ...a, isClosing: true })
    }, [])
    const closed = useCallback(() => {
        setEditingAddress((a) => (a?.isClosing ? null : a))
    }, [])
    const addStorage = useCallback(() => {
        const defaultProvider = STORAGE_PROVIDERS[0]
        setEditingAddress({
            address: defaultProvider.initial,
            isNew: true,
            isClosing: false,
        })
    }, [])
    const [deletingAddress, deleteAddress] = usePromiseState(
        async (wipe: boolean) => {
            if (!editingAddress) {
                return
            }
            await sendMessage({
                id: "editStorageAddresses",
                vaultId,
                action: {
                    id: "remove",
                    storageAddress: editingAddress.address,
                    wipe,
                },
            })
            close()
        },
        [editingAddress],
        sharedPromiseState
    )
    const editingExisting = editingAddress?.isNew === false
    const storageAddressWarning = effectiveAddresses.length === 0 && (
        <div className="border-l-4 border-yellow-400 bg-yellow-50 p-4 flex">
            <ExclamationTriangleIcon
                className="h-5 w-5 text-yellow-400 shrink-0"
                aria-hidden="true"
            />
            <p className="text-sm text-yellow-700 ml-3">
                There is nowhere to store your {name}. To resolve this,{" "}
                <a
                    onClick={addStorage}
                    className="font-medium text-yellow-700 underline hover:text-yellow-600 cursor-pointer"
                >
                    add storage
                </a>
                .
            </p>
        </div>
    )

    const [deleteAddressDialog, openDeleteAddressDialog] = useModalDialog(
        ({ close, initialFocusRef }) => (
            <>
                <ModalDialog.Body>
                    <ModalDialog.Icon
                        icon={ExclamationTriangleIcon}
                        className="bg-red-100 text-red-600"
                    />
                    <div>
                        <ModalDialog.Title>Remove storage</ModalDialog.Title>
                        <p>
                            Are you sure you want to remove this storage? Data
                            will no longer be saved to this location. If you
                            choose to wipe this storage, the data will also be
                            permanently deleted from this location.
                        </p>
                        <ErrorText state={deletingAddress} />
                    </div>
                </ModalDialog.Body>
                <ModalDialog.Footer>
                    <DangerButton
                        onClick={async () => {
                            await deleteAddress(true)
                            close()
                        }}
                    >
                        {deletingAddress.inProgress &&
                            deletingAddress.lastArgs[0] === true && (
                                <ButtonIcon icon={Loader} />
                            )}
                        <span>Wipe and remove</span>
                    </DangerButton>
                    <DangerButton
                        onClick={async () => {
                            await deleteAddress(false)
                            close()
                        }}
                    >
                        {deletingAddress.inProgress &&
                            deletingAddress.lastArgs[0] === false && (
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

    return (
        <>
            {deleteAddressDialog}
            <Card>
                <Card.Header>
                    <div className="flex flex-wrap items-center justify-between sm:flex-nowrap">
                        <h3 className="text-base font-semibold leading-6 text-gray-900">
                            Where is my{" "}
                            <span className="text-indigo-600 cursor-default">
                                {name}
                            </span>{" "}
                            stored?
                        </h3>
                        <div className="flex-shrink-0">
                            {editingExisting ? (
                                <OutlineButton
                                    type="button"
                                    onClick={openDeleteAddressDialog}
                                    disabled={
                                        sharedPromiseState.inProgress ||
                                        (addresses.length <= 1 && isSetUp)
                                    }
                                >
                                    <ButtonIcon
                                        icon={
                                            deletingAddress.inProgress
                                                ? Loader
                                                : TrashIcon
                                        }
                                        className="text-gray-400"
                                    />
                                    <span>Delete storage</span>
                                </OutlineButton>
                            ) : (
                                <PrimaryButton
                                    type="button"
                                    onClick={addStorage}
                                    disabled={
                                        !!editingAddress ||
                                        sharedPromiseState.inProgress
                                    }
                                >
                                    <ButtonIcon icon={PlusIcon} />
                                    <span>Add storage</span>
                                </PrimaryButton>
                            )}
                        </div>
                    </div>
                </Card.Header>

                <Slide
                    open={editingAddress?.isClosing === false}
                    onTransitionEnd={closed}
                >
                    <Slide.Left>
                        <ReorderableList
                            onReorder={reorderAddresses}
                            className="divide-y divide-gray-200"
                            disabled={sharedPromiseState.inProgress}
                        >
                            {effectiveAddresses.map((address, i) => (
                                <StorageAddressRow
                                    key={objectKey(address)}
                                    index={i}
                                    address={address}
                                    syncStates={syncState}
                                    onClick={() => {
                                        setEditingAddress({
                                            isNew: false,
                                            address,
                                            isClosing: false,
                                        })
                                    }}
                                    disabled={sharedPromiseState.inProgress}
                                />
                            ))}
                        </ReorderableList>
                        {storageAddressWarning}
                    </Slide.Left>
                    <Slide.Right>
                        {editingAddress && (
                            <StorageAddressEditor
                                isNew={editingAddress.isNew}
                                address={editingAddress.address}
                                vaultId={vaultId}
                                onClose={close}
                                parentState={sharedPromiseState}
                            />
                        )}
                    </Slide.Right>
                </Slide>
            </Card>
        </>
    )
}
