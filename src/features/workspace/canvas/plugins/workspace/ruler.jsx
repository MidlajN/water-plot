import { Color } from "fabric";

export default class CanvasRuler {
    constructor(fabricCanvas) {
        this.canvas = fabricCanvas;
        this.option = {
            ruleSize: 20,
            fontSize: 10,
            enabled: false,
            backgroundColor: '#fff',
            borderColor: '#ddd',
            highlightColor: '#007fff',
            textColor: '#888',
        }
        this.enabled = false

        this.eventHandler = {
            renderRuler: function(e) {
              if (!e.ctx) return;
              this.renderRuler(); // 'this' here still refers to the class because of arrow function
            }.bind(this)
        };

    }

    rulerEnable() {
        this.canvas.on('after:render', this.eventHandler.renderRuler)
        this.renderRuler()
    }

    renderRuler() {
        const vpt = this.canvas.viewportTransform;
        if (!vpt) return;
        
        this.draw({
            isHorizontal: false,
            rulerLength: this.canvas.height,
            startCalibration: -(vpt[5] / vpt[3]),
        });   

        this.draw({
            isHorizontal: true, 
            rulerLength: this.canvas.width, 
            startCalibration: -(vpt[4] / vpt[0]),
        });
    }

    draw(opt) {
        const { isHorizontal, rulerLength, startCalibration } = opt
        const zoom = this.canvas.getZoom();
        const ruleSize = 20;
        const fontSize = 10

        const gap = this.getGap(zoom);
        // console.log('Gap : ', gap)
        const unitLength = rulerLength / zoom;
        const startValue = Math[startCalibration > 0 ? 'floor' : 'ceil'](startCalibration / gap) * gap;
        const startOffset = startValue - startCalibration;

        const canvasSize = { width: this.canvas.width ?? 0, height: this.canvas.height ?? 0}
        const ctx = this.canvas.getElement().getContext('2d')
          
        this.drawRect(ctx, {
            left: 0,
            top: 0,
            width: isHorizontal ? canvasSize.width : ruleSize,
            height: isHorizontal ? ruleSize : canvasSize.height,
            fill: '#fff',
            // stroke: '#ddd'
        });

        const textColor = new Color('#888');
        for (let i = 0; i + startOffset <= Math.ceil(unitLength); i += gap) {
            const position = (startOffset + i) * zoom;
            const textValue = startValue + i + '';
            const textLength = (10 * textValue.length) / 4;
            const textX = isHorizontal ? position - textLength - 1 : ruleSize / 2 - fontSize / 2;
            const textY = isHorizontal ? ruleSize / 2 - fontSize / 2 : position + textLength;

            this.drawText(ctx, {
                text: textValue,
                left: textX,
                top: textY,
                fill: textColor.toRgb(),
                angle: isHorizontal ? 0 : -90,
            });
        }

        for (let j = 0; j + startOffset < Math.ceil(unitLength); j += gap) {
            const position = Math.round((startOffset + j) * zoom);
            const left = isHorizontal ? position : ruleSize - 4;
            const top = isHorizontal ? ruleSize - 4: position;
            const width = isHorizontal ? 0 : 4;
            const height = isHorizontal ? 4 : 0;
            this.drawLine(ctx, {
                left,
                top,
                width,
                height,
                stroke: textColor.toRgb()
            })
        }

        const activeObect = this.canvas.getActiveObject()
        if (!activeObect) return;

        const boundingBox = activeObect.getBoundingRect()
        this.objectBox = boundingBox
        const axis = isHorizontal ? 'x' : 'y';

        this.drawObjectRuler(ctx, axis, zoom, startCalibration);
    }

