import { SyncTo } from "../../../core/models/types";
import { UuidMap } from "../../../store/shapeMap";
import { ownerToClient } from "../../models/shapes";
import type { ServerShapeOwner } from "../../models/shapes";
import { socket } from "../socket";

socket.on("Shape.Owner.Add", (data: ServerShapeOwner) => {
    const shape = UuidMap.get(data.shape);
    if (shape === undefined) return;
    shape.addOwner(ownerToClient(data), SyncTo.UI);
});

socket.on("Shape.Owner.Update", (data: ServerShapeOwner) => {
    const shape = UuidMap.get(data.shape);
    if (shape === undefined) return;
    shape.updateOwner(ownerToClient(data), SyncTo.UI);
});

socket.on("Shape.Owner.Delete", (data: ServerShapeOwner) => {
    const shape = UuidMap.get(data.shape);
    if (shape === undefined) return;
    shape.removeOwner(data.user, SyncTo.UI);
});
