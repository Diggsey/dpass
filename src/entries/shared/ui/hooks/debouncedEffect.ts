import { useEffect } from "react"

function useDebouncedEffect(
    f: () => void,
    ms: number,
    inputs: React.DependencyList
) {
    useEffect(() => {
        const timeoutId = setTimeout(f, ms)
        return () => {
            clearTimeout(timeoutId)
        }
    }, inputs)
}

export default useDebouncedEffect
