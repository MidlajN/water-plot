"use client";

import { ArrowArcLeft, ArrowArcRight, Desktop, DotsThree, DownloadSimple, FileArrowUp, Moon, Sun, Trash } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuRadioGroup, MenuRadioItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { useTheme, type ThemeChoice } from "../theme/theme";
import { useExport } from "../export/useExport";
import { useMode } from "../modes/ModeContext";
import { usePlotter } from "../plotter/PlotterContext";
import useCanvas from "../workspace/canvas/CanvasContext";

/** "⋯" button in the mobile card footer: export, plot a G-code file, undo, redo and delete. */
export function MoreMenu() {
    const { workspace } = useCanvas() ?? {};
    const { exporting, exportAs, ready } = useExport();
    const isEditMode = useMode().mode === "edit";
    const plotter = usePlotter();
    const theme = useTheme();

    return (
        <Menu>
            <MenuTrigger asChild>
                <Button size="icon-lg" aria-label="More">
                    <DotsThree weight="bold" />
                </Button>
            </MenuTrigger>
            <MenuContent side="top" align="end" sideOffset={8} className="w-60 [&_[role=menuitem]]:h-11">
                <MenuItem icon={<DownloadSimple />} disabled={!ready || exporting !== null} onSelect={() => void exportAs("svg")}>
                    {exporting === "svg" ? "Exporting…" : "Export SVG"}
                </MenuItem>
                <MenuItem icon={<DownloadSimple />} disabled={!ready || exporting !== null} onSelect={() => void exportAs("gcode")}>
                    {exporting === "gcode" ? "Exporting…" : "Export G-code"}
                </MenuItem>
                <MenuItem icon={<FileArrowUp />} disabled={!plotter.gatewayConnected || plotter.busy || plotter.sending} onSelect={plotter.pickFile}>
                    Plot G-code file…
                </MenuItem>
                <MenuSeparator />
                <MenuItem icon={<ArrowArcLeft />} disabled={!workspace || !isEditMode} onSelect={() => workspace?.undo()}>
                    Undo
                </MenuItem>
                <MenuItem icon={<ArrowArcRight />} disabled={!workspace || !isEditMode} onSelect={() => workspace?.redo()}>
                    Redo
                </MenuItem>
                <MenuItem icon={<Trash />} tone="danger" disabled={!workspace || !isEditMode} onSelect={() => workspace?.handleDelete()}>
                    Delete selected
                </MenuItem>
                <MenuSeparator />
                <MenuLabel>Appearance</MenuLabel>
                <MenuRadioGroup value={theme.choice} onValueChange={(value) => theme.setChoice(value as ThemeChoice)} className="[&_[role=menuitemradio]]:h-11">
                    <MenuRadioItem value="system">
                        <Desktop /> Match system
                    </MenuRadioItem>
                    <MenuRadioItem value="light">
                        <Sun /> Light
                    </MenuRadioItem>
                    <MenuRadioItem value="dark">
                        <Moon /> Dark
                    </MenuRadioItem>
                </MenuRadioGroup>
            </MenuContent>
        </Menu>
    );
}
