export type AutofillMode = PresetAutofillMode | CustomAutofillMode

export const PRESET_AUTOFILL_VALUES = [
    "username",
    "email",
    "password",
    "note",
    "passwordNote",
    "honorificPrefix",
    "givenName",
    "additionalName",
    "familyName",
    "honirificSuffix",
    "name",
    "dob",
    "gender",
    "phoneNumber",
    "addressLine1",
    "addressLine2",
    "addressLine3",
    "addressLevel2",
    "addressLevel1",
    "addressCountry",
    "addressPostalCode",
    "ccNumber",
    "ccExpiry",
    "ccSecurityCode",
    "ccType",
] as const
export type PresetAutofillValue = (typeof PRESET_AUTOFILL_VALUES)[number]

export type AutofillInfo = {
    name: string
    matcher: (elem: HTMLInputElement) => number
    multiLine?: true
}

export const PRESET_AUTOFILL_MAPPING: {
    [id in PresetAutofillValue]: AutofillInfo
} = {
    username: {
        name: "Username",
        matcher: usernameMatcher,
    },
    email: {
        name: "Email",
        matcher: emailMatcher,
    },
    password: {
        name: "Password",
        matcher: passwordMatcher,
    },
    note: {
        name: "Note",
        matcher: neverMatch,
        multiLine: true,
    },
    passwordNote: {
        name: "Password Note",
        matcher: neverMatch,
    },
    honorificPrefix: {
        name: "Honorific Prefix",
        matcher: genericMatcher("honorific-prefix"),
    },
    givenName: {
        name: "Given Name",
        matcher: genericMatcher("given-name", "cc-given-name"),
    },
    additionalName: {
        name: "Middle Name(s)",
        matcher: genericMatcher("additional-name", "cc-additional-name"),
    },
    familyName: {
        name: "Family Name",
        matcher: genericMatcher("family-name", "cc-family-name"),
    },
    honirificSuffix: {
        name: "Honorific Suffix",
        matcher: genericMatcher("honorific-suffix"),
    },
    name: {
        name: "Full Name",
        matcher: genericMatcher("name"),
    },
    addressLine1: {
        name: "Addr Line 1",
        matcher: genericMatcher("address-line1", "street-address"),
    },
    addressLine2: {
        name: "Addr Line 2",
        matcher: genericMatcher("address-line2", "street-address"),
    },
    addressLine3: {
        name: "Addr Line 3",
        matcher: genericMatcher("address-line3", "street-address"),
    },
    addressLevel2: {
        name: "Addr Locality",
        matcher: genericMatcher("address-level2"),
    },
    addressLevel1: {
        name: "Addr State/Prov.",
        matcher: genericMatcher("address-level1"),
    },
    addressCountry: {
        name: "Addr Country",
        matcher: genericMatcher("country", "country-name"),
    },
    addressPostalCode: {
        name: "Addr Postcode",
        matcher: genericMatcher("postal-code"),
    },
    ccNumber: {
        name: "CC Number",
        matcher: genericMatcher("cc-number"),
    },
    ccExpiry: {
        name: "CC Expiry",
        matcher: genericMatcher("cc-exp", "cc-exp-month", "cc-exp-year"),
    },
    ccSecurityCode: {
        name: "CC Security Code",
        matcher: genericMatcher("cc-csc"),
    },
    ccType: {
        name: "CC Type",
        matcher: genericMatcher("cc-type"),
    },
    dob: {
        name: "Date Of Birth",
        matcher: genericMatcher("bday", "bday-day", "bday-month", "bday-year"),
    },
    gender: {
        name: "Gender",
        matcher: genericMatcher("sex"),
    },
    phoneNumber: {
        name: "Phone Number",
        matcher: telephoneMatcher,
    },
}

export type PresetAutofillMode = {
    readonly id: PresetAutofillValue
}
export type CustomAutofillMode = {
    readonly id: "custom"
    readonly key: string
}

