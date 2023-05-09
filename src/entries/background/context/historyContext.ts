import { mixin } from "~/entries/shared/mixin"
import { Actor } from "../actor"
import {
    MergeableItem,
    chainPatches,
    extractItems,
    itemCreator,
    itemPatcher,
} from "../serialize/merge"
import { IRootContext, UpdateRootHint } from "./rootContext"
import { DAY, SECOND } from "~/entries/shared/time"
import { HistoryEntry, RootFileItem } from "../serialize/rootData"

export interface IHistoryContext {
    _recordHistory(
        historyEntries: HistoryEntry[],
        hint?: UpdateRootHint
    ): Promise<void>
    _clearHistory(): Promise<void>
}

// Publishes changes to the context
export const HistoryContext = mixin<IHistoryContext, Actor & IRootContext>(
    (Base) =>
        class HistoryContext extends Base implements IHistoryContext {
            async _recordHistory(
                historyEntries: HistoryEntry[],
                hint?: UpdateRootHint
            ): Promise<void> {
                const now = Date.now()
                const cutOff = now - 7 * DAY
                const mergeCutoff = now - 10 * SECOND

                await this._patchRoot(
                    chainPatches(
                        // Add the new history entries only if we haven't recently added
                        // an entry for the same item
                        (root) => {
                            const recentEntries = extractItems(
                                root,
                                (item): item is MergeableItem<HistoryEntry> =>
                                    item.updateTimestamp >= mergeCutoff &&
                                    item.payload.id === "historyEntry" &&
                                    item.payload.type !== "generated"
                            )
                            for (const historyEntry of historyEntries) {
                                if (
                                    recentEntries.find(
                                        (e) =>
                                            e.payload.type ===
                                                historyEntry.type &&
                                            e.payload.name === historyEntry.name
                                    )
                                ) {
                                    continue
                                }
                                root = itemCreator<RootFileItem, HistoryEntry>(
                                    historyEntry
                                )(root)
                            }
                            return root
                        },
                        // Delete any expired history items
                        itemPatcher((payload, _id, updateTimestamp) => {
                            if (
                                payload?.id === "historyEntry" &&
                                updateTimestamp < cutOff
                            ) {
                                return null
                            } else {
                                return payload
                            }
                        })
                    ),
                    hint
                )
            }
            async _clearHistory(): Promise<void> {
                await this._patchRoot(
                    itemPatcher((payload) =>
                        payload?.id === "historyEntry" ? null : payload
                    )
                )
            }
        }
)
