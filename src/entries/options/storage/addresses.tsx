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
    usePromiseState,
    useSharedPromiseState,
} from "~/entries/shared/ui/hooks"
import {
    ReorderableItem,
    ReorderableList,
} from "~/entries/shared/components/reorderableList"
import { StorageAddressEditor } from "./editor"
import { STORAGE_PROVIDERS, STORAGE_PROVIDER_MAP } from "."
import { Loader } from "~/entries/shared/components/loader"

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
        console.log("closed")
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
        async () => {
            if (!editingAddress) {
                return
            }
            await sendMessage({
                id: "editStorageAddresses",
                vaultId,
                action: {
                    id: "remove",
                    storageAddress: editingAddress.address,
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

    return (
        <div className="divide-y divide-gray-200 overflow-hidden sm:rounded-lg bg-white shadow">
            <div className="px-4 py-5 sm:px-6">
                <div className="-ml-4 -mt-2 flex flex-wrap items-center justify-between sm:flex-nowrap">
                    <div className="ml-4 mt-2">
                        <h3 className="text-base font-semibold leading-6 text-gray-900">
                            Where is my{" "}
                            <span className="text-indigo-600 cursor-default">
                                {name}
                            </span>{" "}
                            stored?
                        </h3>
                    </div>
                    <div className="ml-4 mt-2 flex-shrink-0">
                        {editingExisting ? (
                            <button
                                type="button"
                                className="relative inline-flex items-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-600 hover:bg-gray-50 disabled:bg-white disabled:text-gray-600 disabled:ring-gray-300"
                                onClick={deleteAddress}
                                disabled={sharedPromiseState.inProgress}
                            >
                                {deletingAddress.inProgress ? (
                                    <Loader
                                        className="-ml-0.5 mr-1.5 h-5 w-5 text-gray-400"
                                        aria-hidden="true"
                                    />
                                ) : (
                                    <TrashIcon
                                        className="-ml-0.5 mr-1.5 h-5 w-5 text-gray-400"
                                        aria-hidden="true"
                                    />
                                )}
                                <span>Delete storage</span>
                            </button>
                        ) : (
                            <button
                                type="button"
                                className="relative inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:bg-indigo-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                                onClick={addStorage}
                                disabled={
                                    !!editingAddress ||
                                    sharedPromiseState.inProgress
                                }
                            >
                                <PlusIcon
                                    className="-ml-0.5 mr-1.5 h-5 w-5"
                                    aria-hidden="true"
                                />
                                <span>Add storage</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>

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
        </div>
    )
}
