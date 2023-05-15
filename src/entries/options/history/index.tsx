import { TrashIcon } from "@heroicons/react/24/outline"
import { FC, Fragment, useCallback, useMemo } from "react"
import { ButtonIcon } from "~/entries/shared/components/buttonIcon"
import { Loader } from "~/entries/shared/components/icons/loader"
import { MagicVScroll } from "~/entries/shared/components/magicVScroll"
import { PasswordStrengthLabel } from "~/entries/shared/components/passwordStrengthLabel"
import { RelativeDate } from "~/entries/shared/components/relativeDate"
import {
    Card,
    DangerButton,
    TextButton,
} from "~/entries/shared/components/styledElem"
import host from "~/entries/shared/host"
import {
    HistoryEntry,
    PrivilegedState,
} from "~/entries/shared/privileged/state"
import { DAY, endOfDayView } from "~/entries/shared/time"
import { usePromiseState, useTime } from "~/entries/shared/ui/hooks"

const DATE_THRESHOLDS = [
    {
        offset: DAY,
        title: "Today",
    },
    {
        offset: 2 * DAY,
        title: "Yesterday",
    },
    {
        offset: 7 * DAY,
        title: "In the last week",
    },
    {
        offset: Infinity,
        title: "Earlier",
    },
]

function classifyValue(generatedValue: HistoryEntry, eod: number): number {
    const offset = eod - generatedValue.creationTimestamp
    return DATE_THRESHOLDS.findIndex((t) => offset <= t.offset)
}

type HistoryValueProps = {
    value: HistoryEntry
}

export const HistoryValue = ({ value }: HistoryValueProps) => {
    const createItem = useCallback(async () => {
        const itemId = await host.sendMessage({
            id: "createVaultItem",
            details: {
                origins: value.origins,
                name: new Date(value.creationTimestamp).toString(),
                encrypted: false,
                payload: {
                    fields: [
                        {
                            uuid: crypto.randomUUID(),
                            name: value.name,
                            autofillMode: value.autofillMode,
                            value: value.value,
                        },
                    ],
                },
            },
        })
        if (itemId) {
            await host.sendMessage({
                id: "openOptionsPage",
                target: {
                    id: "item",
                    itemId,
                },
            })
        }
    }, [value.value])
    const copy = useCallback(async () => {
        await navigator.clipboard.writeText(value.value)
    }, [value.value])

    let prefix
    switch (value.type) {
        case "generated":
            prefix = "Generated"
            break
        case "deleted":
            prefix = "Deleted"
            break
        case "changed":
            prefix = "Changed"
            break
    }

    return (
        <tr>
            <td className="relative py-5 pr-6">
                <div className="flex-auto">
                    <div className="flex items-start gap-x-3">
                        <div className="text-sm font-medium leading-6 text-gray-900">
                            {prefix} {value.name}
                        </div>
                        {value.entropy !== undefined && (
                            <PasswordStrengthLabel entropy={value.entropy} />
                        )}
                    </div>
                    <div className="mt-1 text-xs leading-5 text-gray-500">
                        {value.origins.map((origin, i) => (
                            <p key={i}>{origin}</p>
                        ))}
                    </div>
                </div>
                <div className="absolute bottom-0 right-full h-px w-screen bg-gray-100" />
                <div className="absolute bottom-0 left-0 h-px w-screen bg-gray-100" />
            </td>
            <td className="hidden py-5 pr-6 sm:table-cell">
                <div className="text-sm leading-6 text-gray-900">
                    <RelativeDate timestamp={value.creationTimestamp} />
                </div>
                <div className="mt-1 text-xs leading-5 text-gray-500 text-ellipsis overflow-hidden max-w-[100px] whitespace-nowrap">
                    {["password", "passwordNode"].includes(
                        value.autofillMode.id
                    )
                        ? "******"
                        : value.value}
                </div>
            </td>
            <td className="py-5 text-right">
                <div className="flex justify-end gap-3">
                    <TextButton onClick={copy}>Copy</TextButton>
                    <TextButton onClick={createItem}>Create item</TextButton>
                </div>
            </td>
        </tr>
    )
}

type HistoryPanelProps = {
    historyEntries: readonly HistoryEntry[]
}

const HistoryPanel = ({ historyEntries }: HistoryPanelProps) => {
    const eod = useTime(endOfDayView)
    const groupedValues = useMemo(() => {
        const groups = new Map<number, HistoryEntry[]>()
        for (const value of historyEntries) {
            const groupKey = classifyValue(value, eod)
            let group = groups.get(groupKey)
            if (group === undefined) {
                group = []
                groups.set(groupKey, group)
            }
            group.push(value)
        }
        return [...groups.entries()]
    }, [eod, historyEntries])
    const [clearingHistory, clearHistory] = usePromiseState(async () => {
        await host.sendMessage({ id: "clearHistory" })
    }, [])
    return (
        <Card>
            <Card.Header>
                <div className="flex justify-between">
                    <h2 className="mx-auto max-w-2xl text-base font-semibold leading-6 text-gray-900 lg:mx-0 lg:max-w-none">
                        History
                    </h2>
                    <DangerButton
                        onClick={clearHistory}
                        disabled={
                            clearingHistory.inProgress ||
                            historyEntries.length === 0
                        }
                    >
                        <ButtonIcon
                            icon={
                                clearingHistory.inProgress ? Loader : TrashIcon
                            }
                        />
                        <span>Clear</span>
                    </DangerButton>
                </div>
            </Card.Header>
            <div className="overflow-hidden border-t border-gray-100">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="mx-auto max-w-2xl lg:mx-0 lg:max-w-none">
                        <table className="w-full text-left">
                            <thead className="sr-only">
                                <tr>
                                    <th>Amount</th>
                                    <th className="hidden sm:table-cell">
                                        Client
                                    </th>
                                    <th>More details</th>
                                </tr>
                            </thead>
                            <tbody>
                                {groupedValues.map(([groupIndex, group]) => (
                                    <Fragment key={groupIndex}>
                                        <tr className="text-sm leading-6 text-gray-900">
                                            <th
                                                scope="colgroup"
                                                colSpan={3}
                                                className="relative isolate py-2 font-semibold"
                                            >
                                                {
                                                    DATE_THRESHOLDS[groupIndex]
                                                        .title
                                                }
                                                <div className="absolute inset-y-0 right-full -z-10 w-screen border-b border-gray-200 bg-gray-50" />
                                                <div className="absolute inset-y-0 left-0 -z-10 w-screen border-b border-gray-200 bg-gray-50" />
                                            </th>
                                        </tr>
                                        {group.map((value) => (
                                            <HistoryValue
                                                key={value.uuid}
                                                value={value}
                                            />
                                        ))}
                                    </Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </Card>
    )
}

export const HistoryPage: FC<{ state: PrivilegedState }> = ({ state }) => {
    const settings = state.generatorSettings
    if (!settings) {
        return <Loader />
    }
    return (
        <MagicVScroll>
            <div className="container grid mx-auto max-w-7xl sm:px-6 lg:px-8 py-10 gap-10 auto-rows-max">
                <HistoryPanel historyEntries={state.historyEntries} />
            </div>
        </MagicVScroll>
    )
}
