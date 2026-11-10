import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { THEME_BOOTSTRAP } from "@/features/theme/bootstrap";
import { InlineScript } from "@/features/theme/InlineScript";
import { ThemeSync } from "@/features/theme/theme";

const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"],
});

const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
});

export const metadata: Metadata = {
    title: "Plotter Studio",
    description: "Draw, plot and watch your pen plotter.",
};

export const viewport: Viewport = {
    themeColor: [
        { media: "(prefers-color-scheme: light)", color: "#f4f6f8" },
        { media: "(prefers-color-scheme: dark)", color: "#1a1d21" },
    ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
    return (
        <html lang="en" data-theme="light" suppressHydrationWarning className={`h-full ${geistSans.variable} ${geistMono.variable}`}>
            <head>
                {/* Sets data-theme before first paint: the saved choice, else the system's. */}
                <InlineScript html={THEME_BOOTSTRAP} />
            </head>
            <body className="flex min-h-full flex-col">
                <ThemeSync />
                {children}
            </body>
        </html>
    );
}
