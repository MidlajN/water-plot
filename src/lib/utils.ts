import { createCn } from "cn/config";

/**
 * Class merging that knows the design system's custom scales (globals.css). Without
 * this, `text-ui` (a size) and `text-on-accent` (a colour) look like the same group and
 * one silently drops the other.
 */
export const cn = createCn({
    extend: {
        theme: {
            text: ["micro", "caption", "ui", "body", "title", "display"],
            radius: ["control", "panel", "sheet"],
            shadow: ["hairline", "raised", "overlay", "paper"],
        },
    },
});
