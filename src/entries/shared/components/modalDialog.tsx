import { Dialog, Transition } from "@headlessui/react"
import { XMarkIcon } from "@heroicons/react/24/outline"
import { Fragment, MutableRefObject, ReactNode } from "react"
import { ClassName, cn, ElementTypeWithProps } from "../ui"

type ModalDialogProps = {
    open: boolean
    close: () => void
    children?: ReactNode
    initialFocus?: MutableRefObject<HTMLElement | null>
}

export const ModalDialog = ({
    open,
    close,
    children,
    initialFocus,
}: ModalDialogProps) => {
    return (
        <Transition.Root show={open} as={Fragment}>
            <Dialog
                as="div"
                className="relative z-100"
                onClose={close}
                initialFocus={initialFocus}
            >
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
                </Transition.Child>

                <div className="fixed inset-0 z-100 overflow-y-auto">
                    <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
                        <Transition.Child
                            as={Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                            enterTo="opacity-100 translate-y-0 sm:scale-100"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 translate-y-0 sm:scale-100"
                            leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                        >
                            <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg">
                                <div className="absolute right-0 top-0 hidden pr-4 pt-4 sm:block">
                                    <button
                                        type="button"
                                        className="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                                        onClick={close}
                                    >
                                        <span className="sr-only">Close</span>
                                        <XMarkIcon
                                            className="h-6 w-6"
                                            aria-hidden="true"
                                        />
                                    </button>
                                </div>
                                {children}
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition.Root>
    )
}

ModalDialog.Body = ({ children }: { children?: ReactNode }) => {
    return (
        <div className="bg-white px-3 pb-4 pt-5 sm:pt-6">
            <div className="flex flex-col sm:flex-row text-center sm:text-left sm:flex sm:items-start gap-3 sm:gap-4 text-sm text-gray-500">
                {children}
            </div>
        </div>
    )
}

ModalDialog.Footer = ({ children }: { children?: ReactNode }) => {
    return (
        <div className="bg-gray-50 flex p-3 gap-3 flex-col sm:flex-row-reverse">
            {children}
        </div>
    )
}

type IconComponentType = ElementTypeWithProps<{
    className: string
    "aria-hidden": "true"
}>

ModalDialog.Icon = ({
    icon: Icon,
    className,
}: {
    icon: IconComponentType
    className?: ClassName
}) => {
    return (
        <div
            className={cn(
                "mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full sm:mx-0 sm:h-10 sm:w-10",
                className
            )}
        >
            <Icon className="h-6 w-6" aria-hidden="true" />
        </div>
    )
}

ModalDialog.Title = ({ children }: { children?: ReactNode }) => {
    return (
        <Dialog.Title
            as="h3"
            className="text-base font-semibold leading-6 text-gray-900 mb-2"
        >
            {children}
        </Dialog.Title>
    )
}
