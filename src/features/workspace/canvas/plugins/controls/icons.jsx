export const VerticalIcon = (props) => (
    <svg
        width={12}
        height={24}
        viewBox="0 0 12 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        {...props}
    >
        <g filter="url(#filter0_d)">
        <rect x={4} y={4} width={4} height={16} rx={2} fill="white" />
        <rect
            x={4.25}
            y={4.25}
            width={3.5}
            height={15.5}
            rx={1.75}
            stroke="black"
            strokeOpacity={0.3}
            strokeWidth={0.5}
        />
        </g>
        <defs>
            <filter
                id="filter0_d"
                x={0}
                y={0}
                width={12}
                height={24}
                filterUnits="userSpaceOnUse"
                colorInterpolationFilters="sRGB"
            >
                <feFlood floodOpacity={0} result="BackgroundImageFix" />
                <feColorMatrix
                    in="SourceAlpha"
                    type="matrix"
                    values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
                />
                <feOffset />
                <feGaussianBlur stdDeviation={2} />
                <feColorMatrix
                    type="matrix"
                    values="0 0 0 0 0.137674 0 0 0 0 0.190937 0 0 0 0 0.270833 0 0 0 0.15 0"
                />
                <feBlend
                    mode="normal"
                    in2="BackgroundImageFix"
                    result="effect1_dropShadow"
                />
                <feBlend
                    mode="normal"
                    in="SourceGraphic"
                    in2="effect1_dropShadow"
                    result="shape"
                />
            </filter>
        </defs>
    </svg>
);


export const HorizontalIcon = (props) => (
    <svg
        width={24}
        height={12}
        viewBox="0 0 24 12"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        {...props}
    >
        <g filter="url(#filter0_d)">
        <rect
            x={20}
            y={4}
            width={4}
            height={16}
            rx={2}
            transform="rotate(90 20 4)"
            fill="white"
        />
        <rect
            x={19.75}
            y={4.25}
            width={3.5}
            height={15.5}
            rx={1.75}
            transform="rotate(90 19.75 4.25)"
            stroke="black"
            strokeOpacity={0.3}
            strokeWidth={0.5}
        />
        </g>
        <defs>
            <filter
                id="filter0_d"
                x={0}
                y={0}
                width={24}
                height={12}
                filterUnits="userSpaceOnUse"
                colorInterpolationFilters="sRGB"
            >
                <feFlood floodOpacity={0} result="BackgroundImageFix" />
                <feColorMatrix
                in="SourceAlpha"
                type="matrix"
                values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
                />
                <feOffset />
                <feGaussianBlur stdDeviation={2} />
                <feColorMatrix
                type="matrix"
                values="0 0 0 0 0.137674 0 0 0 0 0.190937 0 0 0 0 0.270833 0 0 0 0.15 0"
                />
                <feBlend
                mode="normal"
                in2="BackgroundImageFix"
                result="effect1_dropShadow"
                />
                <feBlend
                mode="normal"
                in="SourceGraphic"
                in2="effect1_dropShadow"
                result="shape"
                />
            </filter>
        </defs>
    </svg>
);


export const EdgeIcon = (props) => (
    <svg
        width={19}
        height={18}
        viewBox="0 0 19 18"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        {...props}
    >
        <g filter="url(#filter0_d)">
            <circle cx={9.99609} cy={9} r={5} fill="white" />
            <circle
                cx={9.99609}
                cy={9}
                r={4.75}
                stroke="black"
                strokeOpacity={0.3}
                strokeWidth={0.5}
            />
        </g>
        <defs>
            <filter
                id="filter0_d"
                x={0.996094}
                y={0}
                width={18}
                height={18}
                filterUnits="userSpaceOnUse"
                colorInterpolationFilters="sRGB"
            >
                <feFlood floodOpacity={0} result="BackgroundImageFix" />
                <feColorMatrix
                in="SourceAlpha"
                type="matrix"
                values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
                />
                <feOffset />
                <feGaussianBlur stdDeviation={2} />
                <feColorMatrix
                type="matrix"
                values="0 0 0 0 0.137674 0 0 0 0 0.190937 0 0 0 0 0.270833 0 0 0 0.15 0"
                />
                <feBlend
                mode="normal"
                in2="BackgroundImageFix"
                result="effect1_dropShadow"
                />
                <feBlend
                mode="normal"
                in="SourceGraphic"
                in2="effect1_dropShadow"
                result="shape"
                />
            </filter>
        </defs>
    </svg>
);

export const RotateIcon = (props) => (
    <svg
        width={18}
        height={18}
        viewBox="0 0 18 18"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        {...props}
    >
        <g filter="url(#filter0_d)">
        <circle cx={9} cy={9} r={5} fill="white" />
        <circle
            cx={9}
            cy={9}
            r={4.75}
            stroke="black"
            strokeOpacity={0.3}
            strokeWidth={0.5}
        />
        </g>
        <path
            d="M10.8047 11.1242L9.49934 11.1242L9.49934 9.81885"
            stroke="black"
            strokeWidth={0.5}
            strokeLinecap="round"
            strokeLinejoin="round"
        />
        <path
            d="M6.94856 6.72607L8.25391 6.72607L8.25391 8.03142"
            stroke="black"
            strokeWidth={0.5}
            strokeLinecap="round"
            strokeLinejoin="round"
        />
        <path
            d="M9.69517 6.92267C10.007 7.03301 10.2858 7.22054 10.5055 7.46776C10.7252 7.71497 10.8787 8.01382 10.9517 8.33642C11.0247 8.65902 11.0148 8.99485 10.9229 9.31258C10.831 9.63031 10.6601 9.91958 10.4262 10.1534L9.49701 11.0421M8.25792 6.72607L7.30937 7.73554C7.07543 7.96936 6.90454 8.25863 6.81264 8.57636C6.72073 8.89408 6.71081 9.22992 6.78381 9.55251C6.8568 9.87511 7.01032 10.174 7.23005 10.4212C7.44978 10.6684 7.72855 10.8559 8.04036 10.9663"
            stroke="black"
            strokeWidth={0.5}
            strokeLinecap="round"
            strokeLinejoin="round"
        />
        <defs>
            <filter
                id="filter0_d"
                x={0}
                y={0}
                width={18}
                height={18}
                filterUnits="userSpaceOnUse"
                colorInterpolationFilters="sRGB"
            >
                <feFlood floodOpacity={0} result="BackgroundImageFix" />
                <feColorMatrix
                in="SourceAlpha"
                type="matrix"
                values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
                />
                <feOffset />
                <feGaussianBlur stdDeviation={2} />
                <feColorMatrix
                type="matrix"
                values="0 0 0 0 0.137674 0 0 0 0 0.190937 0 0 0 0 0.270833 0 0 0 0.15 0"
                />
                <feBlend
                mode="normal"
                in2="BackgroundImageFix"
                result="effect1_dropShadow"
                />
                <feBlend
                mode="normal"
                in="SourceGraphic"
                in2="effect1_dropShadow"
                result="shape"
                />
            </filter>
        </defs>
    </svg>
);
