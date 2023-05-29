import { ReactNode, useCallback, useState, useEffect } from "react"
import { ClassName, cn } from "../ui"
import { useElementSize } from "../ui/hooks"
import host from "../host"

type MagicVScrollProps = {
    className?: ClassName
    pageClass?: ClassName
    children?: ReactNode
}

export const MagicVScroll = ({
    className,
    pageClass,
    children,
}: MagicVScrollProps) => {
    const [sizeRef, size] = useElementSize()
    const [canScrollUp, setCanScrollUp] = useState(false)
    const onScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
        setCanScrollUp(event.currentTarget.scrollTop > 0)
    }, [])

    useEffect(() => {
        if (canScrollUp) {
            return host.blockRefresh()
        } else {
            return undefined
        }
    }, [canScrollUp])

    return (
        <div
            ref={sizeRef}
            className={cn("overflow-y-auto overflow-x-hidden", className)}
            onScroll={onScroll}
        >
            <div
                style={{ width: size.width ?? "" }}
                className={cn("max-w-full sm:max-w-none", pageClass)}
            >
                {children}
            </div>
        </div>
    )
}
