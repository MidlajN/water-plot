"use client";

import {
  createContext,
  useContext,
  useState,
  type Dispatch,
  type PropsWithChildren,
  type SetStateAction,
} from "react";

import { DEFAULT_FONT_ID } from "../text/fonts";

/** Font size of new text, in canvas px (96 per inch, like the exported SVG). */
export const DEFAULT_FONT_SIZE = 80;

export type EditorTool =
  | "Select"
  | "Text"
  | "Pen"
  | "Elements";

/** Shape drawn by the Elements tool. */
export type DrawingElement = "line" | "rectangle" | "circle" | "triangle";

interface EditorContextValue {
  tool: EditorTool;
  setTool: Dispatch<SetStateAction<EditorTool>>;

  element: DrawingElement;
  setElement: Dispatch<SetStateAction<DrawingElement>>;

  /** Id of the single-line font used for new text. */
  fontFamily: string;
  setFontFamily: Dispatch<SetStateAction<string>>;

  /** Font size used for new text, in canvas px. */
  fontSize: number;
  setFontSize: Dispatch<SetStateAction<number>>;
}

const EditorContext = createContext<EditorContextValue | null>(null);

export function EditorProvider({ children }: PropsWithChildren) {
    const [tool, setTool] = useState<EditorTool>("Select");
    const [element, setElement] = useState<DrawingElement>("rectangle");
    const [fontFamily, setFontFamily] = useState(DEFAULT_FONT_ID);
    const [fontSize, setFontSize] = useState(DEFAULT_FONT_SIZE);

    return (
        <EditorContext.Provider
            value={{
                tool,
                setTool,
                element,
                setElement,
                fontFamily,
                setFontFamily,
                fontSize,
                setFontSize,
            }}
        >
            {children}
        </EditorContext.Provider>
    );
}

export function useEditor() {
    const context = useContext(EditorContext);

    if (!context) {
        throw new Error("useEditor must be used within EditorProvider");
    }

    return context;
}