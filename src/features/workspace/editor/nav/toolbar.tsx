/* Pieces shared by the tool bar buttons (SideBar, ElementsMenu). */

/** Tool icons draw in the button's text colour, so they follow the theme. */
export const ACTIVE_COLOR = "currentColor";
export const IDLE_COLOR = "currentColor";

/** Classes shared by every tool bar button. */
export const toolButtonClass = (active: boolean) =>
    `focus-ring flex size-10 items-center justify-center rounded-[10px] transition-[background-color,color,transform] duration-150 active:scale-95 ${
        active ? "bg-accent-soft text-accent" : "text-muted hover:bg-surface-hover hover:text-text"
    }`;
