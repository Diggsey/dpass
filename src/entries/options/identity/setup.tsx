import { UserPlusIcon } from "@heroicons/react/24/outline"
import { FormEvent, useState } from "react"
import { ButtonIcon } from "~/entries/shared/components/buttonIcon"
import { FormInput } from "~/entries/shared/components/formInput"
import { InputValidationIcon } from "~/entries/shared/components/inputValidationIcon"
import { Loader } from "~/entries/shared/components/icons/loader"
import { PasswordInput } from "~/entries/shared/components/passwordInput"
import { Slide } from "~/entries/shared/components/slide"
import {
    Card,
    Checkbox,
    HelpText,
    Label,
    OutlineButton,
    PrimaryButton,
    SecondaryButton,
    TextButton,
    ValidationError,
} from "~/entries/shared/components/styledElem"
import host from "~/entries/shared/host"
import {
    setLocalState,
    useFormData,
    usePromiseState,
} from "~/entries/shared/ui/hooks"
import { generateRandomWords } from "~/entries/shared/wordlist"
import { RestoreButton } from "./restore"

type SetupFormProps = {
    close: () => void
}

type Data = {
    name: string | null
    masterPassword: string | null
    retypePassword: string | null
    secretSentence: string | null
    createVault: boolean
    vaultName: string
    copyStorage: boolean
}

export const SetupForm = ({ close }: SetupFormProps) => {
    const [randomWords, refreshRandomWords] = usePromiseState(
        async () => await generateRandomWords(3),
        []
    )
    if (!randomWords.lastResult && !randomWords.inProgress) {
        void refreshRandomWords()
    }
    const sentencePrompt = randomWords.lastResult ? (
        `"${randomWords.lastResult[0]}", "${randomWords.lastResult[1]}" and "${randomWords.lastResult[2]}"`
    ) : (
        <Loader />
    )

    const { data, setData, validity, ids, allValid } = useFormData<Data>(
        {
            name: {
                initial: null,
                validator: (v) => v.length > 0,
            },
            masterPassword: {
                initial: null,
                validator: (v) => v.length >= 8,
            },
            retypePassword: {
                initial: null,
                validator: (v, d) => v === d.masterPassword,
            },
            secretSentence: {
                initial: null,
                validator: (v) =>
                    randomWords.lastResult
                        ? randomWords.lastResult.every((word) =>
                              v.toLowerCase().includes(word.toLowerCase())
                          )
                        : null,
            },
            createVault: {
                initial: true,
            },
            vaultName: {
                initial: "Personal Vault",
                validator: (v, d) => v.length > 0 || !d.createVault,
            },
            copyStorage: {
                initial: true,
            },
        },
        [randomWords.lastResult]
    )
    const [creatingIdentity, createIdentity] = usePromiseState(
        async (e: FormEvent) => {
            e.preventDefault()
            if (!allValid) {
                return
            }
            await host.sendMessage({
                id: "createRoot",
                name: data.name,
                masterPassword: data.masterPassword,
                secretSentence: data.secretSentence,
            })

            if (data.createVault) {
                const vaultId = await host.sendMessage({
                    id: "createVault",
                    name: data.vaultName,
                    copyStorage: data.copyStorage,
                })
                if (!vaultId) {
                    throw new Error(
                        "Unknown error whilst creating initial vault"
                    )
                }
                setLocalState("activeTab", "vaults")
                setLocalState("activeVaultId", vaultId)
            }

            close()
        },
        [close, data, allValid]
    )
    return (
        <form className="grid gap-4" onSubmit={createIdentity}>
            <div className="text-base font-semibold leading-6 text-gray-900">
                Set up a new identity
            </div>
            <div>
                <Label htmlFor={ids.name}>Name</Label>
                <div className="relative mt-2 rounded-md shadow-sm">
                    <FormInput
                        type="text"
                        id={ids.name}
                        aria-invalid={validity.name === false}
                        onCommit={(e) => setData("name", e.currentTarget.value)}
                        autoFocus
                    />
                    <InputValidationIcon valid={validity.name} />
                </div>
                {validity.name === false && (
                    <ValidationError>Name is required.</ValidationError>
                )}
            </div>
            <div>
                <Label htmlFor={ids.masterPassword}>Master password</Label>
                <PasswordInput
                    inputId={ids.masterPassword}
                    aria-invalid={validity.masterPassword === false}
                    onCommit={(e) =>
                        setData("masterPassword", e.currentTarget.value)
                    }
                />
                <HelpText>
                    Password must be at least 8 characters long.
                </HelpText>
                {validity.masterPassword === false && (
                    <ValidationError>Password is invalid.</ValidationError>
                )}
            </div>
            <div>
                <Label htmlFor={ids.retypePassword}>
                    Re-enter master password
                </Label>
                <PasswordInput
                    inputId={ids.retypePassword}
                    aria-invalid={validity.retypePassword === false}
                    onCommit={(e) =>
                        setData("retypePassword", e.currentTarget.value)
                    }
                />
                {validity.retypePassword === false && (
                    <ValidationError>Passwords do not match.</ValidationError>
                )}
            </div>
            <div>
                <div className="flex justify-between items-center">
                    <Label htmlFor={ids.secretSentence}>
                        Memorable sentence including the words {sentencePrompt}
                    </Label>
                    <TextButton type="button" onClick={refreshRandomWords}>
                        Generate new words
                    </TextButton>
                </div>
                <div className="relative mt-2 rounded-md shadow-sm">
                    <FormInput
                        type="text"
                        id={ids.secretSentence}
                        aria-invalid={validity.secretSentence === false}
                        onCommit={(e) =>
                            setData("secretSentence", e.currentTarget.value)
                        }
                    />
                    <InputValidationIcon valid={validity.secretSentence} />
                </div>
                <HelpText>
                    You will need to use this sentence when setting up a new
                    device.
                </HelpText>
                {validity.secretSentence === false && (
                    <ValidationError>
                        Sentence does not include the required words.
                    </ValidationError>
                )}
            </div>
            <Checkbox.Label htmlFor={ids.createVault}>
                <Checkbox.Input
                    id={ids.createVault}
                    type="checkbox"
                    onChange={(e) =>
                        setData("createVault", e.currentTarget.checked)
                    }
                    defaultChecked={true}
                />
                <span>Create an initial vault</span>
            </Checkbox.Label>
            {data.createVault && (
                <>
                    <div>
                        <Label htmlFor={ids.name}>Vault Name</Label>
                        <div className="relative mt-2 rounded-md shadow-sm">
                            <FormInput
                                type="text"
                                id={ids.name}
                                aria-invalid={validity.name === false}
                                onCommit={(e) =>
                                    setData("vaultName", e.currentTarget.value)
                                }
                                defaultValue={data.vaultName}
                            />
                            <InputValidationIcon valid={validity.name} />
                        </div>
                        {validity.name === false && (
                            <ValidationError>
                                Vault name is required.
                            </ValidationError>
                        )}
                    </div>
                    <Checkbox.Label htmlFor={ids.copyStorage}>
                        <Checkbox.Input
                            id={ids.copyStorage}
                            type="checkbox"
                            onChange={(e) =>
                                setData("copyStorage", e.currentTarget.checked)
                            }
                            defaultChecked={true}
                        />
                        <span>Store vault with my identity</span>
                    </Checkbox.Label>
                </>
            )}
            <div className="flex items-center justify-end gap-3">
                <SecondaryButton type="button" onClick={close}>
                    Cancel
                </SecondaryButton>
                <PrimaryButton type="submit" disabled={!allValid}>
                    {creatingIdentity.inProgress && (
                        <ButtonIcon icon={Loader} />
                    )}
                    <span>Save</span>
                </PrimaryButton>
            </div>
        </form>
    )
}

