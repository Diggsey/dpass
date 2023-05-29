import { FC, useCallback, useMemo, useRef, useState } from "react"
import { MagicVScroll } from "~/entries/shared/components/magicVScroll"
import { PrivilegedState } from "~/entries/shared/privileged/state"
import {
    Card,
    Checkbox,
    Label,
    PrimaryButton,
} from "~/entries/shared/components/styledElem"
import { GeneratorSettings } from "~/entries/shared/state"
import { Loader } from "~/entries/shared/components/icons/loader"
import {
    useDebouncedBoundState,
    usePromiseState,
} from "~/entries/shared/ui/hooks"
import { FormInput } from "~/entries/shared/components/formInput"
import { passwordEntropy } from "~/entries/shared/generator"
import { BoltIcon } from "@heroicons/react/24/outline"
import { ButtonIcon } from "~/entries/shared/components/buttonIcon"
import { PasswordStrengthLabel } from "~/entries/shared/components/passwordStrengthLabel"
import host from "~/entries/shared/host"

const PasswordGenerator = ({ settings }: { settings: GeneratorSettings }) => {
    const copiedElemRef = useRef<HTMLSpanElement | null>(null)
    const [tempLength, setTempLength] = useState<number | null>(null)
    const { state, setState } = useDebouncedBoundState(
        settings,
        async (newSettings) => {
            await host.sendMessage({
                id: "editGeneratorSettings",
                settings: newSettings,
            })
        },
        []
    )
    const displayLength = tempLength ?? state.passwordLength
    const entropy = useMemo(() => passwordEntropy(state), [state])
    const [generatingPassword, generatePassword, clearPassword] =
        usePromiseState(async () => {
            const password = await host.sendMessage({
                id: "generatePassword",
            })

            if (password === undefined) {
                return
            }

            await host.copyText(password)

            copiedElemRef.current?.animate(
                [
                    {
                        opacity: 1,
                    },
                    {
                        opacity: 0,
                    },
                ],
                {
                    duration: 1000,
                    iterations: 1,
                }
            )

            return password
        }, [])
    const updateSettings = useCallback(
        (newSettings: GeneratorSettings) => {
            setState(newSettings)
            clearPassword()
        },
        [setState, clearPassword]
    )

    return (
        <Card>
            <Card.Header>
                <div className="flex flex-wrap items-center justify-between sm:flex-nowrap">
                    <div className="flex items-center gap-3">
                        <h3 className="text-base font-semibold leading-6 text-gray-900">
                            Password generator
                        </h3>
                        <PasswordStrengthLabel entropy={entropy} />
                    </div>
                    <div className="flex-shrink-0">
                        <PrimaryButton
                            type="button"
                            onClick={generatePassword}
                            disabled={generatingPassword.inProgress}
                        >
                            <ButtonIcon
                                icon={
                                    generatingPassword.inProgress
                                        ? Loader
                                        : BoltIcon
                                }
                            />
                            <span>Generate</span>
                        </PrimaryButton>
                    </div>
                </div>
            </Card.Header>
            <Card.Body>
                <Label>Generated password</Label>
                <div className="relative mt-2 rounded-md shadow-sm">
                    <FormInput
                        type="text"
                        className="font-mono"
                        value={generatingPassword.lastResult ?? ""}
                        readOnly
                        disabled={!generatingPassword.lastResult}
                    />
                    <span
                        ref={copiedElemRef}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-sm opacity-0 pointer-events-none"
                    >
                        Copied!
                    </span>
                </div>
            </Card.Body>
            <Card.Body>
                <div>
                    <Label>Password length: {displayLength}</Label>
                    <div className="relative mt-2 rounded-md shadow-sm">
                        <FormInput
                            type="range"
                            value={displayLength}
                            min="4"
                            max="40"
                            onChange={(e) => {
                                setTempLength(e.currentTarget.valueAsNumber)
                            }}
                            onCommit={(e) => {
                                updateSettings({
                                    ...state,
                                    passwordLength:
                                        e.currentTarget.valueAsNumber,
                                })
                                setTempLength(null)
                            }}
                        />
                    </div>
                </div>
                <Checkbox.Label>
                    <Checkbox.Input
                        type="checkbox"
                        onChange={(e) =>
                            updateSettings({
                                ...state,
                                passwordLetters: e.currentTarget.checked,
                            })
                        }
                        checked={state.passwordLetters}
                    />
                    <span>Letters</span>
                </Checkbox.Label>
                <Checkbox.Label>
                    <Checkbox.Input
                        type="checkbox"
                        onChange={(e) =>
                            updateSettings({
                                ...state,
                                passwordDigits: e.currentTarget.checked,
                            })
                        }
                        checked={state.passwordDigits}
                    />
                    <span>Digits</span>
                </Checkbox.Label>
                <Checkbox.Label>
                    <Checkbox.Input
                        type="checkbox"
                        onChange={(e) =>
                            updateSettings({
                                ...state,
                                passwordSymbols: e.currentTarget.checked,
                            })
                        }
                        checked={state.passwordSymbols}
                    />
                    <span>Symbols</span>
                </Checkbox.Label>
                <div>
                    <Label>Extra characters</Label>
                    <div className="relative mt-2 rounded-md shadow-sm">
                        <FormInput
                            type="text"
                            defaultValue={state.passwordExtra}
                            onCommit={(e) => {
                                updateSettings({
                                    ...state,
                                    passwordExtra: e.currentTarget.value,
                                })
                            }}
                        />
                    </div>
                </div>
            </Card.Body>
            <Card.Footer>
                <Label>Entropy: {entropy.toFixed(1)} bits</Label>
            </Card.Footer>
        </Card>
    )
}

export const GeneratorPage: FC<{ state: PrivilegedState }> = ({ state }) => {
    const settings = state.generatorSettings
    if (!settings) {
        return <Loader />
    }
    return (
        <MagicVScroll>
            <div className="container grid mx-auto max-w-7xl sm:px-6 lg:px-8 py-10 gap-10 auto-rows-max">
                <PasswordGenerator settings={settings} />
            </div>
        </MagicVScroll>
    )
}
