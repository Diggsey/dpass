import { Disclosure } from "@headlessui/react"
import { Bars3Icon, XMarkIcon } from "@heroicons/react/24/outline"
import { FC, ReactNode } from "react"
import { cn } from "../ui"
import { useLocalState } from "../ui/hooks"

type NavItem = {
    key: string
    title: ReactNode
    body: ReactNode
    disabled?: boolean
}

type AppShellProps = {
    navigation: NavItem[]
}

export const AppShell: FC<AppShellProps> = ({ navigation }: AppShellProps) => {
    const [activeKey, setActiveKey] = useLocalState<string | null>(
        "activeTab",
        null
    )
    const effectiveKey = activeKey ?? navigation[0].key
    const currentItem = navigation.find(
        (item) => item.key === effectiveKey && !item.disabled
    )
    return (
        <div className="min-h-full bg-gray-100 grid grid-rows-[max-content]">
            <Disclosure as="nav" className="border-b border-gray-200 bg-white">
                {({ open }) => (
                    <>
                        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex h-16 justify-between">
                            <div className="flex">
                                <div className="flex flex-shrink-0 items-center">
                                    <img
                                        className="block h-8 w-auto"
                                        src="/icons/icon-48.png"
                                        alt="dpass"
                                    />
                                </div>
                                <div className="hidden sm:-my-px sm:ml-6 sm:flex sm:space-x-8">
                                    {navigation.map((item) => (
                                        <button
                                            key={item.key}
                                            onClick={() =>
                                                setActiveKey(item.key)
                                            }
                                            className={cn(
                                                item === currentItem
                                                    ? "border-indigo-500 text-gray-900"
                                                    : item.disabled
                                                    ? "border-transparent text-gray-300"
                                                    : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700",
                                                "relative inline-flex items-center border-b-2 px-1 pt-1 text-sm font-medium"
                                            )}
                                            aria-current={
                                                item === currentItem
                                                    ? "page"
                                                    : undefined
                                            }
                                            disabled={item.disabled}
                                        >
                                            {item.title}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="sm:ml-6 flex items-center font-semibold cursor-default">
                                dpass
                            </div>
                            <div className="-mr-2 flex items-center sm:hidden">
                                {/* Mobile menu button */}
                                <Disclosure.Button className="relative inline-flex items-center justify-center rounded-md bg-white p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2">
                                    <span className="sr-only">
                                        Open main menu
                                    </span>
                                    {open ? (
                                        <XMarkIcon
                                            className="block h-6 w-6"
                                            aria-hidden="true"
                                        />
                                    ) : (
                                        <Bars3Icon
                                            className="block h-6 w-6"
                                            aria-hidden="true"
                                        />
                                    )}
                                </Disclosure.Button>
                            </div>
                        </div>

                        <Disclosure.Panel className="sm:hidden">
                            <div className="space-y-1 pt-2 pb-3">
                                {navigation.map((item) => (
                                    <Disclosure.Button
                                        key={item.key}
                                        onClick={() => setActiveKey(item.key)}
                                        className={cn(
                                            item === currentItem
                                                ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                                                : item.disabled
                                                ? "border-transparent text-gray-400"
                                                : "border-transparent text-gray-600 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-800",
                                            "block border-l-4 py-2 pl-3 pr-4 text-base font-medium"
                                        )}
                                        aria-current={
                                            item === currentItem
                                                ? "page"
                                                : undefined
                                        }
                                        disabled={item.disabled}
                                    >
                                        {item.title}
                                    </Disclosure.Button>
                                ))}
                            </div>
                        </Disclosure.Panel>
                    </>
                )}
            </Disclosure>
            {currentItem?.body}
        </div>
    )
}
