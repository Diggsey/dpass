import { forwardRef } from "react"

export const DPassIcon = forwardRef<
    SVGSVGElement,
    React.SVGProps<SVGSVGElement> & { title?: string; titleId?: string }
>(({ title, titleId, ...props }, svgRef) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        stroke="none"
        viewBox="0 0 48 48"
        aria-hidden
        ref={svgRef}
        aria-labelledby={titleId}
        {...props}
    >
        {title ? <title id={titleId}>{title}</title> : null}
        <rect fill="#000000" width="22" height="36" x="4" y="6" />
        <path
            fill="#4d4d4d"
            d="m 16,10 v 28 h 3 11 c 4.214281,0 7.865002,-1.584518 10.314453,-4.197266 C 42.763904,31.189986 44,27.666663 44,24 44,20.333337 42.763904,16.810014 40.314453,14.197266 37.865002,11.584518 34.214281,10 30,10 Z m 6,6 h 8 c 2.785711,0 4.635002,0.915486 5.935547,2.302734 C 37.236092,19.689982 38,21.666669 38,24 38,26.333331 37.236092,28.310018 35.935547,29.697266 34.635002,31.084514 32.785712,32 30,32 h -8 z"
        />
        <path
            fill="#aa0000"
            d="M 16 10 L 16 38 L 19 38 L 26 38 L 26 32 L 22 32 L 22 16 L 26 16 L 26 10 L 16 10 z "
        />
    </svg>
))