export function defaultName(autofillMode: AutofillMode): string {
    if (autofillMode.id === "custom") {
        throw new Error("Not implemented")
    }
    return PRESET_AUTOFILL_MAPPING[autofillMode.id].name
}

function scoreValue(
    value: string | undefined,
    valueScores: { [value: string]: number },
    patternScores?: [RegExp, number][]
): number {
    if (value === undefined) {
        return 0
    }
    return (
        valueScores[value] ??
        patternScores?.find((p) => p[0].test(value))?.[1] ??
        0
    )
}

function usernameMatcher(elem: HTMLInputElement): number {
    if (elem.type === "password") {
        return 0
    }
    const label = elem.labels?.[0]
    return Math.max(
        scoreValue(
            elem.name.toLowerCase(),
            {
                username: 0.95,
                login: 0.5,
                ue: 0.5,
            },
            [[/userid$/, 0.5]]
        ),
        scoreValue(elem.autocomplete, {
            username: 1.0,
            nickname: 0.5,
        }),
        scoreValue(
            elem.placeholder.trim().toLowerCase(),
            {
                username: 0.95,
                login: 0.5,
            },
            [[/id$/, 0.5]]
        ),
        scoreValue(elem.dataset["field"], {
            username: 0.95,
            nickname: 0.5,
        }),
        scoreValue(label?.innerText?.toLowerCase(), {}, [
            [/\busername\b/, 0.5],
            [/\bid\b/, 0.5],
        ])
    )
}

function emailMatcher(elem: HTMLInputElement): number {
    if (elem.type === "password") {
        return 0
    }
    const label = elem.labels?.[0]
    return Math.max(
        scoreValue(elem.name.toLowerCase(), {
            email: 0.9,
            login: 0.4,
            ue: 0.4,
        }),
        scoreValue(elem.autocomplete, {
            email: 1.0,
        }),
        scoreValue(elem.type, {
            email: 0.9,
        }),
        scoreValue(elem.placeholder.trim().toLowerCase(), {
            email: 0.9,
            login: 0.4,
        }),
        scoreValue(label?.innerText?.toLowerCase(), {}, [[/\bemail\b/, 0.4]])
    )
}

function passwordMatcher(elem: HTMLInputElement): number {
    if (elem.type !== "password") {
        return 0
    }
    return Math.max(
        0.5,
        scoreValue(elem.name.toLowerCase(), {
            password: 0.9,
        }),
        scoreValue(elem.autocomplete, {
            "current-password": 1.0,
        }),
        scoreValue(elem.placeholder.trim().toLowerCase(), {
            password: 0.9,
        })
    )
}

function telephoneMatcher(elem: HTMLInputElement): number {
    if (elem.type === "password") {
        return 0
    }
    const label = elem.labels?.[0]
    return Math.max(
        scoreValue(elem.name.toLowerCase(), {
            tel: 0.9,
            phone: 0.4,
            telephone: 0.4,
        }),
        scoreValue(elem.autocomplete, {
            tel: 1.0,
            "tel-country-code": 1.0,
            "tel-national": 1.0,
            "tel-area-code": 1.0,
            "tel-local": 1.0,
            "tel-local-prefix": 1.0,
            "tel-local-suffix": 1.0,
            "tel-extension": 1.0,
        }),
        scoreValue(elem.placeholder.trim().toLowerCase(), {
            telephone: 0.9,
            tel: 0.4,
            phone: 0.4,
        }),
        scoreValue(label?.innerText?.toLowerCase(), {}, [
            [/\bphone\b/, 0.4],
            [/\btel\b/, 0.4],
            [/\btelephone\b/, 0.4],
        ])
    )
}

function genericMatcher(
    ...autocompleteValues: string[]
): (elem: HTMLInputElement) => number {
    return (elem) => {
        if (elem.type === "password") {
            return 0
        }
        return autocompleteValues.includes(elem.autocomplete) ? 1 : 0
    }
}

function neverMatch(): 0 {
    return 0
}

export function customMatcher(_elem: HTMLInputElement, _key: string): number {
    throw new Error("Not implemented")
}
