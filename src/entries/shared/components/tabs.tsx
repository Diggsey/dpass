import { FC, ReactNode, useEffect, ReactElement, Key } from "react"
import { ClassName, cn, useLocalState } from "../ui"

type TabsProps = {
    className?: ClassName
    storageKey: string
    children: ReactElement<TabProps, typeof Tab>[]
}

type TabProps = {
    title: ReactNode
    isDisabled?: boolean
    children?: ReactNode
}

export const Tabs: FC<TabsProps> = ({ className, storageKey, children }) => {
    const [activeTabKey, setActiveTabKey] = useLocalState<Key | null>(
        storageKey,
        null
    )
    const tabs = children
    const activeTab =
        tabs.find((tab, i) => {
            return !tab.props.isDisabled && (tab.key ?? i) === activeTabKey
        }) ?? tabs.find((tab) => !tab.props.isDisabled)
    const effectiveTabKey = activeTab
        ? activeTab.key ?? tabs.indexOf(activeTab)
        : null

    useEffect(() => {
        if (activeTabKey !== effectiveTabKey) {
            setActiveTabKey(effectiveTabKey)
        }
    }, [activeTabKey, effectiveTabKey])

    const renderTitle = (
        tab: ReactElement<TabProps, typeof Tab>,
        i: number
    ) => {
        const tabClass = cn({
            isActive: tab === activeTab,
            isDisabled: tab.props.isDisabled,
        })
        return (
            <li key={tab.key} className={tabClass}>
                <a
                    onClick={() =>
                        !tab.props.isDisabled && setActiveTabKey(tab.key ?? i)
                    }
                >
                    {tab.props.title}
                </a>
            </li>
        )
    }

    return (
        <>
            <div className={cn("tabs", className)}>
                <ul>{tabs.map(renderTitle)}</ul>
            </div>
            {activeTab ? activeTab.props.children : null}
        </>
    )
}

export const Tab: FC<TabProps> = () => {
    throw new Error("Must be used in a `Tabs` component")
}
