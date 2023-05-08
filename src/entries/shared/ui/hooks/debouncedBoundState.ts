import { useCallback, useState } from "react"
import { SharedPromiseState, usePromiseState } from "./promiseState"
import useDebouncedEffect from "./debouncedEffect"

type NonFunction = undefined | null | boolean | number | string | object

type DebouncedBoundState<S> = {
    state: S
    setState: (newState: S) => void
    inFlightChanges: boolean
}

function useDebouncedBoundState<S extends NonFunction>(
    baseState: S | (() => S),
    stateSaver: (state: S) => Promise<void>,
    stateSaverInputs: React.DependencyList,
    debounce = 100,
    parent?: SharedPromiseState
): DebouncedBoundState<S> {
    const [editedState, setEditedState] = useState<S | null>(null)
    const [hasUnsaved, setHasUnsaved] = useState(false)

    // If the state has been ocally modified, use that. Otherwise
    // get the state from the source.
    const state =
        editedState ??
        (typeof baseState === "function" ? baseState() : baseState)

    // When we begin saving the state, we immediately mark it as
    // "saved", so that if saving fails, it will be reverted.
    const [savingChanges, saveChanges] = usePromiseState(
        async (newState: S) => {
            setHasUnsaved(false)
            await stateSaver(newState)
        },
        stateSaverInputs,
        parent
    )
    // Whether we have unsaved changes, or are in the process of
    // saving them
    const inFlightChanges = hasUnsaved || savingChanges.inProgress

    // Whenever the edited state changes and has not been saved,
    // and we are not already saving state, then we want to try
    // saving the new state on a debounce.
    useDebouncedEffect(
        () => {
            if (
                !savingChanges.inProgress &&
                editedState !== null &&
                hasUnsaved
            ) {
                void saveChanges(editedState)
            }
        },
        debounce,
        [savingChanges.inProgress, editedState, hasUnsaved, saveChanges]
    )

    // If we have nothing in-flight, but the edited state is
    // still set, then clear it on a debounce.
    useDebouncedEffect(
        () => {
            if (!inFlightChanges && editedState !== null) {
                setEditedState(null)
            }
        },
        debounce,
        [inFlightChanges, editedState !== null]
    )

    const setState = useCallback((newState: S) => {
        setEditedState(newState)
        setHasUnsaved(true)
    }, [])

    return {
        state,
        setState,
        inFlightChanges,
    }
}

export default useDebouncedBoundState
