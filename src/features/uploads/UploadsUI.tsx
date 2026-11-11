"use client";

import type { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, X } from "@phosphor-icons/react";

import { UPLOAD_MAX_LABEL } from "./messages";
import { uploadUrl, useUploads, type Upload } from "./UploadsContext";

/** The app's critically damped spring: no overshoot, quick to settle. */
const SPRING = { type: "spring", bounce: 0, duration: 0.3 } as const;

export const UPLOADS_HINT = `Add your own line art. SVG files up to ${UPLOAD_MAX_LABEL}.`;

/**
 * A tile arriving or leaving: it scales in from 92% and fades, and neighbours glide into
 * place (layout). Under Reduce Motion, the app's MotionConfig keeps only the fade.
 */
export function TileMotion({ children, className = "" }: { children: ReactNode; className?: string }) {
    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={SPRING}
            className={className}
        >
            {children}
        </motion.div>
    );
}

/** Dashed "+" tile that opens the file picker. */
export function AddUploadTile({ onPick, disabled, className }: { onPick: () => void; disabled?: boolean; className: string }) {
    return (
        <button
            type="button"
            aria-label="Upload SVG files"
            onClick={onPick}
            disabled={disabled}
            className={`press flex items-center justify-center border-[1.5px] border-dashed border-ink/25 text-ink/70 outline-none hover:border-ink/40 hover:text-ink focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-40 ${className}`}
        >
            <Plus size={22} weight="bold" />
        </button>
    );
}

/** A file on its way up: a shimmering placeholder in the tile's place. */
export function PendingTile({ name, className }: { name: string; className: string }) {
    return (
        <div role="img" aria-label={`Uploading ${name}`} className={`flex items-center justify-center bg-grouped ${className}`}>
            <span aria-hidden className="shimmer h-3/5 w-3/5 rounded-md bg-ink/[0.06]" />
        </div>
    );
}

/**
 * An uploaded drawing: tap to place it on the page. The remove button is a sibling of
 * the place button (not inside it). `removal`: "always" (the phone's Edit mode), "hover"
 * (desktop: on hover or keyboard focus, and always on touch screens) or "never".
 */
export function UploadTile({
    upload,
    onPlace,
    disabled,
    removal,
    itemRole,
    className,
    imageClassName,
}: {
    upload: Upload;
    onPlace: (upload: Upload) => void;
    disabled?: boolean;
    removal: "always" | "hover" | "never";
    /** "menuitem" inside the desktop Elements menu. */
    itemRole?: "menuitem";
    className: string;
    imageClassName: string;
}) {
    const { remove } = useUploads();
    const editing = removal === "always";
    const removeVisibility = editing
        ? "opacity-100"
        : "opacity-0 group-hover/tile:opacity-100 group-focus-within/tile:opacity-100 [@media(hover:none)]:opacity-100";

    return (
        // A named group: the Elements menu around it is a `group` too.
        <div className="group/tile relative">
            <button
                type="button"
                role={itemRole}
                aria-label={`Add ${upload.name}`}
                title={upload.name}
                disabled={disabled || editing}
                onClick={() => onPlace(upload)}
                className={`press flex items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-default ${
                    editing ? "" : "disabled:opacity-50"
                } ${className}`}
            >
                {/* Drawn in black ink; inverted to white lines in dark mode. */}
                {/* eslint-disable-next-line @next/next/no-img-element -- small SVG thumbnails from our own API */}
                <img src={uploadUrl(upload.id)} alt="" loading="lazy" draggable={false} className={`object-contain dark:invert ${imageClassName}`} />
            </button>
            {removal !== "never" && (
                <button
                    type="button"
                    role={itemRole}
                    aria-label={`Remove ${upload.name}`}
                    onClick={() => remove(upload)}
                    className={`press absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-surface-raised text-ink shadow-hairline outline-none transition-opacity duration-150 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-focus ${removeVisibility}`}
                >
                    <X size={12} weight="bold" />
                </button>
            )}
        </div>
    );
}

/** "Removed … Undo", errors and "left out" notes, each easy to dismiss. */
export function UploadNotices({ className = "" }: { className?: string }) {
    const { messages, dismissMessage, removed, undo } = useUploads();
    if (!removed && !messages.length) return null;

    return (
        <div className={`space-y-1 ${className}`}>
            <AnimatePresence initial={false}>
                {removed && (
                    <Notice key="undo" role="status">
                        <span className="min-w-0 flex-1 truncate text-ink">Removed “{removed.name}”.</span>
                        <button type="button" onClick={undo} className="press shrink-0 rounded-full px-2 py-0.5 font-semibold text-teal outline-none hover:bg-teal/10 focus-visible:ring-2 focus-visible:ring-focus">
                            Undo
                        </button>
                    </Notice>
                )}
                {messages.map((message) => (
                    <Notice key={message.key} role={message.tone === "error" ? "alert" : "status"}>
                        <span className={`min-w-0 flex-1 ${message.tone === "error" ? "text-fault" : "text-graphite"}`}>{message.text}</span>
                        <button
                            type="button"
                            aria-label="Dismiss"
                            onClick={() => dismissMessage(message.key)}
                            className="press shrink-0 rounded-full p-1 text-graphite outline-none hover:bg-ink/[0.05] focus-visible:ring-2 focus-visible:ring-focus"
                        >
                            <X size={12} weight="bold" />
                        </button>
                    </Notice>
                ))}
            </AnimatePresence>
        </div>
    );
}

function Notice({ role, children }: { role: "status" | "alert"; children: ReactNode }) {
    return (
        <motion.div
            layout
            role={role}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={SPRING}
            className="type-footnote flex items-start gap-2"
        >
            {children}
        </motion.div>
    );
}
