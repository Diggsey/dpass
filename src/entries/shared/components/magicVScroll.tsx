import { ReactNode } from "react"
import { ClassName, cn } from "../ui"
import { useElementSize } from "../ui/hooks"

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
    return (
        <div
            ref={sizeRef}
            className={cn("overflow-y-auto overflow-x-hidden", className)}
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
