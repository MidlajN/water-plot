"use client";

import type { ReactNode, SVGProps } from "react";
import { motion } from "framer-motion";

import { useEditor, type DrawingElement, type EditorTool } from "../EditorContext";

const ACTIVE_COLOR = "#1c8096";
const IDLE_COLOR = "#4b5563";

type IconProps = SVGProps<SVGSVGElement> & { color: string };

interface ToolItem {
    label: string;
    tool: EditorTool;
    element?: DrawingElement;
    icon: (color: string) => ReactNode;
}

const TOOLS: ToolItem[] = [
    { label: "Select", tool: "Select", icon: (color) => <SelectIcon width={25} height={25} strokeWidth={1.5} color={color} /> },
    { label: "Pen", tool: "Pen", icon: (color) => <PencilIcon width={20} height={25} strokeWidth={1.5} color={color} /> },
    { label: "Lines", tool: "Lines", icon: (color) => <LineIcon width={30} height={25} strokeWidth={2} color={color} /> },
    {
        label: "Rectangle",
        tool: "Elements",
        element: "rectangle",
        icon: (color) => <RectIcon width={25} height={25} strokeWidth={1.5} color={color} />,
    },
    {
        label: "Circle",
        tool: "Elements",
        element: "circle",
        icon: (color) => <CircleIcon width={28} height={25} strokeWidth={1.5} color={color} />,
    },
    {
        label: "Triangle",
        tool: "Elements",
        element: "triangle",
        icon: (color) => <TriangleIcon width={18} height={25} strokeWidth={1.5} color={color} />,
    },
    { label: "Text", tool: "Text", icon: (color) => <TextIcon width={25} height={25} strokeWidth={1} color={color} /> },
];

/** Floating tool bar on the left of the editor. */
export function SideNav() {
    const { tool, element, setTool, setElement } = useEditor();

    return (
        <motion.div
            className="absolute left-8 top-1/2 z-10 flex flex-col items-center justify-center gap-2"
            initial={{ opacity: 0, translateX: -20, translateY: "-50%" }}
            animate={{ opacity: 1, translateX: 0, translateY: "-50%" }}
            exit={{ opacity: 0, translateX: -20 }}
            transition={{ duration: 0.5 }}
        >
            <aside className="top-[50%] h-full shadow-md max-[900px]:absolute max-[900px]:left-1 max-[900px]:z-50 max-[900px]:h-fit max-[900px]:-translate-y-[50%] max-[900px]:transform">
                <nav className="flex h-full flex-col rounded-l">
                    <ul className="flex flex-col rounded-lg bg-white shadow-sm">
                        {TOOLS.map((item) => {
                            const active = tool === item.tool && (!item.element || element === item.element);

                            return (
                                <li
                                    key={item.label}
                                    onClick={() => {
                                        setTool(item.tool);
                                        if (item.element) setElement(item.element);
                                    }}
                                    className={`group relative flex w-full cursor-pointer items-center justify-center text-nowrap rounded-lg p-2 font-medium transition-colors duration-500 ${
                                        active ? "bg-gray-100" : ""
                                    }`}
                                >
                                    {item.icon(active ? ACTIVE_COLOR : IDLE_COLOR)}
                                    <div className="invisible absolute -bottom-4 z-10 -translate-x-1/2 rounded-md bg-[#464c5b] px-3 py-1 text-sm text-white opacity-20 shadow transition-all before:absolute before:-left-3 before:top-1/2 before:-translate-y-1/2 before:border-[7px] before:border-transparent before:border-r-[#464c5b] before:content-[''] group-hover:visible group-hover:-translate-y-1 group-hover:opacity-100 group-hover:delay-200 md:left-full lg:bottom-auto lg:ml-6 lg:-translate-x-3 lg:translate-y-0 lg:group-hover:-translate-x-3 lg:group-hover:-translate-y-0">
                                        {item.label}
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                </nav>
            </aside>
        </motion.div>
    );
}

// ------------ Icons ---------------

function SelectIcon({ color, ...props }: IconProps) {
    return (
        <svg width={33} height={32} viewBox="0 0 33 32" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
            <path d="M15.7207 19.5948L24.408 17.6488L7.78247 5.84961L9.68981 26.1508L15.7207 19.5948Z" stroke={color} strokeMiterlimit={10} />
        </svg>
    );
}

function PencilIcon({ color, ...props }: IconProps) {
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

function TriangleIcon({ color, ...props }: IconProps) {
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

function LineIcon({ color, ...props }: IconProps) {
    return (
        <svg width={33} height={32} viewBox="0 0 33 32" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
            <path d="M8.02869 23.4805L24.1617 8.52031" stroke={color} />
        </svg>
    );
}

function RectIcon({ color, ...props }: IconProps) {
    return (
        <svg width={33} height={32} viewBox="0 0 33 32" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
            <rect x={7.59521} y={7.5} width={17} height={17} stroke={color} />
        </svg>
    );
}

function CircleIcon({ color, ...props }: IconProps) {
    return (
        <svg width={33} height={32} viewBox="0 0 33 32" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
            <circle cx={16.0952} cy={16} r={8.5} stroke={color} />
        </svg>
    );
}

function TextIcon({ color, ...props }: IconProps) {
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
