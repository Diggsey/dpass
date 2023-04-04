import {
    CheckCircleIcon,
    ExclamationCircleIcon,
} from "@heroicons/react/24/outline"
import { Loader } from "./loader"

type InputValidationIconProps = {
    valid?: boolean | null
    validating?: boolean | null
}

export const InputValidationIcon = ({
    valid,
    validating,
}: InputValidationIconProps) => {
    let icon = null
    if (validating) {
        icon = <Loader className="h-5 w-5 text-gray-500" aria-hidden="true" />
    } else if (valid) {
        icon = (
            <CheckCircleIcon
                className="h-5 w-5 text-green-500"
                aria-hidden="true"
            />
        )
    } else if (valid === false) {
        icon = (
            <ExclamationCircleIcon
                className="h-5 w-5 text-red-500"
                aria-hidden="true"
            />
        )
    }
    return (
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
            {icon}
        </div>
    )
}
