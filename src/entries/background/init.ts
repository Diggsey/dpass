type Initializer = () => void

let initializers: Initializer[] | null = []

export function onInit(f: Initializer) {
    if (initializers === null) {
        throw new Error("Initializers already ran")
    }
    initializers.push(f)
}

export function runInitializers() {
    if (initializers === null) {
        throw new Error("Initializers already ran")
    }
    const fs = initializers
    initializers = null
    for (const f of fs) {
        f()
    }
}
