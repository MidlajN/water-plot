import { notFound } from "next/navigation";

import { StyleTile } from "./StyleTile";

export const metadata = { title: "Design system · Plotter Studio" };

/** Development-only style tile: every token and primitive in light and dark. */
export default function DesignPage() {
    if (process.env.NODE_ENV === "production") notFound();
    return <StyleTile />;
}
