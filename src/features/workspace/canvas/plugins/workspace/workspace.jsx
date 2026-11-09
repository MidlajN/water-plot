import { util, Rect, iMatrix, Point, Canvas, ActiveSelection } from "fabric";
import throttle from "lodash.throttle";
import { SingleLineText } from "../../../text/SingleLineText";
import { DEFAULT_FONT_ID, hasSingleLineFont } from "../../../text/fonts";

const LEGACY_TEXT_TYPES = ['IText', 'i-text', 'Text', 'text', 'Textbox', 'textbox'];

/** Saved canvases from before single-line fonts stored outline text; redraw it as single-line text. */
function toSingleLineTextJSON(obj) {
    if (!LEGACY_TEXT_TYPES.includes(obj.type)) return obj;

    return {
        ...obj,
        type: SingleLineText.type,
        fontFamily: hasSingleLineFont(obj.fontFamily) ? obj.fontFamily : DEFAULT_FONT_ID,
        fill: '',
        styles: [],
    };
}

export class Workspace {
    constructor(canvasRef, canvasConfig, setCanvasConfig, containerRef, toolRef) {
        this.config = canvasConfig;
        this.setConfig = setCanvasConfig;
        this.container = containerRef.current;
        this.canvasRef = canvasRef;
        this.toolRef = toolRef;
        this.observer = null;
        this.canvas = null;
        this.copiedObject = null;
        this.zoomRatio = 0.75;
        // When false (another app mode is showing), keyboard shortcuts leave the canvas alone.
        this.active = true;
        this.undoStack = [];
        this.redoStack = [];
        this.isUndoRedo = false;
        this.eventHandlers = {
            handleKeydown: this.handleKeydown.bind(this),
            highlightObj: this.hightlightObject.bind(this),
            saveState: this.saveState.bind(this),
            blockWheel: (e) => e.preventDefault(),
            persist: () => localStorage.setItem('polyPlotCanvas', JSON.stringify(this.canvas.toJSON())),
        }

        this.initCanvas();
        this.initHistory();
        this.initWorkspace();
        this.initResizeObserver();
        this.initObjectBorder()
        this.lockViewport();
        this.bindHotKeys();
    }

    initCanvas() {
        this.canvas = new Canvas(this.canvasRef.current, {
            fireRightClick: true,
            stopContextMenu: true,
            centeredRotation: true,
            perPixelTargetFind: true,
            targetFindTolerance: 12
        });

        window.addEventListener('beforeunload', this.eventHandlers.persist);

        if (window.opener) window.opener.postMessage({ type: 'RECEIVER_READY' }, '*')
    }

    initWorkspace() {
        const workspace = new Rect({
            fill: 'rgba(255,255,255,1)',
            width: util.parseUnit(`${ this.config.width }mm`),
            height: util.parseUnit(`${ this.config.height }mm`),
            id: 'workspace',
            strokeWidth: 0.1,
            name: 'workspace',
            selectable: false,
            hasControls: false,
        });
        this.canvas.add(workspace);
        this.workspace = workspace;

        this.canvas.backgroundImage = '';
        this.canvas.setWidth(util.parseUnit(`${ this.container.offsetWidth }px`));
        this.canvas.setHeight(util.parseUnit(`${ this.container.offsetHeight }px`));
        this.canvas.renderAll()
    }

    initResizeObserver() {
        this.resizeHandler = throttle(() => {
            this.setZoomAuto();
        }, 50);

        this.observer = new ResizeObserver(this.resizeHandler);
        this.observer.observe(this.container);
    }

    initObjectBorder() {
        this.canvas.on('object:modified', this.eventHandlers.highlightObj);
        this.canvas.on('object:moving', this.eventHandlers.highlightObj);
        this.canvas.on('object:scaling', this.eventHandlers.highlightObj);
        this.canvas.on('object:rotating', this.eventHandlers.highlightObj);
        this.canvas.on('selection:created', this.eventHandlers.highlightObj);
        this.canvas.on('selection:updated', this.eventHandlers.highlightObj)
    }

    initHistory() {
        this.canvas.on('object:added', this.eventHandlers.saveState);
        this.canvas.on('object:modified', this.eventHandlers.saveState);
        this.canvas.on('object:removed', this.eventHandlers.saveState);
    }

    saveState() {
        if (this.isUndoRedo || this.canvas.getObjects().length === 0) return

        const currentState = JSON.stringify(this.canvas);
        const lastState = this.undoStack[this.undoStack.length - 1];
        if (lastState === currentState) return;


        this.undoStack.push(currentState);
        if (this.undoStack.length > 25) this.undoStack.shift();
        this.redoStack = [];
    }

