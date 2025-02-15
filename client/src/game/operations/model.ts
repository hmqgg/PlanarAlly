import type { GlobalPoint } from "../../core/geometry";
import type { LayerName } from "../models/floor";
import type { ServerShape } from "../models/shapes";

export type Operation =
    | FloorMoveOperation
    | LayerMoveOperation
    | MovementOperation
    | ResizeOperation
    | RotationOperation
    | ShapeAddOperation
    | ShapeRemoveOperation;

// MOVEMENT
export interface ShapeMovementOperation {
    uuid: string;
    from: [number, number];
    to: [number, number];
}

export interface MovementOperation {
    type: "movement";
    shapes: ShapeMovementOperation[];
}

// RESIZE
interface ResizeOperation {
    type: "resize";
    // shapes: (RectResizeOperation | CircleResizeOperation | PolygonResizeOperation)[];
    uuid: string;
    fromPoint: [number, number];
    toPoint: [number, number];
    resizePoint: number;
    retainAspectRatio: boolean;
}

// ROTATION

export interface ShapeRotationOperation {
    uuid: string;
    from: number;
    to: number;
}

interface RotationOperation {
    type: "rotation";
    shapes: ShapeRotationOperation[];
    center: GlobalPoint;
}

// FLOOR CHANGE

interface FloorMoveOperation {
    type: "floormovement";
    from: number;
    to: number;
    shapes: string[];
}

// LAYER CHANGE

interface LayerMoveOperation {
    type: "layermovement";
    from: LayerName;
    to: LayerName;
    shapes: string[];
}

// SHAPE REMOVE

interface ShapeRemoveOperation {
    type: "shaperemove";
    shapes: ServerShape[];
}

// SHAPE ADD

interface ShapeAddOperation {
    type: "shapeadd";
    shapes: ServerShape[];
}
