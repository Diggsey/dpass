import browser from "webextension-polyfill"

export enum Lang {
    en = "en",
}

const wordlists: { [lang in Lang]?: Promise<string[]> } = {}
const currentLang = Lang.en

async function loadLanguageImpl(lang: Lang): Promise<string[]> {
    const resp = await fetch(
        browser.runtime.getURL(`assets/wordlists/${lang}.txt`)
    )
    if (!resp.ok) {
        throw new Error(`Failed to load word list for language '${lang}'`)
    }
    return (await resp.text()).split("\n").filter((line) => line.length > 0)
}

async function loadLanguage(lang: Lang): Promise<string[]> {
    let promise = wordlists[lang]
    if (!promise) {
        promise = wordlists[lang] = loadLanguageImpl(lang)
    }
    try {
        return await promise
    } catch (ex) {
        // There was some kind of error, don't save the rejected promise
        delete wordlists[lang]
        throw ex
    }
}

function generateRandomInt(upperBound: number): number {
    let result
    const maxInt = 0x100000000
    const limit = maxInt - (maxInt % upperBound)
    const arr = new Uint32Array(1)
    do {
        result = crypto.getRandomValues(arr)[0]
    } while (result >= limit)
    return result % upperBound
}

export async function generateRandomWords(count: number): Promise<string[]> {
    const wordlist = await loadLanguage(currentLang)
    return new Array(count)
        .fill("")
        .map(() => wordlist[generateRandomInt(wordlist.length)])
}
