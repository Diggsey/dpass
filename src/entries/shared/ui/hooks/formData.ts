import { useCallback, useId, useMemo, useState } from "react"

type ValidationResult = undefined | null | boolean

type Validity<D extends object> = {
    [K in keyof D]?: ValidationResult
}

type SetData<D extends object> = <K extends keyof D>(
    name: K,
    value: D[K]
) => void

type Ids<D extends object> = {
    [K in keyof D]-?: string
}

type Errors<D extends object> = {
    [K in keyof D]?: string
}

type NullsDisallowed<D extends object> = {
    [K in keyof D]: D[K] & (NonNullable<unknown> | undefined)
}

type FormOption<D extends object, K extends keyof D> = object extends Pick<D, K>
    ? {
          readonly initial?: D[K]
          readonly validator?: (
              value: D[K] & (NonNullable<unknown> | undefined),
              data: D
          ) => ValidationResult | string
      }
    : {
          readonly initial: D[K]
          readonly validator?: (
              value: D[K] & (NonNullable<unknown> | undefined),
              data: D
          ) => ValidationResult | string
      }

type FormOptions<D extends object> = {
    readonly [K in keyof D]-?: FormOption<D, K>
}

type FormHookState<D extends object> =
    | {
          allValid: false
          data: D
          validity: Validity<D>
          errors: Errors<D>
      }
    | {
          allValid: true
          data: NullsDisallowed<D>
          validity: Validity<D>
          errors: Errors<D>
      }

type FormHookResult<D extends object> = FormHookState<D> & {
    setData: SetData<D>
    ids: Ids<D>
}

function useFormData<D extends object>(
    options: FormOptions<D>,
    inputs: React.DependencyList
): FormHookResult<D> {
    const id = useId()
    const ids = useMemo(
        () =>
            Object.fromEntries(
                Object.keys(options).map((k) => [k, `${id}-${k}`])
            ) as Ids<D>,
        []
    )
    function validateData(data: D): FormHookState<D> {
        const validity: Validity<D> = {}
        const errors: Errors<D> = {}
        let allValid = true
        for (const k of Object.keys(options)) {
            const name = k as keyof D
            const option = options[name]
            const value = data[name]
            if (value === null) {
                allValid = false
            } else if (option.validator) {
                let valid = option.validator(value, data)
                if (typeof valid === "string") {
                    errors[name] = valid
                    valid = false
                }
                validity[name] = valid
                if (valid !== true && valid !== undefined) {
                    allValid = false
                }
            }
        }
        return { data, validity, errors, allValid } as FormHookState<D>
    }
    const [state, setState] = useState(() => {
        const data = Object.fromEntries(
            Object.keys(options).map((k) => [k, options[k as keyof D].initial])
        ) as D
        return validateData(data)
    })

    const setData = useCallback(<K extends keyof D>(name: K, value: D[K]) => {
        setState(({ data }) => validateData({ ...data, [name]: value }))
    }, inputs)

    return { ...state, setData, ids }
}

export default useFormData
