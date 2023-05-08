import { randomInt } from "./random"
import { GeneratorSettings } from "./state"

const LETTERS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
const DIGITS = "0123456789"
const SYMBOLS = "~!@#$%^&*()_-+={[}]|:;<,>.?/"

function possibleCharacters(settings: GeneratorSettings): string[] {
    const chars = new Set<string>()
    function extend(s: string) {
        for (const c of s) {
            chars.add(c)
        }
    }
    if (settings.passwordLetters) {
        extend(LETTERS)
    }
    if (settings.passwordDigits) {
        extend(DIGITS)
    }
    if (settings.passwordSymbols) {
        extend(SYMBOLS)
    }
    extend(settings.passwordExtra)

    return [...chars]
}

function generateCandidatePassword(chars: string[], length: number): string {
    let password = ""
    if (chars.length > 0) {
        for (let i = 0; i < length; ++i) {
            password += chars[randomInt(chars.length)]
        }
    }
    return password
}

function checkPassword(password: string, settings: GeneratorSettings) {
    let hasLetter = false
    let hasDigit = false
    let hasSymbol = false
    let hasExtra = false
    for (const c of password) {
        if (LETTERS.includes(c)) {
            hasLetter = true
        } else if (DIGITS.includes(c)) {
            hasDigit = true
        } else if (SYMBOLS.includes(c)) {
            hasSymbol = true
        }
        if (settings.passwordExtra.includes(c)) {
            hasExtra = true
        }
    }
    return (
        (hasLetter || !settings.passwordLetters) &&
        (hasDigit || !settings.passwordDigits) &&
        (hasSymbol || !settings.passwordSymbols) &&
        (hasExtra || !settings.passwordExtra)
    )
}

export function generatePassword(settings: GeneratorSettings): string {
    const chars = possibleCharacters(settings)
    for (let i = 0; i < 256; ++i) {
        const password = generateCandidatePassword(
            chars,
            settings.passwordLength
        )
        if (checkPassword(password, settings)) {
            return password
        }
    }
    throw new Error("Failed to generate password which meets the criteria")
}

export function passwordEntropy(settings: GeneratorSettings): number {
    const base = possibleCharacters(settings).length
    if (base === 0) {
        return 0
    }
    const length = settings.passwordLength
    return Math.log2(base) * length
}
