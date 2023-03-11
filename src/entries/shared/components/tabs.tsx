import {
    ComponentChildren,
    FunctionComponent,
    toChildArray,
    VNode,
} from "preact"
import { useEffect, useState } from "preact/hooks"
import { ClassName, cn } from "../ui"

type TabsProps = {
    class?: ClassName
}

type TabProps = {
    title: ComponentChildren
    isDisabled?: boolean
}

export const Tabs: FunctionComponent<TabsProps> = ({
    class: className,
    children,
}) => {
    const [activeTabKey, setActiveTabKey] = useState(null)
    const tabs = toChildArray(children).map((child) => {
        if (typeof child !== "object" || child.type !== Tab)
            throw new Error("Child of `Tabs` component must be a `Tab`")
        return child as VNode<TabProps>
    })
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

    const renderTitle = (tab: VNode<TabProps>, i: number) => {
        const tabClass = cn({
            isActive: tab === activeTab,
            isDisabled: tab.props.isDisabled,
        })
        return (
            <li key={tab.key} class={tabClass}>
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
            <div class={cn("tabs", className)}>
                <ul>{tabs.map(renderTitle)}</ul>
            </div>
            {activeTab ? activeTab.props.children : null}
        </>
    )
}

export const Tab: FunctionComponent<TabProps> = () => {
    throw new Error("Must be used in a `Tabs` component")
}
