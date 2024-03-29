import { mixin } from "~/entries/shared/mixin"
import {
    IStatePublisher,
    PrivilegedState,
    PrivilegedVault,
} from "~/entries/shared/privileged/state"
import { Actor } from "../actor"
import { ISetupKeyContext } from "./setupKeyContext"
import { ISuperKeyContext } from "./superKeyContext"
import { ISyncManagerContext } from "./syncManagerContext"
import { TimerId } from "~/entries/shared"
import { IRootAddressesContext } from "./rootAddressesContext"
import { HistoryEntry, KeyPair, Vault } from "../serialize/rootData"
import {
    DecryptedVaultFile,
    NormalItem,
    VaultInfoItem,
} from "../serialize/vaultData"
import { extractItems, MergeableItem } from "../serialize/merge"
import { IRootContext, ROOT_FILE_ID, UpdateRootHint } from "./rootContext"
import { IVaultContext, MissingVaultError } from "./vaultContext"

export interface IStatePublisherContext {
    get privilegedState(): PrivilegedState
    addStatePublisher(statePublisher: IStatePublisher): void
    removeStatePublisher(statePublisher: IStatePublisher): void
}

// Publishes changes to the context
export const StatePublisherContext = mixin<
    IStatePublisherContext,
    Actor &
        ISetupKeyContext &
        ISuperKeyContext &
        ISyncManagerContext &
        IRootAddressesContext &
        IRootContext &
        IVaultContext
