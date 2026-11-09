import type { SVGProps } from "react";

/** Tool bar icons; `color` sets the stroke. */
export type IconProps = SVGProps<SVGSVGElement> & { color: string };

export function SelectIcon({ color, ...props }: IconProps) {
    return (
        <svg width={33} height={32} viewBox="0 0 33 32" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
            <path d="M15.7207 19.5948L24.408 17.6488L7.78247 5.84961L9.68981 26.1508L15.7207 19.5948Z" stroke={color} strokeMiterlimit={10} />
        </svg>
    );
}

export function PencilIcon({ color, ...props }: IconProps) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width={24}
            height={24}
            viewBox="0 0 24 24"
            fill="none"
            stroke={color}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            {...props}
        >
            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
            <path d="m15 5 4 4" />
        </svg>
    );
}

export function TriangleIcon({ color, ...props }: IconProps) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width={24}
            height={24}
            viewBox="0 0 24 24"
            fill="none"
            stroke={color}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            {...props}
        >
            <path d="M13.73 4a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
        </svg>
    );
}

export function LineIcon({ color, ...props }: IconProps) {
    return (
        <svg width={33} height={32} viewBox="0 0 33 32" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
            <path d="M8.02869 23.4805L24.1617 8.52031" stroke={color} />
        </svg>
    );
}

export function RectIcon({ color, ...props }: IconProps) {
    return (
        <svg width={33} height={32} viewBox="0 0 33 32" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
            <rect x={7.59521} y={7.5} width={17} height={17} stroke={color} />
        </svg>
    );
}

export function CircleIcon({ color, ...props }: IconProps) {
    return (
        <svg width={33} height={32} viewBox="0 0 33 32" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
            <circle cx={16.0952} cy={16} r={8.5} stroke={color} />
        </svg>
    );
}

export function TextIcon({ color, ...props }: IconProps) {
    return (
        <svg width={33} height={32} viewBox="0 0 33 32" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
            <path
                d="M9.30288 8H22.8993L23.0285 12.1092H22.4527C22.1707 10.8182 21.8103 9.97983 21.3716 9.5941C20.9407 9.20049 20.028 9.00369 18.6335 9.00369H17.2938V21.3786C17.2938 22.3154 17.4388 22.8979 17.7286 23.1262C18.0185 23.3466 18.6531 23.4923 19.6324 23.5631V24H12.6168V23.5631C13.6352 23.4844 14.2698 23.3151 14.5205 23.0554C14.7712 22.7956 14.8966 22.1422 14.8966 21.0952V9.00369H13.5569C12.2251 9.00369 11.3163 9.19656 10.8306 9.58229C10.3527 9.96802 9.9923 10.8103 9.74944 12.1092H9.16187L9.30288 8Z"
                stroke={color}
                fill={color}
            />
        </svg>
    );
}
