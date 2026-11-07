/* eslint-disable react-refresh/only-export-components */
// context/canvas/plugins/setFabricDefaults.js
import { Control, controlsUtils, FabricObject, util } from "fabric";
import { getIcon, preloadIcon } from "./iconCache";
import { EdgeIcon, HorizontalIcon, RotateIcon, VerticalIcon } from "./icons";

export const setFabricDefaults = () => {
  FabricObject.ownDefaults.cornerStyle = 'circle';
  FabricObject.ownDefaults.cornerColor = '#7f77eb85';
  FabricObject.ownDefaults.transparentCorners = false;
  FabricObject.ownDefaults.cornerSize = 15;
  FabricObject.ownDefaults.borderScaleFactor = 2;
  FabricObject.ownDefaults.noScaleCache = true;
  FabricObject.ownDefaults.strokeUniform = true;
  FabricObject.ownDefaults.borderOpacityWhenMoving = 1;
  FabricObject.ownDefaults.cornerStrokeColor = '#0E98FC';
  FabricObject.ownDefaults.borderColor = '#43cad4'
  FabricObject.customProperties = ['name'];
};

export const preloadAllIcons = async () => {
  await Promise.all([
    preloadIcon(VerticalIcon, 'vertical'),
    preloadIcon(HorizontalIcon, 'horizontal'),
    preloadIcon(EdgeIcon, 'edge'),
    preloadIcon(RotateIcon, 'rotate')
  ]);
};

export const defineControlPoints = () => {
  const verticalImg = getIcon('vertical');
  const horizontalImg = getIcon('horizontal');
  const edgeImg = getIcon('edge');
  const rotateImg = getIcon('rotate');

  function drawImg(ctx, left, top, img, wSize, hSize, angle){
    if (angle === undefined) return;

    ctx.save();
    ctx.translate(left, top);
    ctx.rotate(util.degreesToRadians(angle));
    ctx.drawImage(img, -wSize / 2, -hSize / 2, wSize, hSize);
    ctx.restore();
  }

  function renderIconVer(ctx, left, top, styleOverride, fabricObject) {
    drawImg(ctx, left, top, verticalImg, 20, 25, fabricObject.angle);
  }

  function renderIconHoz(ctx, left, top, styleOverride, fabricObject) {
    drawImg(ctx, left, top, horizontalImg, 25, 20, fabricObject.angle);
  }
  
  function renderIconEdge(ctx, left, top, styleOverride, fabricObject) {
    drawImg(ctx, left, top, edgeImg, 20, 20, fabricObject.angle);
  }

  function renderIconRotate(ctx, left, top, styleOverride, fabricObject) {
    drawImg(ctx, left, top, rotateImg, 30, 30, fabricObject.angle);
  }

  FabricObject.ownDefaults.controls = {
    ml: new Control({
      x: -0.5,
      y: 0,
      offsetX: -1,
      cursorStyleHandler: controlsUtils.scaleSkewCursorStyleHandler,
      actionHandler: controlsUtils.scalingXOrSkewingY,
      getActionName: controlsUtils.scaleOrSkewActionName,
      render: renderIconVer,
      // withConnection: true
    }),
    mr: new Control({
      x: 0.5,
      y: 0,
      offsetX: 1,
      cursorStyleHandler: controlsUtils.scaleSkewCursorStyleHandler,
      actionHandler: controlsUtils.scalingXOrSkewingY,
      getActionName: controlsUtils.scaleOrSkewActionName,
      render: renderIconVer,
      // withConnection: true
    }),
    mt: new Control({
      x: 0,
      y: -0.5,
      offsetY: -1,
      cursorStyleHandler: controlsUtils.scaleSkewCursorStyleHandler,
      actionHandler: controlsUtils.scalingYOrSkewingX,
      getActionName: controlsUtils.scaleOrSkewActionName,
      render: renderIconHoz,
      // withConnection: true
    }),
    mb: new Control({
      x: 0,
      y: 0.5,
      offsetY: 1,
      cursorStyleHandler: controlsUtils.scaleSkewCursorStyleHandler,
      actionHandler: controlsUtils.scalingYOrSkewingX,
      getActionName: controlsUtils.scaleOrSkewActionName,
      render: renderIconHoz,
      // withConnection: true
    }),
    tl: new Control({
      x: -0.5,
      y: -0.5,
      cursorStyleHandler: controlsUtils.scaleCursorStyleHandler,
      actionHandler: controlsUtils.scalingEqually,
      render: renderIconEdge,
    }),
    bl: new Control({
      x: -0.5,
      y: 0.5,
      cursorStyleHandler: controlsUtils.scaleCursorStyleHandler,
      actionHandler: controlsUtils.scalingEqually,
      render: renderIconEdge,
    }),
    tr: new Control({
      x: 0.5,
      y: -0.5,
      cursorStyleHandler: controlsUtils.scaleCursorStyleHandler,
      actionHandler: controlsUtils.scalingEqually,
      render: renderIconEdge,
    }),
    br: new Control({
      x: 0.5,
      y: 0.5,
      cursorStyleHandler: controlsUtils.scaleCursorStyleHandler,
      actionHandler: controlsUtils.scalingEqually,
      render: renderIconEdge,
    }),
    mtr: new Control({
      x: 0, 
      y: 0.5,
      cursorStyleHandler: controlsUtils.rotationStyleHandler,
      actionHandler: controlsUtils.rotationWithSnapping,
      offsetY: 30,
      actionName: 'rotate',
      render: renderIconRotate
    })
  }
}