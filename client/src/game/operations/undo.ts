import { toGP, Vector } from "../../core/geometry";
import type { GlobalPoint } from "../../core/geometry";
import { SyncMode } from "../../core/models/types";
import { floorStore } from "../../store/floor";
import { UuidMap } from "../../store/shapeMap";
import type { LayerName } from "../models/floor";
import type { ServerShape } from "../models/shapes";
import { ToolName } from "../models/tools";
import type { ISelectTool } from "../models/tools";
import { deleteShapes } from "../shapes/utils";
import { addShape, moveFloor, moveLayer } from "../temp";
import { toolMap } from "../tools/tools";

import type { Operation, ShapeMovementOperation, ShapeRotationOperation } from "./model";
import { moveShapes } from "./movement";
import { resizeShape } from "./resize";
import { rotateShapes } from "./rotation";

let undoStack: Operation[] = [];
let redoStack: Operation[] = [];
let operationInProgress = false;

/**
 * Add a new operation to the undo stack.
 */
export function addOperation(operation: Operation): void {
    if (operationInProgress) return;
    undoStack.push(operation);
    redoStack = [];
    if (undoStack.length > 50) undoStack.shift();
}

/**
 * Override the last operation.
 * This is an advanced function that should only be used for special cases.
 * e.g. addShape is sometimes called pre-emptively with later updates to size during draw
 * whereas we want to have the final w/h to be part of the undo operation info
 */
export function overrideLastOperation(operation: Operation): void {
    const lastOp = undoStack.pop();
    if (lastOp === undefined || lastOp.type !== operation.type)
        throw new Error("Wrong usage of overrideLastOperation.");
    undoStack.push(operation);
}

/**
 * Clear the undo and redo stacks.
 */
export function clearUndoStacks(): void {
    undoStack = [];
    redoStack = [];
}

export function undoOperation(): void {
    handleOperation("undo");
}

export function redoOperation(): void {
    handleOperation("redo");
}

function handleOperation(direction: "undo" | "redo"): void {
    operationInProgress = true;
    const op = direction === "undo" ? undoStack.pop() : redoStack.pop();
    if (op !== undefined) {
        if (direction === "undo") redoStack.push(op);
        else undoStack.push(op);

        if (op.type === "movement") {
            handleMovement(op.shapes, direction);
        } else if (op.type === "rotation") {
            handleRotation(op.shapes, op.center, direction);
        } else if (op.type === "resize") {
            handleResize(op.uuid, op.fromPoint, op.toPoint, op.resizePoint, op.retainAspectRatio, direction);
        } else if (op.type === "floormovement") {
            handleFloorMove(op.shapes, op.from, op.to, direction);
        } else if (op.type === "layermovement") {
            handleLayerMove(op.shapes, op.from, op.to, direction);
        } else if (op.type === "shaperemove") {
            handleShapeRemove(op.shapes, direction);
        } else if (op.type === "shapeadd") {
            handleShapeRemove(op.shapes, direction === "redo" ? "undo" : "redo");
        }
    }
    operationInProgress = false;
}

function handleMovement(shapes: ShapeMovementOperation[], direction: "undo" | "redo"): void {
    const fullShapes = shapes.map((s) => UuidMap.get(s.uuid)!);
    let delta = Vector.fromPoints(toGP(shapes[0].to), toGP(shapes[0].from));
    if (direction === "redo") delta = delta.reverse();
    moveShapes(fullShapes, delta, true);
    (toolMap[ToolName.Select] as ISelectTool).resetRotationHelper();
}

function handleRotation(shapes: ShapeRotationOperation[], center: GlobalPoint, direction: "undo" | "redo"): void {
    const fullShapes = shapes.map((s) => UuidMap.get(s.uuid)!);
    let angle = shapes[0].from - shapes[0].to;
    if (direction === "redo") angle *= -1;
    rotateShapes(fullShapes, angle, center, true);
    (toolMap[ToolName.Select] as ISelectTool).resetRotationHelper();
}

function handleResize(
    uuid: string,
    fromPoint: [number, number],
    toPoint: [number, number],
    resizePoint: number,
    retainAspectRatio: boolean,
    direction: "undo" | "redo",
): void {
    const shape = UuidMap.get(uuid)!;
    const targetPoint = direction === "undo" ? fromPoint : toPoint;
    resizeShape(shape, toGP(targetPoint), resizePoint, retainAspectRatio, false);
}

function handleFloorMove(shapes: string[], from: number, to: number, direction: "undo" | "redo"): void {
    const fullShapes = shapes.map((s) => UuidMap.get(s)!);
    let floorId = from;
    if (direction === "redo") floorId = to;
    const floor = floorStore.getFloor({ id: floorId })!;
    moveFloor(fullShapes, floor, true);
}

function handleLayerMove(shapes: string[], from: LayerName, to: LayerName, direction: "undo" | "redo"): void {
    const fullShapes = shapes.map((s) => UuidMap.get(s)!);
    let layerName = from;
    if (direction === "redo") layerName = to;
    const floor = floorStore.getFloor({ id: fullShapes[0].floor.id })!;
    const layer = floorStore.getLayer(floor, layerName)!;
    moveLayer(fullShapes, layer, true);
}

function handleShapeRemove(shapes: ServerShape[], direction: "undo" | "redo"): void {
    if (direction === "undo") {
        for (const shape of shapes) addShape(shape, SyncMode.FULL_SYNC);
    } else {
        deleteShapes(
            shapes.map((s) => UuidMap.get(s.uuid)!),
            SyncMode.FULL_SYNC,
        );
    }
}
