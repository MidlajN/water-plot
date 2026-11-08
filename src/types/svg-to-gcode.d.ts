declare module "svg-to-gcode" {
    /** Machine settings; distances in mm, feed rates in mm/min, times in seconds. */
    export interface ConverterSettings {
        zOffset?: number;
        feedRate?: number;
        seekRate?: number;
        zValue?: number;
        tolerance?: number;
        minimumArea?: number;
        bedSize?: { width: number; height: number } | null;
        pathPlanning?: "minimumTravel" | "sortByArea";
        quadrant?: 1 | 2 | 3 | 4;
        xOffset?: number;
        yOffset?: number;
        zMoveTime?: number;
    }

    export interface ConversionResult {
        /** Estimated plotting time in seconds. */
        time: number;
        gcode: string;
    }

    export class Converter {
        constructor(settings?: ConverterSettings);
        convert(svg: string): Promise<ConversionResult>;
    }
}
