import { FC, MouseEventHandler, ReactNode, useState } from "react"
import { objectKey } from "~/entries/shared"
import { sendMessage } from "~/entries/shared/messages"
import { Status } from "~/entries/shared/components/status"
import {
    PrivilegedSyncState,
    StorageAddress,
} from "~/entries/shared/privileged/state"
import { Slide } from "~/entries/shared/components/slide"
import { ArrowsUpDownIcon, ChevronRightIcon } from "@heroicons/react/24/outline"
import { useEventCallback } from "~/entries/shared/ui/hooks"
import {
    ReorderableItem,
    ReorderableList,
} from "~/entries/shared/components/reorderableList"
import { StorageAddressEditor } from "./editor"

function storageAddressName(address: StorageAddress): string {
    switch (address.id) {
        case "local":
            return "Local Storage"
        case "gdrive":
            return "Google Drive"
    }
}

function storageAddressIcon(address: StorageAddress): string {
    switch (address.id) {
        case "local":
            return "/assets/images/localstorage.svg"
        case "gdrive":
            return "/assets/images/gdrive.png"
    }
}

type StorageAddressRowProps = {
    index: number
    address: StorageAddress
    syncStates: PrivilegedSyncState
    onClick: MouseEventHandler
}

export const StorageAddressRow: FC<StorageAddressRowProps> = ({
    index,
    address,
    syncStates,
    onClick,
}) => {
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
                >
                    <img
                        className="h-12 w-12"
                        src={storageAddressIcon(address)}
                        alt=""
                    />
                    <div className="flex flex-col items-start flex-1">
                        <p className="truncate text-sm font-medium text-indigo-600">
                            {storageAddressName(address)}
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
    vaultId: string | null
    addresses: StorageAddress[]
    syncState: PrivilegedSyncState
}

type EditingAddressMode = {
    isNew: boolean
    address: StorageAddress
}

export const StorageAddresses: FC<StorageAddressesProps> = ({
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
    const storageAddressWarning = effectiveAddresses.length === 0 && (
        <div className="panel-block">
            <Status level="warning">No storage addresses configured</Status>
        </div>
    )
    const onReorder = useEventCallback(
        async (sourceIndex: number, destIndex: number) => {
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
        }
    )
    return (
        <Slide open={editingAddress != null}>
            <Slide.Left>
                <ReorderableList
                    onReorder={onReorder}
                    className="divide-y divide-gray-200"
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
                                })
                            }}
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
                        onClose={() => setEditingAddress(null)}
                    />
                )}
            </Slide.Right>
        </Slide>
    )
}
