import {
    Dispatch,
    SetStateAction,
    useCallback,
    useEffect,
    useState,
} from "react"
import { Json } from "../.."

function useLocalState<T extends Json>(
    key: string,
    defaultValue: T | (() => T)
): [T, Dispatch<SetStateAction<T>>] {
    const parseOrDefault = (stateStr: string | null): T => {
        if (stateStr) {
            try {
                return JSON.parse(stateStr)
            } catch (ex) {
                // Do nothing
            }
        }
        const newState =
            typeof defaultValue === "function" ? defaultValue() : defaultValue
        localStorage.setItem(key, JSON.stringify(newState))
        return newState
    }
    const [state, setState] = useState(() =>
        parseOrDefault(localStorage.getItem(key))
    )
    useEffect(() => {
        const onStorage = (e: StorageEvent) => {
            if (
                e.storageArea === localStorage &&
                (e.key === key || e.key === null)
            ) {
                setState(parseOrDefault(e.newValue))
            }
        }
        addEventListener("storage", onStorage)
        return () => {
            removeEventListener("storage", onStorage)
        }
    }, [])
    const setLocalState = useCallback(
        (updater: T | ((prevState: T) => T)) => {
            const newUpdater =
                typeof updater === "function" ? updater : () => updater
            setState((oldState) => {
                const newState = newUpdater(oldState)
                localStorage.setItem(key, JSON.stringify(newState))
                return newState
            })
        },
        [setState]
    )

    return [state, setLocalState]
}

export default useLocalState
