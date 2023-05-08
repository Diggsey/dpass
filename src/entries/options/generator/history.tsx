import { Fragment, useMemo } from "react"
import { PasswordStrengthLabel } from "~/entries/shared/components/passwordStrengthLabel"
import { RelativeDate } from "~/entries/shared/components/relativeDate"
import { Card, TextButton } from "~/entries/shared/components/styledElem"
import { GeneratedValue } from "~/entries/shared/privileged/state"
import { DAY, endOfDayView } from "~/entries/shared/time"
import { useTime } from "~/entries/shared/ui/hooks"

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

function classifyValue(generatedValue: GeneratedValue, eod: number): number {
    const offset = eod - generatedValue.creationTimestamp
    return DATE_THRESHOLDS.findIndex((t) => offset <= t.offset)
}

type HistoryValueProps = {
    value: GeneratedValue
}

export const HistoryValue = ({ value }: HistoryValueProps) => {
    return (
        <tr>
            <td className="relative py-5 pr-6">
                <div className="flex items-start gap-x-3">
                    <div className="text-sm font-medium leading-6 text-gray-900">
                        ********
                    </div>
                    <PasswordStrengthLabel entropy={value.entropy} />
                </div>
                <div className="absolute bottom-0 right-full h-px w-screen bg-gray-100" />
                <div className="absolute bottom-0 left-0 h-px w-screen bg-gray-100" />
            </td>
            <td className="hidden py-5 pr-6 sm:table-cell">
                <div className="text-sm leading-6 text-gray-900">
                    <RelativeDate timestamp={value.creationTimestamp} />
                </div>
            </td>
            <td className="py-5 text-right">
                <div className="flex justify-end">
                    <TextButton>Create item</TextButton>
                </div>
            </td>
        </tr>
    )
}

type HistoryPanelProps = {
    generatedValues: readonly GeneratedValue[]
}

export const HistoryPanel = ({ generatedValues }: HistoryPanelProps) => {
    const eod = useTime(endOfDayView)
    const groupedValues = useMemo(() => {
        const groups = new Map<number, GeneratedValue[]>()
        for (const value of generatedValues) {
            const groupKey = classifyValue(value, eod)
            let group = groups.get(groupKey)
            if (group === undefined) {
                group = []
                groups.set(groupKey, group)
            }
            group.push(value)
        }
        return [...groups.entries()]
    }, [eod, generatedValues])
    return (
        <Card>
            <Card.Header>
                <h2 className="mx-auto max-w-2xl text-base font-semibold leading-6 text-gray-900 lg:mx-0 lg:max-w-none">
                    History
                </h2>
            </Card.Header>
            <div className="mt-6 overflow-hidden border-t border-gray-100">
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