export const SetupPanel = () => {
    const [formOpen, setFormOpen] = useState(false)

    const [quicklySettingUp, quickSetup] = usePromiseState(async () => {
        await host.sendMessage({
            id: "createRoot",
            name: "Unnamed",
            masterPassword: "password",
            secretSentence: "goliath slashed overload",
        })
        const vaultId = await host.sendMessage({
            id: "createVault",
            name: "Personal Vault",
            copyStorage: true,
        })
        if (vaultId === undefined) {
            console.error("Failed to create vault")
            return
        }
        await host.sendMessage({
            id: "createVaultItem",
            vaultId,
            details: {
                origins: ["https://accounts.google.com"],
                name: "Google",
                encrypted: false,
                payload: {
                    fields: [
                        {
                            uuid: crypto.randomUUID(),
                            name: "Username",
                            autofillMode: {
                                id: "username",
                            },
                            value: "foobar",
                        },
                        {
                            uuid: crypto.randomUUID(),
                            name: "Password",
                            autofillMode: {
                                id: "password",
                            },
                            value: "testpassword",
                        },
                    ],
                },
            },
        })
    }, [])

    return (
        <Card>
            <Card.Header>
                <h3 className="text-base font-semibold leading-6 text-gray-900">
                    Identity status: not found
                </h3>
            </Card.Header>
            <Slide open={formOpen}>
                <Slide.Left>
                    <Card.Body>
                        <p className="text-sm text-gray-500">
                            It looks like you don't have an identity yet. Either
                            add another storage location containing an existing
                            identity, or set up a new identity.
                        </p>
                        <div className="mt-5 flex gap-3">
                            <OutlineButton onClick={quickSetup}>
                                {quicklySettingUp.inProgress && (
                                    <ButtonIcon icon={Loader} />
                                )}
                                <span>Quick setup</span>
                            </OutlineButton>
                            <PrimaryButton onClick={() => setFormOpen(true)}>
                                <UserPlusIcon
                                    className="h-5 w-5"
                                    aria-hidden="true"
                                />
                                <span>Set up a new identity</span>
                            </PrimaryButton>
                            <RestoreButton />
                        </div>
                    </Card.Body>
                </Slide.Left>
                <Slide.Right>
                    <Card.Body>
                        <SetupForm close={() => setFormOpen(false)} />
                    </Card.Body>
                </Slide.Right>
            </Slide>
        </Card>
    )
}
