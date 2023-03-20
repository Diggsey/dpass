import { ReactNode, useState, useContext, createContext, Ref } from "react"
import { cn } from "../ui"
import { useElementSize } from "../ui/hooks"

type SlideProps = {
    open: boolean
    onTransitionEnd?: (open: boolean) => void
    children: ReactNode
}

type SlideContextType = {
    open: boolean
    transitioning: boolean
    sizeRef: Ref<HTMLDivElement>
}

const SlideContext = createContext<SlideContextType>({
    open: false,
    transitioning: false,
    sizeRef: () => {},
})

export const Slide = ({ children, open, onTransitionEnd }: SlideProps) => {
    const [wasOpen, setWasOpen] = useState(open)
    const [sizeRef, { height }] = useElementSize()
    const transitioning = wasOpen != open
    return (
        <div
            tabIndex={-1}
            className="overflow-hidden transition-[height]"
            onScrollCapture={(e) => {
                e.currentTarget.scrollLeft = 0
            }}
            style={height !== null ? { height: `${height}px` } : undefined}
        >
            <div
                className={cn(
                    "flex flex-row items-start w-[200%] relative transition-[left]",
                    open ? "-left-full" : "left-0"
                )}
                onTransitionEnd={() => {
                    setWasOpen(open)
                    if (onTransitionEnd) {
                        onTransitionEnd(open)
                    }
                }}
            >
                <SlideContext.Provider value={{ open, transitioning, sizeRef }}>
                    {children}
                </SlideContext.Provider>
            </div>
        </div>
    )
}

type SlideSideProps = {
    children: ReactNode
}

Slide.Left = ({ children }: SlideSideProps) => {
    const { open, transitioning, sizeRef } = useContext(SlideContext)
    return (
        <div className="flex-[0.5]" ref={open ? null : sizeRef}>
            {!open || transitioning ? children : null}
        </div>
    )
}

Slide.Right = ({ children }: SlideSideProps) => {
    const { open, transitioning, sizeRef } = useContext(SlideContext)
    return (
        <div className="flex-[0.5]" ref={open ? sizeRef : null}>
            {open || transitioning ? children : null}
        </div>
    )
}
