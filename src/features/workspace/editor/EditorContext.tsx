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

export type EditorTool =
  | "Select"
  | "Text"
  | "Pen"
  | "Lines"
  | "Elements"
  | "Drag"
  | "Plot";

export type DrawingElement = "rectangle" | "circle" | "triangle";

interface EditorContextValue {
  tool: EditorTool;
  setTool: Dispatch<SetStateAction<EditorTool>>;

  element: DrawingElement;
  setElement: Dispatch<SetStateAction<DrawingElement>>;

  /** Id of the single-line font used for new text. */
  fontFamily: string;
  setFontFamily: Dispatch<SetStateAction<string>>;
}

const EditorContext = createContext<EditorContextValue | null>(null);

export function EditorProvider({ children }: PropsWithChildren) {
    const [tool, setTool] = useState<EditorTool>("Select");
    const [element, setElement] = useState<DrawingElement>("rectangle");
    const [fontFamily, setFontFamily] = useState(DEFAULT_FONT_ID);

    return (
        <EditorContext.Provider
            value={{
                tool,
                setTool,
                element,
                setElement,
                fontFamily,
                setFontFamily,
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