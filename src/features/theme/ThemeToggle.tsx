"use client";

import { Desktop, Moon, Sun } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import { Menu, MenuContent, MenuLabel, MenuRadioGroup, MenuRadioItem, MenuTrigger } from "@/components/ui/menu";
import { Tooltip } from "@/components/ui/tooltip";
import { useTheme, type ThemeChoice } from "./theme";

const LABEL: Record<ThemeChoice, string> = { system: "Match system", light: "Light", dark: "Dark" };

/** Icon button that opens the appearance menu (system / light / dark). */
export function ThemeToggle() {
    const { choice, resolved, setChoice } = useTheme();
    const Icon = choice === "system" ? Desktop : resolved === "dark" ? Moon : Sun;
    return (
        <Menu>
            <Tooltip label="Appearance" side="bottom">
                <MenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" aria-label={`Appearance: ${LABEL[choice]}`}>
                        <Icon weight="regular" suppressHydrationWarning />
                    </Button>
                </MenuTrigger>
            </Tooltip>
            <MenuContent className="min-w-44">
                <MenuLabel>Appearance</MenuLabel>
                <MenuRadioGroup value={choice} onValueChange={(value) => setChoice(value as ThemeChoice)}>
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
