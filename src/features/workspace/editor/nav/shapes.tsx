import type { ReactNode } from "react";

import type { DrawingElement } from "../EditorContext";
import { CircleIcon, LineIcon, RectIcon, TriangleIcon } from "./icons";

/** Shapes offered by the Elements menu (desktop) and carousel (mobile). */
export const SHAPES: { element: DrawingElement; label: string; icon: (color: string) => ReactNode }[] = [
    { element: "line", label: "Line", icon: (color) => <LineIcon width={30} height={25} strokeWidth={2} color={color} /> },
    { element: "rectangle", label: "Rectangle", icon: (color) => <RectIcon width={25} height={25} strokeWidth={1.5} color={color} /> },
    { element: "circle", label: "Circle", icon: (color) => <CircleIcon width={28} height={25} strokeWidth={1.5} color={color} /> },
    { element: "triangle", label: "Triangle", icon: (color) => <TriangleIcon width={18} height={25} strokeWidth={1.5} color={color} /> },
];
