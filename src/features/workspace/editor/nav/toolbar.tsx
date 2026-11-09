/* Pieces shared by the tool bar buttons (SideBar, ElementsMenu). */

export const ACTIVE_COLOR = "#1c8096";
export const IDLE_COLOR = "#4b5563";

/** Classes shared by every tool bar button. */
export const toolButtonClass = (active: boolean) =>
    `flex w-full items-center justify-center rounded-lg p-2 transition-colors duration-500 ${active ? "bg-gray-100" : ""}`;

/** Hover label to the right of a tool bar button. */
export function ToolTooltip({ label, hidden = false }: { label: string; hidden?: boolean }) {
    if (hidden) return null;
    return (
        <div className="pointer-events-none invisible absolute -bottom-4 z-10 -translate-x-1/2 text-nowrap rounded-md bg-[#464c5b] px-3 py-1 text-sm font-medium text-white opacity-20 shadow transition-all before:absolute before:-left-3 before:top-1/2 before:-translate-y-1/2 before:border-[7px] before:border-transparent before:border-r-[#464c5b] before:content-[''] group-hover:visible group-hover:-translate-y-1 group-hover:opacity-100 group-hover:delay-200 md:left-full lg:bottom-auto lg:ml-6 lg:-translate-x-3 lg:translate-y-0 lg:group-hover:-translate-x-3 lg:group-hover:-translate-y-0">
            {label}
        </div>
    );
}
