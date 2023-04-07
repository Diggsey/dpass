import { FC, ReactNode, useCallback, useState } from "react"
import { Status } from "~/entries/shared/components/status"
import {
    PrivilegedState,
    PrivilegedVault,
} from "~/entries/shared/privileged/state"
import { setLocalState, useLocalState } from "~/entries/shared/ui/hooks"
import { Card, FlatButton } from "~/entries/shared/components/styledElem"
import {
    ListBulletIcon,
    WrenchScrewdriverIcon,
} from "@heroicons/react/24/outline"
import { ButtonIcon } from "~/entries/shared/components/buttonIcon"
import { VaultPlusIcon } from "~/entries/shared/components/icons/vaultPlus"
import { Slide } from "~/entries/shared/components/slide"
import { CreateVaultForm } from "./createVault"
import { ManageVault } from "./manageVault"
import { MagicVScroll } from "~/entries/shared/components/magicVScroll"

const VaultPanel: FC<{
    vaultId: string
    vault: PrivilegedVault
    isDefault: boolean
}> = ({ vault, vaultId, isDefault }) => {
    const manageVault = useCallback(() => {
        setLocalState("activeVaultId", vaultId)
    }, [vaultId])
    const viewVaultItems = useCallback(() => {
        setLocalState("activeTab", "items")
        setLocalState("itemSearchTerm", "")
        setLocalState("selectedVaultId", vaultId)
        setLocalState("selectedItemId", null)
    }, [vaultId])
    const numItems = vault.items && Object.keys(vault.items).length
    const description =
        numItems === null
            ? "Not synced"
            : numItems === 1
            ? "1 item"
            : `${numItems} items`
    const syncStates = Object.values(vault.syncState)
    let status: ReactNode = null
    if (syncStates.length === 0) {
        status = <Status level="warning">Not stored</Status>
    } else if (syncStates.some((s) => s.lastError)) {
        status = <Status level="danger">Warning</Status>
    } else if (syncStates.some((s) => s.lastWarning)) {
        status = <Status level="warning">Error</Status>
    } else if (syncStates.some((s) => s.inProgress)) {
        status = <Status level="loading">Syncing...</Status>
    } else {
        status = <Status level="success">Synced</Status>
    }
    return (
        <Card className="h-full">
            <Card.Body className="flex justify-between gap-x-3">
                <div className="flex flex-col items-start gap-1">
                    <div className="flex items-center space-x-3">
                        <h3 className="truncate text-sm font-medium text-gray-900">
                            {vault.name}
                        </h3>
                    </div>
                    <p className="truncate text-sm text-gray-500">
                        {description}
                    </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                    <p className="flex text-sm text-gray-500 ml-auto">
                        {status}
                    </p>
                    {isDefault && (
                        <span className="inline-block flex-shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                            Default
                        </span>
                    )}
                </div>
            </Card.Body>
            <div className="flex divide-x divide-gray-200">
                <FlatButton
                    className="flex-1 sm:rounded-bl-lg"
                    onClick={manageVault}
                >
                    <ButtonIcon icon={WrenchScrewdriverIcon} />
                    <span>Manage vault</span>
                </FlatButton>
                <FlatButton
                    className="flex-1 sm:rounded-br-lg"
                    onClick={viewVaultItems}
                >
                    <ButtonIcon icon={ListBulletIcon} />
                    <span>View items</span>
                </FlatButton>
            </div>
        </Card>
    )
}

export const VaultsPage: FC<{ state: PrivilegedState }> = ({ state }) => {
    const [activeVaultId, setActiveVaultId] = useLocalState<string | null>(
        "activeVaultId",
        null
    )
    const [visibleVaultId, setVisibleVaultId] = useState<string | null>(null)
    // We want the "visible vault" to lag behind the active vault when the active
    // vault is reset to null.
    if (activeVaultId !== visibleVaultId && activeVaultId !== null) {
        setVisibleVaultId(activeVaultId)
    }
    const closeForm = useCallback(() => setActiveVaultId(null), [])

    const allVaults = Object.entries(state.vaults)
    allVaults.sort((a, b) => a[1].name.localeCompare(b[1].name))
    const vaultPanels = allVaults.map(([vaultId, vault]) => (
        <li key={vaultId}>
            <VaultPanel
                key={vaultId}
                vaultId={vaultId}
                vault={vault}
                isDefault={vaultId === state.defaultVaultId}
            />
        </li>
    ))

    let renderedForm = null
    if (visibleVaultId === "<new>") {
        renderedForm = <CreateVaultForm close={closeForm} />
    } else if (visibleVaultId !== null) {
        const vault = state.vaults[visibleVaultId]
        if (vault) {
            renderedForm = (
                <ManageVault
                    vaultId={visibleVaultId}
                    vault={vault}
                    isDefault={visibleVaultId === state.defaultVaultId}
                    close={closeForm}
                />
            )
        } else if (activeVaultId === visibleVaultId) {
            setActiveVaultId(null)
        }
    }

    return (
        <MagicVScroll>
            <Slide
                open={activeVaultId !== null}
                onTransitionEnd={() => setVisibleVaultId(activeVaultId)}
                className="min-h-full"
            >
                <Slide.Left>
                    <div className="container grid mx-auto max-w-7xl sm:px-6 lg:px-8 py-10 auto-rows-max">
                        <ul
                            role="list"
                            className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
                        >
                            {vaultPanels}
                            <li>
                                <button
                                    type="button"
                                    className="relative block w-full h-full rounded-lg border-2 border-dashed border-gray-300 p-12 text-center hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                                    onClick={() => setActiveVaultId("<new>")}
                                >
                                    <VaultPlusIcon className="mx-auto h-12 w-12 text-gray-400" />
                                    <span className="mt-2 block text-sm font-semibold text-gray-900">
                                        Create a new vault
                                    </span>
                                </button>
                            </li>
                        </ul>
                    </div>
                </Slide.Left>
                <Slide.Right>{renderedForm}</Slide.Right>
            </Slide>
        </MagicVScroll>
    )
}