    undo() {
        if (this.undoStack.length <= 1) return;

        this.redoStack.push(this.undoStack.pop());
        this.restoreState(this.undoStack[this.undoStack.length - 1]);
    }

    redo() {
        if (this.redoStack.length === 0) return;

        const state = this.redoStack.pop();
        this.undoStack.push(state);
        this.restoreState(state);
    }

    /** Loads a history snapshot without recording it as a new change. */
    restoreState(state) {
        this.isUndoRedo = true;
        this.canvas.loadFromJSON(state).then(() => {
            this.canvas.getObjects().forEach(obj => {
                if (obj.name === 'workspace') {
                    obj.selectable = false;
                    obj.hasControls = false;
                    obj.setCoords();
                    this.workspace = obj;
                }
            });
            this.isUndoRedo = false;
            this.canvas.renderAll();
        });
    }

    /**
     * Restores the drawing saved when the page was last closed or reloaded. The restored
     * drawing becomes the start of the undo history. A missing or unreadable save leaves
     * the blank page in place.
     */
    async loadFromJSON() {
        let saved;
        try {
            saved = JSON.parse(localStorage.getItem('polyPlotCanvas') ?? 'null');
        } catch (err) {
            console.warn('Ignoring unreadable saved canvas:', err);
            return;
        }
        if (!Array.isArray(saved?.objects) || !saved.objects.some((obj) => obj.name === 'workspace')) return;

        saved.objects = saved.objects.map(toSingleLineTextJSON);

        this.isUndoRedo = true;
        try {
            await this.canvas.loadFromJSON(saved);
        } catch (err) {
            console.warn('Could not restore saved canvas:', err);
        }

        this.canvas.getObjects().forEach((obj) => {
            if (obj.name === 'workspace') {
                this.workspace = obj;
                obj.set({ selectable: false, hasControls: false });
                this.setConfig((prev) => ({
                    ...prev,
                    orientation: obj.width > obj.height ? 'horizontal' : 'vertical',
                    width: Number((obj.width * 25.4 / 96).toFixed(1)),
                    height: Number((obj.height * 25.4 / 96).toFixed(1)),
                }));
            }
            obj.setCoords();
        });

        this.isUndoRedo = false;
        this.undoStack = [JSON.stringify(this.canvas)];
        this.redoStack = [];
        this.setZoomAuto();
    }

    hightlightObject() {
        const selectedObject = this.canvas.getActiveObjects();
        const outsideBox = (obj) => {
            const objBounds = obj.getBoundingRect(true);
            const wsBounds = this.workspace.getBoundingRect(true);

            return (
                objBounds.left < wsBounds.left ||
                objBounds.top < wsBounds.top ||
                objBounds.left + objBounds.width > wsBounds.left + wsBounds.width ||
                objBounds.top + objBounds.height > wsBounds.top + wsBounds.height
            )
        }

        selectedObject.forEach(obj => {
            if (outsideBox(obj)) {
                obj.borderColor = '#FF8A8A'
            } else {
                obj.borderColor = '#43cad4'
            }
        });
        this.canvas.renderAll()
    }


    /**
     * The view always fits the page: no wheel zoom, no panning. Wheel events over the
     * canvas are swallowed so Ctrl+wheel or a trackpad pinch doesn't zoom the whole page.
     */
    lockViewport() {
        this.container.addEventListener('wheel', this.eventHandlers.blockWheel, { passive: false });
    }

    bindHotKeys() {
        window.addEventListener('keydown', this.eventHandlers.handleKeydown);
    }

    /** Enables or disables keyboard shortcuts, e.g. while the editor is hidden. */
    setActive(active) {
        this.active = active;
    }

    handleKeydown(e) {
        if (!this.active) return;
        const key = e.key.toLowerCase();
        const isCtrl = e.ctrlKey || e.metaKey;
        const activeEl = document.activeElement;

        if (['input', 'textarea'].includes(activeEl.tagName.toLowerCase())) return;

        switch (true) {
            case isCtrl && key === 'c':
                this.handleCopy()
                break;
            case isCtrl && key === 'v':
                this.handlePaste();
                break;
            case key === 'delete' || key === 'backspace':
                e.preventDefault();
                this.handleDelete();
                break;
            case isCtrl && key === 'a':
                e.preventDefault();
                this.handleSelectAll();
                break;
            case isCtrl && key === 'z':
                this.undo();
                break;
            case isCtrl && key === 'y':
                this.redo();
                break;
            case key === 'arrowright':
                this.moveActiveObject(1, 0);
                break;
            case key === 'arrowleft':
                this.moveActiveObject(-1, 0);
                break;
            case key === 'arrowup':
                this.moveActiveObject(0, -1);
                break;
            case key === 'arrowdown':
                this.moveActiveObject(0, 1);
                break;
            default:
                break;
        }
    }

