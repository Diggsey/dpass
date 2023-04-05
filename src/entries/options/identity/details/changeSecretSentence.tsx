import { FormEvent } from "react"
import { ButtonIcon } from "~/entries/shared/components/buttonIcon"
import { FormInput } from "~/entries/shared/components/formInput"
import { InputValidationIcon } from "~/entries/shared/components/inputValidationIcon"
import { Loader } from "~/entries/shared/components/icons/loader"
import { PasswordInput } from "~/entries/shared/components/passwordInput"
import {
    HelpText,
    Label,
    PrimaryButton,
    SecondaryButton,
    TextButton,
    ValidationError,
} from "~/entries/shared/components/styledElem"
import { sendMessage } from "~/entries/shared/messages"
import { useFormData, usePromiseState } from "~/entries/shared/ui/hooks"
import { generateRandomWords } from "~/entries/shared/wordlist"

type Data = {
    currentPassword: string | null
    secretSentence: string | null
}

export const ChangeSecretSentenceForm = ({ close }: { close: () => void }) => {
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

    const { data, setData, ids, validity, allValid } = useFormData<Data>(
        {
            currentPassword: {
                initial: null,
                validator: (v) => v.length > 0,
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
        },
        [randomWords.lastResult]
    )
    const [changingSentence, changeSentence] = usePromiseState(
        async (e: FormEvent) => {
            e.preventDefault()
            if (!allValid) {
                return
            }
            await sendMessage({
                id: "changeRootPassword",
                oldPassword: data.currentPassword,
                newSentence: data.secretSentence,
            })
            close()
        },
        [close, data, allValid]
    )

    return (
        <form className="grid gap-4" onSubmit={changeSentence}>
            <div className="text-base font-semibold leading-6 text-gray-900">
                Change memorable sentence
            </div>
            <div>
                <Label htmlFor={ids.currentPassword}>Current password</Label>
                <PasswordInput
                    inputId={ids.currentPassword}
                    aria-invalid={
                        validity.currentPassword === false ||
                        !!changingSentence.lastError
                    }
                    onCommit={(e) =>
                        setData("currentPassword", e.currentTarget.value)
                    }
                />
                {changingSentence.lastError ? (
                    <ValidationError>Incorrect password.</ValidationError>
                ) : validity.currentPassword === false ? (
                    <ValidationError>
                        Current password is required.
                    </ValidationError>
                ) : null}
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
            <div className="flex items-center justify-end gap-3">
                <SecondaryButton type="button" onClick={close}>
                    Cancel
                </SecondaryButton>
                <PrimaryButton type="submit" disabled={!allValid}>
                    {changingSentence.inProgress && (
                        <ButtonIcon icon={Loader} />
                    )}
                    <span>Save</span>
                </PrimaryButton>
            </div>
        </form>
    )
}
