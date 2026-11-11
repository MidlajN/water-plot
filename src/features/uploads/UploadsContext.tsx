"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from "react";

import type { UploadNote } from "../ai/sanitizeSvg";
import { UPLOAD_MAX_BYTES, UPLOAD_MAX_LABEL, UPLOAD_NOTE_TEXT } from "./messages";
import type { Upload } from "./store";

export type { Upload };

/** How long a removed upload can be brought back before it's deleted for good. */
const UNDO_MS = 6000;

export interface PendingUpload {
    key: number;
    name: string;
}

export interface UploadMessage {
    key: number;
    text: string;
    tone: "error" | "note";
}

interface UploadsValue {
    /** Saved uploads, newest first (without one that's waiting to be removed). */
    list: Upload[];
    /** "idle" until the first answer (shown as loading). */
    status: "idle" | "ready" | "error";
    /** Files being uploaded right now, in the order picked. */
    pending: PendingUpload[];
    /** Errors and "left out" notes from the last upload, or a failed removal. */
    messages: UploadMessage[];
    /** The upload that was just removed and can still be brought back. */
    removed: Upload | null;
    refresh: () => Promise<void>;
    /** Uploads the files one by one. Resolves with the upload when a single file was saved. */
    upload: (files: File[]) => Promise<Upload | null>;
    remove: (upload: Upload) => void;
    undo: () => void;
    dismissMessage: (key: number) => void;
}

const UploadsContext = createContext<UploadsValue | null>(null);

export const uploadUrl = (id: string) => `/api/uploads/${encodeURIComponent(id)}`;

/** Opens the file picker for SVGs. Resolves with nothing when the picker is dismissed. */
export function pickSvgFiles(): Promise<File[]> {
    return new Promise((resolve) => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".svg,image/svg+xml";
        input.multiple = true;
        input.addEventListener("change", () => resolve([...(input.files ?? [])]), { once: true });
        input.addEventListener("cancel", () => resolve([]), { once: true });
        input.click();
    });
}

const isSvgFile = (file: File) => file.type === "image/svg+xml" || /\.svg$/i.test(file.name);

function deleteOnServer(id: string) {
    // keepalive lets the request finish when the page is closing.
    return fetch(uploadUrl(id), { method: "DELETE", keepalive: true }).then((response) => {
        if (!response.ok && response.status !== 404) throw new Error(`HTTP ${response.status}`);
    });
}

/**
 * Uploaded SVGs for the Elements pickers. Kept above the pickers so uploads in flight,
 * messages and the undo window survive the phone sheet switching panels.
 */