    moveActiveObject(dx, dy) {
        const obj = this.canvas.getActiveObject();
        if (!obj) return;

        obj.set({ left: obj.left + dx, top: obj.top + dy });
        obj.setCoords();
        
        this.canvas.fire('object:modified')
        this.canvas.renderAll()
    }

    handleCopy() {
        this.canvas.getActiveObject().clone().then((clonedObj) => {
            this.copiedObject = clonedObj;
        });
    }

    handlePaste() {
        if (!this.copiedObject) return;

        this.canvas.add(this.copiedObject);
        this.canvas.setActiveObject(this.copiedObject);

        this.copiedObject.clone().then((clonedObj) => {
            this.copiedObject = clonedObj;
        });
        this.canvas.renderAll()
    }

    handleDelete() {
        const activeObject = this.canvas.getActiveObject();
        if (!activeObject) return;
        this.canvas.off('object:removed', this.eventHandlers.saveState);

        if (activeObject.get('type') === 'activeselection') {
            activeObject.forEachObject((obj) => {
                this.canvas.remove(obj);
            })
        } else {
            this.canvas.remove(activeObject);
        }
        this.canvas.on('object:removed', this.eventHandlers.saveState);
        this.canvas.fire('object:removed');

        this.canvas.discardActiveObject();
        this.canvas.renderAll()
    }

    handleSelectAll() {
        if (this.toolRef.current !== 'Select') return;
        this.canvas.discardActiveObject();
        const objects = this.canvas.getObjects().filter(obj => obj.get("name") !== 'workspace');
        if (objects.length < 1) return;

        const selection = new ActiveSelection(objects, { canvas: this.canvas });
        this.canvas.setActiveObject(selection);
        this.canvas.renderAll()
    }

    setZoomAuto() {
        const elWidth = this.container.offsetWidth;
        const elHeight = this.container.offsetHeight;
        // Hidden (another app mode is showing): keep the last fit until it is visible again.
        if (!elWidth || !elHeight) return;
        const scale = util.findScaleToFit(this.workspace, { width: elWidth , height: elHeight  });

        this.canvas.setWidth(util.parseUnit(`${ elWidth }px`));
        this.canvas.setHeight(util.parseUnit(`${ elHeight }px`));

        const center = this.canvas.getCenterPoint();
        this.canvas.setViewportTransform(iMatrix.concat());
        this.canvas.zoomToPoint(new Point(center.x, center.y), scale * this.zoomRatio)

        const wsCenter = this.workspace.getCenterPoint();
        const vt = this.canvas.viewportTransform;

        if (this.canvas.width === undefined || this.canvas.height === undefined || !vt) return;
        vt[4] = this.canvas.width / 2 - wsCenter.x * vt[0];
        vt[5] = this.canvas.height / 2 - wsCenter.y * vt[3];
        this.canvas.setViewportTransform(vt);

        this.canvas.renderAll()
    }

    destroy() {
        if (this.observer && this.container) this.observer.disconnect(this.container);
        
        window.removeEventListener('keydown', this.eventHandlers.handleKeydown);
        this.container?.removeEventListener('wheel', this.eventHandlers.blockWheel);

        this.canvas.off('object:modified', this.eventHandlers.highlightObj);
        this.canvas.off('object:moving', this.eventHandlers.highlightObj);
        this.canvas.off('object:scaling', this.eventHandlers.highlightObj);
        this.canvas.off('object:rotating', this.eventHandlers.highlightObj);
        this.canvas.off('selection:created', this.eventHandlers.highlightObj);
        this.canvas.off('selection:updated', this.eventHandlers.highlightObj);

        this.canvas.off('object:added', this.eventHandlers.saveState);
        this.canvas.off('object:modified', this.eventHandlers.saveState);
        this.canvas.off('object:removed', this.eventHandlers.saveState);

        window.removeEventListener('beforeunload', this.eventHandlers.persist);

        this.canvas.dispose()
    }

    getCanvas() {
        return this.canvas;
    }

    getWorkspace() {
        return this.workspace;
    }
}