    drawObjectRuler(ctx, axis, zoom, startCalibration) {
        const isHorizontal = axis === 'x' ? true : false;
        const ruleSize = 20;
        const fontSize = 10;

        const roundFactor = (x) => Math.round(x) + '';
        const leftValue = roundFactor(isHorizontal ? this.objectBox.left : this.objectBox.top);
        const rightValue = roundFactor(isHorizontal ? this.objectBox.left + this.objectBox.width : this.objectBox.top + this.objectBox.height)
        const isSameText = leftValue === rightValue;

        const leftWithOffset = (this.objectBox.left - startCalibration) * zoom;
        const topWithOffset = (this.objectBox.top - startCalibration) * zoom;
        const cleanedWidth = this.objectBox.width * zoom;
        const cleanedHeight = this.objectBox.height * zoom;

        // console.log(this.objectBox, leftValue, rightValue)
        // Masking Part Of each Text
        const options = {
            isHorizontal,
            width: isHorizontal ? 160 : ruleSize - 4,
            height: isHorizontal ? ruleSize - 4 : 160,
            backgroundColor: '#fff'
        }
        this.drawMask(ctx, {
            ...options,
            left: isHorizontal ? leftWithOffset - 80 : 0,
            top: isHorizontal ? 0 : topWithOffset - 80 
        })
        if (!isSameText) {
            this.drawMask(ctx,{
                ...options,
                left: isHorizontal ? leftWithOffset + cleanedWidth - 80 : 0,
                top: isHorizontal ? 0 : topWithOffset + cleanedHeight - 80,
            })
        }

        const highlightColor = new Color('#43cad4');
        highlightColor.setAlpha(0.5)

        this.drawRect(ctx, {
            left: isHorizontal ? leftWithOffset : ruleSize - 8,
            top: isHorizontal ? ruleSize - 8 : topWithOffset,
            width: isHorizontal ? cleanedWidth : 8,
            height: isHorizontal ? 8 : cleanedHeight,
            fill: highlightColor.toRgba()
        });

        const pad = ruleSize / 2 - fontSize / 2 ;
        highlightColor.setAlpha(1);

        this.drawText(ctx, {
            text: leftValue,
            left: isHorizontal ? leftWithOffset - 2 : pad,
            top: isHorizontal ? pad : topWithOffset - 2,
            align: isSameText ? 'center' : isHorizontal ? 'right' : 'left',
            fill: highlightColor.toRgba(),
            angle: isHorizontal ? 0 : -90
        })

        if (!isSameText) {
            this.drawText(ctx, {
                text: rightValue,
                left: isHorizontal ? leftWithOffset + cleanedWidth + 2 : pad,
                top: isHorizontal ? pad : topWithOffset + cleanedHeight + 2,
                align: isHorizontal ? 'left' : 'right',
                fill: highlightColor.toRgba(),
                angle: isHorizontal ? 0 : -90
            })
        }

        const lineSize = isSameText ? 6 : 8;

        this.drawLine(ctx, {
            left: isHorizontal ? leftWithOffset : ruleSize - lineSize,
            top: isHorizontal ? ruleSize - lineSize : topWithOffset,
            width: isHorizontal ? 0 : lineSize,
            height: isHorizontal ? lineSize : 0,
            stroke: highlightColor.toRgba() 
        })
        if (!isSameText) {
            this.drawLine(ctx, {
                left: isHorizontal ? leftWithOffset + cleanedWidth : ruleSize - lineSize,
                top: isHorizontal ? ruleSize - lineSize : topWithOffset + cleanedHeight,
                width: isHorizontal ? 0 : lineSize,
                height: isHorizontal ? lineSize : 0,
                stroke: highlightColor.toRgba() 
            })
        }
    }

    // Util Function
    getGap(zoom) {
        const zooms = [0.02, 0.03, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 18];
        const gaps = [5000, 2500, 1000, 500, 250, 100, 50, 25, 10, 5, 2];

        let i = 0;
        while (i < zooms.length && zooms[i] < zoom) {
            i++;
        }

        return gaps[i - 1] || 5000;
    }

    drawRect(ctx, options) {
        ctx.save();
        const { left, top, width, height, fill, stroke, strokeWidth } = options;
        ctx.beginPath();
        if (fill) ctx.fillStyle = fill;
        ctx.rect(left, top, width, height);
        ctx.fill();

        if (stroke) {
            ctx.strokeStyle = stroke;
            ctx.lineWidth = strokeWidth ?? 1;
            ctx.stroke();
        }
        ctx.restore()
    }

    drawText(ctx, options) {
        ctx.save();
        const { left, top, text, fill, align, angle, fontSize } = options;
        if (fill) ctx.fillStyle = fill;
        ctx.textAlign = align ?? 'left';
        ctx.textBaseline = 'top';
        ctx.font = `${fontSize ?? 10}px sans-serif`;
        if (angle) {
          ctx.translate(left, top);
          ctx.rotate((Math.PI / 180) * angle);
          ctx.translate(-left, -top);
        }
        ctx.fillText(text, left, top);
        ctx.restore();
    }

    drawLine(ctx, options) {
        ctx.save();
        const { left, top, width, height, stroke, lineWidth } = options;
        ctx.beginPath();
        if (stroke) ctx.strokeStyle = stroke;
        ctx.lineWidth = lineWidth ?? 1;
        ctx.moveTo(left, top);
        ctx.lineTo(left + width, top + height);
        ctx.stroke();
        ctx.restore();
    }

    drawMask(ctx, options) {
        ctx.save();
        const { isHorizontal, left, top, width, height, backgroundColor } = options;
        const gradient = isHorizontal
          ? ctx.createLinearGradient(left, height / 2, left + width, height / 2)
          : ctx.createLinearGradient(width / 2, top, width / 2, height + top);
        const transparentColor = new Color(backgroundColor);
        transparentColor.setAlpha(0);
        gradient.addColorStop(0, transparentColor.toRgba());
        gradient.addColorStop(0.33, backgroundColor);
        gradient.addColorStop(0.67, backgroundColor);
        gradient.addColorStop(1, transparentColor.toRgba());
        this.drawRect(ctx, {
            left,
            top,
            width,
            height,
            fill: gradient,
        });
        ctx.restore();
    }

    destroy() {
        this.canvas.off(
            "after:render",
            this.eventHandler.renderRuler
        );
    }
}