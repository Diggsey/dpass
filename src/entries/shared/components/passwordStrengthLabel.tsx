import { cn } from "../ui"

export const PasswordStrengthLabel = ({ entropy }: { entropy: number }) => {
    const thresholds = [
        {
            entropy: 64,
            label: "Very strong",
            className: "text-green-700 bg-green-50 ring-green-600/20",
        },
        {
            entropy: 56,
            label: "Strong",
            className: "text-green-700 bg-green-50 ring-green-600/20",
        },
        {
            entropy: 48,
            label: "Average",
            className: "text-gray-600 bg-gray-50 ring-gray-500/10",
        },
        {
            entropy: 32,
            label: "Weak",
            className: "text-yellow-700 bg-yellow-50 ring-yellow-600/20",
        },
        {
            entropy: 0,
            label: "Very weak",
            className: "text-red-700 bg-red-50 ring-red-600/10",
        },
    ]
    const strength = thresholds.find((x) => entropy >= x.entropy)
    if (!strength) {
        throw new Error("Entropy cannot be negative")
    }
    return (
        <div
            className={cn(
                "rounded-md py-1 px-2 text-xs font-medium ring-1 ring-inset",
                strength.className
            )}
        >
            {strength.label}
        </div>
    )
}
