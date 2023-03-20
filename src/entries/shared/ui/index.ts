import {
    DependencyList,
    Dispatch,
    SetStateAction,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react"
import { computeItemDisplayName, VaultItem, VaultItemMap } from "../state"

export type ClassName =
    | { [className: string]: boolean | null | undefined }
    | ClassName[]
    | string
    | null
    | undefined
    | false

function mapArg(arg: ClassName): string {
    if (!arg) {
        return ""
    }
    if (typeof arg === "string") {
        return arg
    }
    if (Array.isArray(arg)) {
        return cn(...arg)
    }
    return Object.entries(arg)
        .filter(([_, v]) => v)
        .map(([k, _]) => k.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase())
        .join(" ")
}

export function cn(...args: ClassName[]): string {
    return args.map(mapArg).filter(Boolean).join(" ")
}

type PromiseState<R, P> =
    | {
          readonly inProgress: true
          readonly lastArgs: P
          readonly lastError?: never
          readonly lastResult?: never
      }
    | {
          readonly inProgress: false
          readonly lastArgs?: P
          readonly lastError?: unknown
          readonly lastResult?: R
      }

type AsyncFunction<R> = (...args: never[]) => Promise<R>

type PromiseStateResult<R, F extends AsyncFunction<R>> = [
    PromiseState<R, Parameters<F>>,
    (...args: Parameters<F>) => Promise<R>,
    () => void
]

export type SharedPromiseState = {
    readonly inProgress: boolean
    readonly lastError?: unknown
    readonly wrap: <R, P extends never[]>(
        f: (...args: P) => Promise<R>
    ) => (...args: P) => Promise<R>
    readonly clearError: () => void
}

export function useSharedPromiseState(): SharedPromiseState {
    const inProgress = useRef(false)
    const wrap = useCallback(
        <R, P extends never[]>(
                f: (...args: P) => Promise<R>
            ): ((...args: P) => Promise<R>) =>
            async (...args: P) => {
                if (inProgress.current) {
                    throw new Error("Operation already in progress")
                }
                inProgress.current = true
                setState(({ lastError: _, ...oldState }) => ({
                    ...oldState,
                    inProgress: inProgress.current,
                }))
                try {
                    return await f(...args)
                } catch (lastError) {
                    setState((oldState) => ({ ...oldState, lastError }))
                    throw lastError
                } finally {
                    inProgress.current = false
                    setState((oldState) => ({
                        ...oldState,
                        inProgress: inProgress.current,
                    }))
                }
            },
        []
    )
    const clearError = useCallback(() => {
        setState(({ lastError: _, ...oldState }) => oldState)
    }, [])
    const [state, setState] = useState<SharedPromiseState>({
        inProgress: false,
        wrap,
        clearError,
    })
    return state
}

export function usePromiseState<R, F extends AsyncFunction<R>>(
    cb: F,
    inputs: DependencyList,
    parent?: SharedPromiseState
): PromiseStateResult<R, F> {
    const [state, setState] = useState<PromiseState<R, Parameters<F>>>({
        inProgress: false,
    })
    const inProgress = useRef(false)
    const fnImpl = async (...args: Parameters<F>) => {
        if (inProgress.current) {
            throw new Error("Operation already in progress")
        }
        inProgress.current = true
        setState({ inProgress: true, lastArgs: args })
        try {
            const lastResult: R = await cb(...args)
            setState((oldState) => ({
                ...oldState,
                lastResult,
                inProgress: false,
            }))
            return lastResult
        } catch (lastError) {
            setState((oldState) => ({
                ...oldState,
                lastError,
                inProgress: false,
            }))
            throw lastError
        } finally {
            inProgress.current = false
        }
    }
    const fn = useCallback(parent ? parent.wrap(fnImpl) : fnImpl, [
        ...inputs,
        parent?.wrap,
    ])
    const clearResult = useCallback(() => {
        setState((oldState) =>
            oldState.inProgress ? oldState : { inProgress: false }
        )
        parent?.clearError()
    }, [parent?.clearError])
    return [state, fn, clearResult]
}

export type Json =
    | null
    | boolean
    | number
    | string
    | ReadonlyArray<Json>
    | { readonly [key: string]: Json }

export function useLocalState<T extends Json>(
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

type VaultMap = {
    readonly [vaultId: string]: {
        readonly name: string
        readonly items: VaultItemMap | null
    }
}

export type ItemInfo = {
    displayName: string
    vaultName: string
    logoUrl: string | null
    vaultId: string
    itemId: string
    item: VaultItem
}

function computeFieldSearchScore(searchTerm: string, value: string): number {
    const idx = value.indexOf(searchTerm)
    if (idx === -1) {
        return 0
    }
    let score = searchTerm.length / value.length
    if (idx === 0) {
        score += 1.0
    }
    return score
}

function computeItemSearchScore(
    searchTerms: string[],
    itemInfo: ItemInfo
): number {
    const fieldWeights: [string, number][] = [
        [itemInfo.displayName.toLowerCase(), 10],
        [itemInfo.vaultName.toLowerCase(), 1],
    ]
    for (const origin of itemInfo.item.origins) {
        fieldWeights.push([origin.toLowerCase(), 2])
    }
    const itemData = itemInfo.item.data
    if (!itemData.encrypted) {
        for (const field of itemData.payload.fields) {
            fieldWeights.push([field.value.toLowerCase(), 1])
        }
    }
    return searchTerms
        .map((searchTerm) =>
            Math.max(
                ...fieldWeights.map(
                    ([value, weight]) =>
                        computeFieldSearchScore(searchTerm, value) * weight
                )
            )
        )
        .reduce((a, b) => a + b, 0)
}

function computeLogoUrl(item: VaultItem): string | null {
    const domain = item.origins[0]
    if (domain) {
        return (
            "https://www.google.com/s2/favicons?" +
            new URLSearchParams({
                domain,
                sz: "32",
            })
        )
    }
    return null
}

export function useFilteredVaultItems(
    vaultMap: VaultMap,
    selectedVaultId: string | null,
    searchTerm: string
): { allItems: ItemInfo[]; filteredItems: ItemInfo[] } {
    const allItems = useMemo(() => {
        const vaults = selectedVaultId
            ? [[selectedVaultId, vaultMap[selectedVaultId]] as const]
            : Object.entries(vaultMap)
        const allItems = vaults.flatMap(([vaultId, vault]) =>
            Object.entries(vault.items || {}).map(([itemId, item]) => ({
                displayName: computeItemDisplayName(item),
                vaultName: vaultMap[vaultId].name,
                logoUrl: computeLogoUrl(item),
                vaultId,
                itemId,
                item,
            }))
        )
        allItems.sort(
            (a, b) =>
                a.displayName.localeCompare(b.displayName) ||
                a.vaultName.localeCompare(b.vaultName) ||
                a.itemId.localeCompare(b.itemId)
        )
        return allItems
    }, [vaultMap, selectedVaultId])

    const filteredItems = useMemo(() => {
        const searchTerms = searchTerm
            .toLowerCase()
            .split(" ")
            .filter((term) => term.length > 0)
        if (searchTerms.length == 0) {
            return allItems
        }
        const filteredItems = allItems
            .map((itemInfo): [number, ItemInfo] => [
                computeItemSearchScore(searchTerms, itemInfo),
                itemInfo,
            ])
            .filter(([score, _itemInfo]) => score > 0.0)
        filteredItems.sort((a, b) => b[0] - a[0])
        return filteredItems.map(([_score, itemInfo]) => itemInfo)
    }, [allItems, searchTerm])

    return { allItems, filteredItems }
}
