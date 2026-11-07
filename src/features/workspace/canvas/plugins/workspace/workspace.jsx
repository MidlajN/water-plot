import { util,  Rect, iMatrix, Point, Canvas, ActiveSelection, Group, Path, Line, loadSVGFromString } from "fabric";
import throttle from "lodash.throttle";
import FontFaceObserver from "fontfaceobserver";

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
        this.dragMode = false;
        this.undoStack = [];
        this.redoStack = [];
        this.isUndoRedo = false;
        this.listeners = {};
        this.eventHandlers = {
            handleKeydown: this.handleKeydown.bind(this),
            highlightObj: this.hightlightObject.bind(this),
            saveState: this.saveState.bind(this)
        }

        this.initCanvas();
        this.initHistory();
        this.initWorkspace();
        this.initResizeObserver();
        this.initObjectBorder()
        this.initDrag();
        this.bindMouseWheel();
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

        window.addEventListener('beforeunload', () => {
            localStorage.setItem('polyPlotCanvas', JSON.stringify(this.canvas.toJSON()));
        });

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

    initDrag() {
        this.canvas.on('mouse:down', (evt) => {
            const event = evt.e;
            if (this.dragMode) {
                this.canvas.setCursor('grabbing');
                this.canvas.discardActiveObject();

                this.canvas.selection = false;
                this.canvas.getObjects().forEach(obj => {
                    obj.selectable = false
                });

                this.isDragging = true;
                this.lastPosX = event.clientX;
                this.lastPosY = event.clientY;
                this.canvas.renderAll();
            }
        });

        this.canvas.on('mouse:move', (evt) => {
            const event = evt.e;
            if (this.dragMode) this.canvas.setCursor('grab')
            if (this.isDragging) {
                if (!this.canvas.viewportTransform) return;
                this.canvas.setCursor('grabbing');
                this.canvas.discardActiveObject();

                const viewPort = this.canvas.viewportTransform;
                viewPort[4] += event.clientX - this.lastPosX;
                viewPort[5] += event.clientY - this.lastPosY;
                this.lastPosX = event.clientX;
                this.lastPosY = event.clientY;
                this.canvas.renderAll()
            }
        });

        this.canvas.on('mouse:up', () => {
            if (this.dragMode) {
                if (!this.canvas.viewportTransform) return;
                this.canvas.setViewportTransform(this.canvas.viewportTransform);
                this.isDragging = false;
                this.canvas.setCursor('grab');

                if (this.toolRef.current !== 'Select') return;

                this.canvas.selection = true;
                this.canvas.getObjects().forEach(obj => {
                    if (obj.name !== 'workspace' && obj.hasControls) {
                        obj.selectable = true
                    }
                });
            }
        });
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
        // if (this.undoStack.length <= 1 || this.toolRef.current !== 'Select') return;
        if (this.undoStack.length <= 1) return;

        this.isUndoRedo = true;
        const currentState = this.undoStack.pop();
        this.redoStack.push(currentState);

        const prevState = this.undoStack[this.undoStack.length - 1];

        this.canvas.loadFromJSON(prevState).then(() => {
            this.canvas.getObjects().forEach(obj => {
                if (obj.name === 'workspace') {
                    obj.selectable = false;
                    obj.hasControls = false;
                    obj.setCoords();
                    this.workspace = obj;
                }
            });
            this.isUndoRedo = false;
            this.canvas.renderAll()
        })
    }

    redo() {
        // if (this.redoStack.length === 0 || this.toolRef.current !== 'Select') return;
        if (this.redoStack.length === 0) return;

        this.isUndoRedo = true;
        const state = this.redoStack.pop();
        this.undoStack.push(state);

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
        })
    }

    loadFromFiles(file, color) {
        if (file && file.type !== 'image/svg+xml') return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            const svg = e.target.result;

            const loadedSvg = await loadSVGFromString(svg);
            loadedSvg.objects.forEach(obj => {
                obj.set({
                    stroke: color,
                    strokeWidth: 2,
                    fill: 'transparent'
                });
            });

            const svgObj = util.groupSVGElements(loadedSvg.objects, loadedSvg.options);
            this.canvas.add(svgObj);
            this.canvas.renderAll();
        }
        reader.readAsText(file);
    }

    async loadFromJSON() {
        const savedCanvas = localStorage.getItem('polyPlotCanvas');
        if (!savedCanvas) return;

        const fontPromises = [];
        const fontSet = new Set();
        const parsedCanvas = JSON.parse(savedCanvas);
        const objects = parsedCanvas.objects;

        objects.forEach(obj => {
            if (obj.type === 'IText' && obj.fontFamily && !fontSet.has(obj.fontFamily)) {
                fontSet.add(obj.fontFamily);
                const font = new FontFaceObserver(obj.fontFamily);
                fontPromises.push(font.load(null, 15000));
            }
        });

        try {
            await Promise.all(fontPromises);

            const refinedObjects = parsedCanvas.objects.map(obj => {
                if (obj.type === 'IText') {
                    obj.cursorColor = 'black';
                    if (!obj.fontFamily || obj.fontFamily === 'undefined') { obj.fontFamily = 'Arial' }
                }
                return obj
            });

            parsedCanvas.objects = refinedObjects;

            this.canvas.loadFromJSON(parsedCanvas).then(() => {
                this.canvas.getObjects().forEach((obj) => {
                    if (obj.name === 'workspace') {
                        this.workspace = obj;
                        const orientation = obj.width > obj.height ? 'horizontal' : 'vertical';
                        this.setConfig(prev => ({
                            ...prev,
                            orientation: orientation,
                            width: parseFloat(obj.width * 25.4 / 96).toFixed(1),
                            height: parseFloat(obj.height * 25.4 / 96).toFixed(1)
                        }));
                        obj.set('selectable', false);
                        obj.set('hasControls', false);
                    }

                    obj.setCoords();
                })
            })
        } catch (err) {
            console.log('Error Occured in the workspace loadFromJSON : ', err)
        }
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


    startDrag() {
        this.dragMode = true;
        this.canvas.setCursor('grab')
        this.emit('dragMode', true)
        this.canvas.renderAll();
    }

    endDrag() {
        this.dragMode = false;
        this.canvas.setCursor('default');
        this.isDragging = false;
        this.emit('dragMode', false)
        this.canvas.renderAll();
    }

    bindMouseWheel() {
        this.canvas.on('mouse:wheel', (event) => {
            let zoom = this.canvas.getZoom();
            zoom *= 0.999 ** event.e.deltaY;
            zoom = Math.min(Math.max(zoom, 0.05), 20);

            const pointer = this.canvas.getPointer(event.e, true);
            this.canvas.zoomToPoint(
                new Point(
                    parseFloat(pointer.x.toFixed(2)),
                    parseFloat(pointer.y.toFixed(2)),
                ), zoom
            )
            event.e.preventDefault();
            event.e.stopPropagation()
        })
    }

    bindHotKeys() {
        window.addEventListener('keydown', this.eventHandlers.handleKeydown);

        window.addEventListener('keydown', (e) => {
            if (e.code === 'Space') {
                if (!this.dragMode) {
                    const active = this.canvas.getActiveObject();
                    if (active && active.isEditing === true) return
                    this.startDrag()
                }
            }
        });
        window.addEventListener('keyup', (e) => {
            if (e.code === 'Space') {
                this.endDrag()
            }
        });
    }

    handleKeydown(e) {
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
            case isCtrl && key === 'g' && e.shiftKey:
                e.preventDefault();
                this.handleSplit();
                break;
            case isCtrl && key === 'g':
                e.preventDefault();
                this.handleGroup();
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

    handleGroup() {
        const activeObject = this.canvas.getActiveObject();
        if (!activeObject || activeObject.get('type') !== 'activeselection') return;

        const objects = activeObject.getObjects();
        const firstStroke =objects[0].stroke;
        const allSameStroke = objects.every(obj => obj.stroke === firstStroke);
        this.canvas.off('object:removed', this.eventHandlers.saveState)
        objects.forEach(obj => this.canvas.remove(obj));
        this.canvas.discardActiveObject()

        const group = new Group(objects, { subTargetCheck: true, stroke: allSameStroke ? firstStroke : '' });
        this.canvas.add(group);
        this.canvas.setActiveObject(group)
        this.canvas.on('object:removed', this.eventHandlers.saveState);
        this.canvas.renderAll();
    }

    handleSplit() {
        const activeObject = this.canvas.getActiveObject();
        if (!activeObject || activeObject.get('type') === 'activeselection' || activeObject.isFreeDraw) return;

        if (activeObject.get('type') === 'group') {
            this.canvas.add(...activeObject.removeAll());
            this.canvas.remove(activeObject);
        } else {
            const type = activeObject.get('type');
            const strokeColor = activeObject.stroke;
            let fabricPaths = [];

            const createPath = (path) => {
                const fabricPath = new Path(path, {
                    selectable: true,
                    hasControls: true,
                    fill: 'transparent',
                    stroke: strokeColor,
                    strokeWidth: 2
                })
                fabricPaths.push(fabricPath);
            }

            const createLine = (x,y, x1, y1) => {
                const line = new Line([ x,y, x1, y1 ], {
                    selectable: true,
                    hasControls: true,
                    fill: 'transparent',
                    stroke: strokeColor,
                    strokeWidth: 2,
                });
                fabricPaths.push(line)
            }

            switch (type) {
                case 'path': {
                    const paths = activeObject.path;
                    fabricPaths = [];

                    const multipleMFound = () => {
                        let firstMFound = false;
                        for (let path of paths) {
                            if (path[0] === 'M' && path.length === 3) {
                                if (firstMFound) return true;
                                else firstMFound = true
                            }
                        }
                        return false;
                    }

                    if (multipleMFound()) {
                        const mainArray = [];
                        let subArray = [];

                        for (let i = 0; i < paths.length; i++) {
                            const pathLine = paths[i] ? paths[i].join(' ') : null;
                            const command = paths[i] ? paths[i][0] : null;

                            if (command === 'M' || i === paths.length) {
                                if (subArray.length) mainArray.push(subArray.join(' '));
                                subArray = [];
                            }
                            subArray.push(pathLine);
                        }
                        for (let i = 0; i < mainArray.length; i++) {
                            if (mainArray[i] !== null) createPath(mainArray[i])
                        }
                    } else {
                        // Single M, Each Path need to have an M command and its command
                        let lastX = 0;
                        let lastY = 0;
                        let mainMX = 0;
                        let mainMY = 0;

                        for (let i = 0; i < paths.length; i++) {
                            const command = paths[i][0];
                            let newLine = null;

                            if (command === 'M') {
                                lastX = paths[i][1];
                                lastY = paths[i][2];
                                mainMX = paths[i][1];
                                mainMY = paths[i][2];
                            } else if (command === 'Z') {
                                if (mainMX === lastX && mainMY === lastY) continue;
                                newLine = `M ${lastX} ${lastY} L ${mainMX} ${mainMY}`;
                            } else {
                                newLine = `M ${lastX} ${lastY} ${paths[i].join(' ')}`;
                                lastX = paths[i][paths[i].length - 2];
                                lastY = paths[i][paths[i].length - 1];
                            }

                            if (newLine) createPath(newLine);
                        }

                    }
                    break;
                }
                    
                case 'rect': {
                    fabricPaths = [];
                    const topLeft = { x: activeObject.left, y: activeObject.top };
                    const topRight = { x: activeObject.left + activeObject.width, y: activeObject.top };
                    const bottomLeft = { x: activeObject.left, y: activeObject.top + activeObject.height };
                    const bottomRight = { x: activeObject.left + activeObject.width, y: activeObject.top + activeObject.height }; 

                    createLine(topLeft.x, topLeft.y, topRight.x, topRight.y);
                    createLine(topRight.x, topRight.y, bottomRight.x, bottomRight.y);
                    createLine(bottomRight.x, bottomRight.y,  bottomLeft.x, bottomLeft.y);
                    createLine(bottomLeft.x, bottomLeft.y, topLeft.x, topLeft.y);
                    break;
                }

                case 'polygon': {
                    fabricPaths = []
                    const points = activeObject.points;

                    for (let i=0; i < points.length; i++) {
                        const start = points[i];
                        const end = points[(i + 1) % points.length];
                        createLine(start.x, start.y, end.x, end.y)
                    }
                    break;
                }

                case 'triangle': {
                    fabricPaths = [];
                    let left = activeObject.left;
                    let top = activeObject.top;
                    let width = activeObject.width;
                    let height = activeObject.height;

                    let topX = left + width / 2;
                    let topY = top;

                    let bottomLeftX = left;
                    let bottomLeftY = top + height;

                    let bottomRightX = left + width;
                    let bottomRightY = top + height;

                    createLine(topX, topY, bottomLeftX, bottomLeftY);
                    createLine(bottomLeftX, bottomLeftY, bottomRightX, bottomRightY);
                    createLine(bottomRightX, bottomRightY, topX, topY);
                    break;
                }
  
                default:
                    break;
            }

            if (fabricPaths.length === 0) return;

            this.canvas.off('object:added', this.eventHandlers.saveState);
            const group = new Group(fabricPaths);
            group.set({
                left: activeObject.left,
                top: activeObject.top,
                scaleX: activeObject.scaleX,
                scaleY: activeObject.scaleY,
                angle: activeObject.angle,
            });
            group.setCoords();

            const objects = [...group.removeAll()];
            this.canvas.add(...objects);
            this.canvas.remove(activeObject);
            this.canvas.on('object:added', this.eventHandlers.saveState);
        }
        this.canvas.renderAll()
    }

    setZoomAuto() {
        const elWidth = this.container.offsetWidth;
        const elHeight = this.container.offsetHeight;
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

    zoomIn() {
        let zoom = this.canvas.getZoom();
        zoom += 0.05;

        const center = this.canvas.getCenterPoint();
        this.canvas.zoomToPoint(new Point(center.x, center.y), zoom)
    }

    zoomOut() {
        let zoom = this.canvas.getZoom();
        zoom -= 0.05;

        const center = this.canvas.getCenterPoint();
        this.canvas.zoomToPoint(new Point(center.x, center.y), zoom < 0 ? 0.01 : zoom)
    }

    destroy() {
        if (this.observer && this.container) this.observer.disconnect(this.container);
        
        window.removeEventListener('keydown', this.eventHandlers.handleKeydown);
        this.canvas.off('mouse:wheel');

        this.canvas.off('object:moving', this.eventHandlers.highlightObj);
        this.canvas.off('object:scaling', this.eventHandlers.highlightObj);
        this.canvas.off('object:rotating', this.eventHandlers.highlightObj);
        this.canvas.off('selection:created', this.eventHandlers.highlightObj);
        this.canvas.off('selection:updated', this.eventHandlers.highlightObj);

        this.canvas.off('object:added', this.eventHandlers.saveState);
        this.canvas.off('object:modified', this.eventHandlers.saveState);
        this.canvas.off('object:removed', this.eventHandlers.saveState);

        window.removeEventListener('beforeunload', () => localStorage.setItem('polyPlotCanvas', JSON.stringify(this.canvas.toJSON())))

        this.canvas.dispose()
    }

    getCanvas() {
        return this.canvas;
    }

    getWorkspace() {
        return this.workspace;
    }

    // Event Listener
    on(event, callback) {
        if (!this.listeners[event]) {
            this.listeners[event] = []
        }
        this.listeners[event].push(callback);
    }

    off(event, callback) {
        if (this.listeners[event]) {
            this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
        }
    }

    emit (event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(callback => callback(data))
        }
    }

}