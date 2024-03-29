import { FC, useCallback, useState } from "react"
import { RootInfo } from "../../shared/privileged/state"
import { RelativeDate } from "../../shared/components/relativeDate"
import {
    Card,
    OutlineButton,
    TextButton,
} from "../../shared/components/styledElem"
import { Slide } from "~/entries/shared/components/slide"
import { LockButtons } from "~/entries/shared/components/lockButtons"
import { ChangeNameForm } from "./details/changeNameForm"
import { ChangePasswordForm } from "./details/changePasswordForm"
import { ChangeSecretSentenceForm } from "./details/changeSecretSentence"
import host from "~/entries/shared/host"
import { usePromiseState } from "~/entries/shared/ui/hooks"
import { ButtonIcon } from "~/entries/shared/components/buttonIcon"
import { ArchiveBoxArrowDownIcon } from "@heroicons/react/24/outline"
import { Loader } from "~/entries/shared/components/icons/loader"
import { RestoreButton } from "./restore"

type DetailsListProps = {
    rootInfo: RootInfo
    openForm: (form: ActiveForm) => void
}

const DetailsList = ({ rootInfo, openForm }: DetailsListProps) => {
    const [secretSentenceVisible, setSecretSentenceVisible] = useState(false)
    const toggleSecretSentenceVisible = useCallback(() => {
        setSecretSentenceVisible((v) => !v)
    }, [])
    const [backingUp, backup] = usePromiseState(async () => {
        await host.sendMessage({ id: "backup" })
    }, [])

    return (
        <dl className="sm:divide-y sm:divide-gray-200">
            <div className="py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6 sm:py-5">
                <dt className="text-sm font-medium text-gray-500">Name</dt>
                <dd className="mt-1 flex text-sm text-gray-900 sm:col-span-2 sm:mt-0">
                    <span className="flex-grow">{rootInfo.name}</span>
                    <span className="ml-4 flex-shrink-0">
                        <TextButton
                            type="button"
                            onClick={() => openForm(ActiveForm.ChangeName)}
                        >
                            Change
                        </TextButton>
                    </span>
                </dd>
            </div>
            <div className="py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6 sm:py-5">
                <dt className="text-sm font-medium text-gray-500">Created</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:col-span-2 sm:mt-0">
                    <RelativeDate timestamp={rootInfo.creationTimestamp} />
                </dd>
            </div>
            <div className="py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6 sm:py-5">
                <dt className="text-sm font-medium text-gray-500">Updated</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:col-span-2 sm:mt-0">
                    <RelativeDate timestamp={rootInfo.updateTimestamp} />
                </dd>
            </div>
            <div className="py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6 sm:py-5">
                <dt className="text-sm font-medium text-gray-500">Password</dt>
                <dd className="mt-1 flex text-sm text-gray-900 sm:col-span-2 sm:mt-0">
                    <span className="flex-grow">********</span>
                    <span className="ml-4 flex-shrink-0">
                        <TextButton
                            type="button"
                            onClick={() =>
                                openForm(ActiveForm.ChangeMasterPassword)
                            }
                        >
                            Change
                        </TextButton>
                    </span>
                </dd>
            </div>
            <div className="py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6 sm:py-5">
                <dt className="text-sm font-medium text-gray-500">
                    Memorable Sentence
                </dt>
                <dd className="mt-1 flex text-sm text-gray-900 sm:col-span-2 sm:mt-0">
                    <span className="flex-grow">
                        {secretSentenceVisible
                            ? rootInfo.secretSentence
                            : "************************"}
                    </span>
                    <span className="ml-4 flex-shrink-0">
                        <TextButton
                            type="button"
                            onClick={toggleSecretSentenceVisible}
                        >
                            {secretSentenceVisible ? "Hide" : "Show"}
                        </TextButton>
                    </span>
                    <span className="ml-4 flex-shrink-0">
                        <TextButton
                            type="button"
                            onClick={() =>
                                openForm(ActiveForm.ChangeSecretSentence)
                            }
                        >
                            Change
                        </TextButton>
                    </span>
                </dd>
            </div>
            <div className="py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6 sm:py-5">
                <dt className="text-sm font-medium text-gray-500">Actions</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:col-span-2 sm:mt-0">
                    <LockButtons isUnlocked={true} />
                </dd>
            </div>
            <div className="py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6 sm:py-5">
                <dt className="text-sm font-medium text-gray-500">Backup</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:col-span-2 sm:mt-0">
                    <div className="flex flex-wrap gap-3">
                        <OutlineButton
                            onClick={backup}
                            disabled={backingUp.inProgress}
                        >
                            <ButtonIcon
                                icon={
                                    backingUp.inProgress
                                        ? Loader
                                        : ArchiveBoxArrowDownIcon
                                }
                            />
                            Backup
                        </OutlineButton>
                        <RestoreButton />
                    </div>
                </dd>
            </div>
        </dl>
    )
}

enum ActiveForm {
    None,
    ChangeName,
    ChangeMasterPassword,
    ChangeSecretSentence,
}

export const DetailsPanel: FC<{ rootInfo: RootInfo }> = ({ rootInfo }) => {
    const [activeForm, setActiveForm] = useState(ActiveForm.None)
    const [formOpen, setFormOpen] = useState(false)
    const openForm = useCallback((form: ActiveForm) => {
        setActiveForm(form)
        setFormOpen(true)
    }, [])
    const closeForm = useCallback(() => setFormOpen(false), [])

    let renderedForm
    switch (activeForm) {
        case ActiveForm.None:
            renderedForm = null
            break
        case ActiveForm.ChangeName:
            renderedForm = (
                <ChangeNameForm currentName={rootInfo.name} close={closeForm} />
            )
            break
        case ActiveForm.ChangeMasterPassword:
            renderedForm = <ChangePasswordForm close={closeForm} />
            break
        case ActiveForm.ChangeSecretSentence:
            renderedForm = <ChangeSecretSentenceForm close={closeForm} />
            break
    }

    return (
        <Card>
            <Card.Header>
                <h3 className="text-base font-semibold leading-6 text-gray-900">
                    Identity status: unlocked
                </h3>
            </Card.Header>
            <Slide open={formOpen}>
                <Slide.Left>
                    <Card.Body>
                        <DetailsList rootInfo={rootInfo} openForm={openForm} />
                    </Card.Body>
                </Slide.Left>
                <Slide.Right>
                    <Card.Body>{renderedForm}</Card.Body>
                </Slide.Right>
            </Slide>
        </Card>
    )
}