export function UploadsProvider({ children }: PropsWithChildren) {
    const [list, setList] = useState<Upload[]>([]);
    const [status, setStatus] = useState<UploadsValue["status"]>("idle");
    const [pending, setPending] = useState<PendingUpload[]>([]);
    const [messages, setMessages] = useState<UploadMessage[]>([]);
    const [removed, setRemoved] = useState<Upload | null>(null);
    // Keys for pending tiles and messages (crypto.randomUUID needs HTTPS; the LAN app is HTTP).
    const nextKey = useRef(0);
    const removal = useRef<{ upload: Upload; timer: ReturnType<typeof setTimeout> } | null>(null);

    const say = useCallback((text: string, tone: UploadMessage["tone"]) => {
        const key = ++nextKey.current;
        setMessages((current) => [...current, { key, text, tone }]);
    }, []);

    // State is only set after the request, so effects can call this. Until the first
    // answer the status stays "idle", which the pickers show as loading.
    const refresh = useCallback(async () => {
        try {
            const response = await fetch("/api/uploads", { cache: "no-store" });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const { uploads } = (await response.json()) as { uploads: Upload[] };
            setList(uploads);
            setStatus("ready");
        } catch (error) {
            console.error("Unable to load uploads:", error);
            setStatus((current) => (current === "ready" ? current : "error"));
        }
    }, []);

    /** Deletes the upload waiting in the undo window now. */
    const commitRemoval = useCallback(() => {
        const current = removal.current;
        if (!current) return;
        clearTimeout(current.timer);
        removal.current = null;
        setRemoved(null);
        setList((items) => items.filter((item) => item.id !== current.upload.id));
        deleteOnServer(current.upload.id).catch((error) => {
            console.error("Unable to remove upload:", error);
            setList((items) => (items.some((item) => item.id === current.upload.id) ? items : [current.upload, ...items]));
            say(`Couldn't remove “${current.upload.name}”. Try again.`, "error");
        });
    }, [say]);

    const remove = useCallback(
        (upload: Upload) => {
            commitRemoval();
            removal.current = { upload, timer: setTimeout(commitRemoval, UNDO_MS) };
            setRemoved(upload);
        },
        [commitRemoval],
    );

    const undo = useCallback(() => {
        if (!removal.current) return;
        clearTimeout(removal.current.timer);
        removal.current = null;
        setRemoved(null);
    }, []);

    // Leaving the page finishes a pending removal instead of dropping it.
    useEffect(() => {
        window.addEventListener("pagehide", commitRemoval);
        return () => {
            window.removeEventListener("pagehide", commitRemoval);
            commitRemoval();
        };
    }, [commitRemoval]);

    const upload = useCallback(
        async (files: File[]) => {
            setMessages([]);
            const accepted: { file: File; key: number }[] = [];
            for (const file of files) {
                if (!isSvgFile(file)) say(`“${file.name}” isn't an SVG file.`, "error");
                else if (file.size > UPLOAD_MAX_BYTES) say(`“${file.name}” is larger than ${UPLOAD_MAX_LABEL}.`, "error");
                else accepted.push({ file, key: ++nextKey.current });
            }
            if (!accepted.length) return null;
            setPending((current) => [...current, ...accepted.map(({ file, key }) => ({ key, name: file.name }))]);

            let saved: Upload | null = null;
            for (const { file, key } of accepted) {
                try {
                    const response = await fetch(`/api/uploads?name=${encodeURIComponent(file.name)}`, {
                        method: "POST",
                        headers: { "Content-Type": "image/svg+xml" },
                        body: file,
                    });
                    const data = (await response.json().catch(() => ({}))) as { upload?: Upload; notes?: UploadNote[]; error?: string };
                    if (!response.ok || !data.upload) {
                        // 422 and 409 messages already name the file.
                        const named = response.status === 422 || response.status === 409;
                        say(named && data.error ? data.error : `Couldn't upload “${file.name}”${data.error ? `: ${data.error}` : "."}`, "error");
                    } else {
                        const added = data.upload;
                        saved = added;
                        setList((items) => [added, ...items]);
                        for (const note of data.notes ?? []) say(`“${added.name}”: ${UPLOAD_NOTE_TEXT[note]}`, "note");
                    }
                } catch {
                    say(`Couldn't upload “${file.name}”. Check the connection and try again.`, "error");
                } finally {
                    setPending((current) => current.filter((item) => item.key !== key));
                }
            }
            return accepted.length === 1 ? saved : null;
        },
        [say],
    );

    const dismissMessage = useCallback((key: number) => setMessages((current) => current.filter((message) => message.key !== key)), []);

    const visible = useMemo(() => (removed ? list.filter((item) => item.id !== removed.id) : list), [list, removed]);

    const value = useMemo<UploadsValue>(
        () => ({ list: visible, status, pending, messages, removed, refresh, upload, remove, undo, dismissMessage }),
        [visible, status, pending, messages, removed, refresh, upload, remove, undo, dismissMessage],
    );

    return <UploadsContext.Provider value={value}>{children}</UploadsContext.Provider>;
}

export function useUploads() {
    const value = useContext(UploadsContext);
    if (!value) throw new Error("useUploads must be used inside UploadsProvider.");
    return value;
}
