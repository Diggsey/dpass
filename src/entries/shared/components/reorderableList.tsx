import { ReactNode, useCallback, useId } from "react"
import {
    DragDropContext,
    Draggable,
    DraggableProvidedDragHandleProps,
    Droppable,
    DropResult,
} from "react-beautiful-dnd"

type ReorderableListProps = {
    className?: string
    children?: ReactNode
    onReorder: (sourceIndex: number, destIndex: number) => void
    disabled?: boolean
}

export const ReorderableList = ({
    className,
    children,
    onReorder,
    disabled,
}: ReorderableListProps) => {
    const droppableId = useId()
    const onDragEnd = useCallback(
        (result: DropResult) => {
            if (result.reason !== "DROP" || !result.destination) {
                return
            }
            onReorder(result.source.index, result.destination.index)
        },
        [onReorder]
    )
    return (
        <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId={droppableId} isDropDisabled={disabled}>
                {(provided) => (
                    <ul
                        role="list"
                        className={className}
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                    >
                        {children}
                        {provided.placeholder}
                    </ul>
                )}
            </Droppable>
        </DragDropContext>
    )
}

type ReorderableItemProps = {
    index: number
    className?: string
    children: (
        dragHandleProps: DraggableProvidedDragHandleProps | null | undefined
    ) => ReactNode
}

export const ReorderableItem = ({ index, children }: ReorderableItemProps) => {
    const draggableId = useId()
    return (
        <Draggable
            draggableId={draggableId}
            index={index}
            disableInteractiveElementBlocking={true}
        >
            {(provided) => (
                <li ref={provided.innerRef} {...provided.draggableProps}>
                    {children(provided.dragHandleProps)}
                </li>
            )}
        </Draggable>
    )
}
