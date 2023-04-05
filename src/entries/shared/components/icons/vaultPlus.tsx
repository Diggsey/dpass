import { forwardRef } from "react"

export const VaultPlusIcon = forwardRef<
    SVGSVGElement,
    React.SVGProps<SVGSVGElement> & { title?: string; titleId?: string }
>(({ title, titleId, ...props }, svgRef) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 48 48"
        aria-hidden
        ref={svgRef}
        aria-labelledby={titleId}
        {...props}
    >
        {title ? <title id={titleId}>{title}</title> : null}
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="m 40,34 v 6 m 0,0 v 6 m 0,-6 h 6 m -6,0 H 34 M 44.16,28.746527 V 10.56 c 0,-2.4709975 -2.009002,-4.48 -4.48,-4.48 H 8.32 c -2.4709975,0 -4.48,2.0090025 -4.48,4.48 V 35.2 c 0,2.470998 2.0090025,4.48 4.48,4.48 h 1.12 l 1.12,2.24 h 4.48 l 1.12,-2.24 H 28.023517 M 19.52,28.48 a 5.6,5.6 0 1 0 0,-11.2 5.6,5.6 0 1 0 0,11.2 v 0 m 0,-16.8 a 11.2,11.2 0 1 1 0,22.4 11.2,11.2 0 1 1 0,-22.4 v 0 M 35.200001,29.016038 35.2,21.571 c -1.301999,-0.462 -2.24,-1.708001 -2.24,-3.171 0,-1.854998 1.505002,-3.36 3.36,-3.36 1.854998,0 3.36,1.505002 3.36,3.36 0,1.462999 -0.938001,2.709 -2.24,3.171 v 0 6.738032"
        />
    </svg>
))
