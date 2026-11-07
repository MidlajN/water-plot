// preloading all the control icons and cache them

import ReactDOMServer from "react-dom/server";

let iconCache = {};

export const preloadIcon = (Component, name) => {
    return new Promise((resolve) => {
        const svgString = ReactDOMServer.renderToStaticMarkup(<Component />);
        const blob = new Blob([svgString], { type: "image/svg+xml" });
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
            URL.revokeObjectURL(url);
            iconCache[name] = img;
            resolve();
        };
        img.src = url;
    });
};

export const getIcon = (name) => iconCache[name]