>(
    (Base) =>
        class StatePublisherContext
            extends Base
            implements IStatePublisherContext
        {
            #privilegedState: PrivilegedState = {
                privileged: true,
                hasIdentity: false,
                isSetUp: false,
                isUnlocked: false,
                isSuper: false,
                rootInfo: null,
                generatorSettings: null,
                historyEntries: [],
                rootAddresses: [],
                vaults: {},
                syncState: {},
                keyPairs: {},
                defaultVaultId: null,
            }
            #statePublishers: Set<IStatePublisher> = new Set()
            #statePublishTimer: TimerId | null = null

            _setupKeyChanged(): void {
                super._setupKeyChanged()
                this.#updatePrivilegedState({
                    ...this.#privilegedState,
                    isSetUp: this._setupKey !== null,
                })
            }

            _superKeyChanged(): void {
                super._superKeyChanged()
                this.#updatePrivilegedState({
                    ...this.#privilegedState,
                    isSuper: this._superKey !== null,
                })
            }

            _syncStateChanged(fileId: string) {
                super._syncStateChanged(fileId)
                const syncState = this._getSyncState(fileId)
                if (fileId === ROOT_FILE_ID) {
                    this.#updatePrivilegedState({
                        ...this.#privilegedState,
                        syncState,
                    })
                } else {
                    const vault = this.#privilegedState.vaults[fileId]
                    if (vault) {
                        this.#updatePrivilegedState({
                            ...this.#privilegedState,
                            vaults: {
                                ...this.#privilegedState.vaults,
                                [fileId]: {
                                    ...vault,
                                    syncState,
                                },
                            },
                        })
                    }
                }
            }

            async _rootAddressesChanged(): Promise<void> {
                await super._rootAddressesChanged()
                this.#updatePrivilegedState({
                    ...this.#privilegedState,
                    rootAddresses: this._rootAddresses,
                })
            }

            _rootChanged(hint?: UpdateRootHint): void {
                super._rootChanged(hint)

                // Extract "root info" item
                const rootInfo = this._rootInfo

                // Extract the "generator settings" item
                const generatorSettings = this._generatorSettings

                // Extract "vault" items
                const vaults = this._root
                    ? Object.fromEntries(
                          extractItems(
                              this._root,
                              (item): item is MergeableItem<Vault> =>
                                  item.payload.id === "vault"
                          ).map((vaultItem) => {
                              const vaultId = vaultItem.payload.fileId
                              const vaultState = this._vaults.get(vaultId)
                              if (!vaultState) {
                                  throw new MissingVaultError()
                              }

                              const prevVault =
                                  this.#privilegedState.vaults[vaultId] ||
                                  this.#computePrivilegedVaultState(
                                      vaultState.vault
                                  )
                              return [
                                  vaultId,
                                  {
                                      ...prevVault,
                                      addresses: vaultItem.payload.addresses,
                                      syncState: prevVault?.syncState || {},
                                  },
                              ]
                          })
                      )
                    : {}

                // Extract "key-pair" items
                const keyPairs = this._root
                    ? Object.fromEntries(
                          extractItems(
                              this._root,
                              (item): item is MergeableItem<KeyPair> =>
                                  item.payload.id === "keyPair"
                          ).map((keyPair) => {
                              return [
                                  keyPair.uuid,
                                  {
                                      name: keyPair.payload.name,
                                      creationTimestamp:
                                          keyPair.creationTimestamp,
                                      updateTimestamp: keyPair.updateTimestamp,
                                      publicKey: keyPair.payload.publicKey,
                                  },
                              ]
                          })
                      )
                    : {}

                // Extract recently generated values
                const historyEntries = this._root
                    ? extractItems(
                          this._root,
                          (item): item is MergeableItem<HistoryEntry> =>
                              item.payload.id === "historyEntry"
                      )
                          .map((historyEntry) => ({
                              uuid: historyEntry.uuid,
                              creationTimestamp: historyEntry.creationTimestamp,
                              type: historyEntry.payload.type,
                              origins: historyEntry.payload.origins,
                              autofillMode: historyEntry.payload.autofillMode,
                              name: historyEntry.payload.name,
                              value: historyEntry.payload.value,
                              entropy: historyEntry.payload.entropy,
                          }))
                          .sort(
                              (a, b) =>
                                  b.creationTimestamp - a.creationTimestamp
                          )
                    : []

                this.#updatePrivilegedState({
                    ...this.#privilegedState,
                    isUnlocked: this._root !== null,
                    rootInfo: rootInfo &&
                        this._root && {
                            name: rootInfo.payload.name,
                            secretSentence: rootInfo.payload.secretSentence,
                            creationTimestamp: rootInfo.creationTimestamp,
                            updateTimestamp: Math.max(
                                ...this._root.items.map(
                                    (item) => item.updateTimestamp
                                )
                            ),
                        },
                    generatorSettings: generatorSettings && {
                        passwordLetters:
                            generatorSettings.payload.passwordLetters,
                        passwordDigits:
                            generatorSettings.payload.passwordDigits,
                        passwordSymbols:
                            generatorSettings.payload.passwordSymbols,
                        passwordExtra: generatorSettings.payload.passwordExtra,
                        passwordLength:
                            generatorSettings.payload.passwordLength,
                    },
                    vaults,
                    keyPairs,
                    historyEntries,
                    defaultVaultId: this._defaultVaultId,
                })
            }

            _hasIdentityChanged(): void {
                super._hasIdentityChanged()
                this.#updatePrivilegedState({
                    ...this.#privilegedState,
                    hasIdentity: this._hasIdentity,
                })
            }

            _vaultChanged(vaultId: string): void {
                super._vaultChanged(vaultId)

                const newVault = this._vaults.get(vaultId)?.vault
                const prevVault = this.#privilegedState.vaults[vaultId]
                if (!prevVault || !newVault) {
                    return
                }

                this.#updatePrivilegedState({
                    ...this.#privilegedState,
                    vaults: {
                        ...this.#privilegedState.vaults,
                        [vaultId]: {
                            ...this.#computePrivilegedVaultState(newVault),
                            addresses: prevVault.addresses,
                            syncState: prevVault.syncState,
                        },
                    },
                })
            }

            get privilegedState() {
                return this.#privilegedState
            }

            addStatePublisher(statePublisher: IStatePublisher) {
                this.#statePublishers.add(statePublisher)
                statePublisher.addEventListener("disconnect", () =>
                    this.removeStatePublisher(statePublisher)
                )
                statePublisher.publishPrivileged(this.#privilegedState)
            }

            removeStatePublisher(statePublisher: IStatePublisher) {
                this.#statePublishers.delete(statePublisher)
            }

            #computePrivilegedVaultState(
                vault: DecryptedVaultFile | null
            ): PrivilegedVault {
                if (!vault) {
                    return {
                        creationTimestamp: 0,
                        updateTimestamp: 0,
                        name: "<Unknown>",
                        items: {},
                        addresses: [],
                        syncState: {},
                        missing: true,
                    }
                }

                // Extract "vault info" item
                const vaultInfo = extractItems(
                    vault,
                    (item): item is MergeableItem<VaultInfoItem> =>
                        item.payload.id === "vaultInfo"
                )[0]
                if (!vaultInfo) {
                    throw new Error("Missing vault info")
                }

                // Extract normal items
                const normalItems = extractItems(
                    vault,
                    (item): item is MergeableItem<NormalItem> =>
                        item.payload.id === "normal"
                )

                return {
                    creationTimestamp: vaultInfo.creationTimestamp,
                    updateTimestamp: Math.max(
                        ...vault.items.map((item) => item.updateTimestamp)
                    ),
                    name: vaultInfo.payload.name,
                    items: Object.fromEntries(
                        normalItems.map((normalItem) => [
                            normalItem.uuid,
                            {
                                creationTimestamp: normalItem.creationTimestamp,
                                updateTimestamp: normalItem.updateTimestamp,
                                name: normalItem.payload.name,
                                origins: normalItem.payload.origins,
                                data: normalItem.payload.data.encrypted
                                    ? { encrypted: true }
                                    : {
                                          encrypted: false,
                                          payload:
                                              normalItem.payload.data.payload,
                                      },
                            },
                        ])
                    ),
                    addresses: [],
                    syncState: {},
                    missing: false,
                }
            }

            #updatePrivilegedState(privilegedState: PrivilegedState) {
                this.#privilegedState = privilegedState
                if (this.#statePublishTimer === null) {
                    this.#statePublishTimer = setTimeout(() => {
                        this.#statePublishTimer = null
                        for (const statePublisher of this.#statePublishers) {
                            statePublisher.publishPrivileged(
                                this.#privilegedState
                            )
                        }
                    }, 0)
                }
            }
        }
)
