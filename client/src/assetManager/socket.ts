import type { Asset } from "../core/models/types";
import { socketManager } from "../core/socket";
import { baseAdjust } from "../core/utils";

import { assetStore } from "./state";

export const socket = socketManager.socket("/pa_assetmgmt");

let disConnected = false;

socket.on("connect", () => {
    console.log("Connected");
    if (disConnected) socket.emit("Folder.Get", assetStore.currentFolder.value);
});
socket.on("disconnect", () => {
    console.log("Disconnected");
    disConnected = true;
});
socket.on("redirect", (destination: string) => {
    console.log("redirecting");
    window.location.href = destination;
});
socket.on("Folder.Root.Set", (root: number) => {
    assetStore.setRoot(root);
});
socket.on("Folder.Set", (data: { folder: Asset; path?: number[] }) => {
    assetStore.clear();
    assetStore.setFolderData(data.folder.id, data.folder);
    if (!assetStore.state.modalActive) {
        if (data.path) assetStore.setPath(data.path);
        window.history.pushState(null, "Asset Manager", baseAdjust(`/assets${assetStore.currentFilePath.value}`));
    }
});
socket.on("Folder.Create", (folder: Asset) => {
    assetStore.addAsset(folder);
});
socket.on("Asset.Upload.Finish", (asset: Asset) => {
    assetStore.addAsset(asset);
    assetStore.resolveUpload(asset.name);
});

socket.on("Asset.Export.Finish", (uuid: string) => {
    window.open(baseAdjust(`/static/temp/${uuid}.paa`));
});

socket.on("Asset.Import.Finish", (name: string) => {
    assetStore.resolveUpload(name);
    socket.emit("Folder.Get", assetStore.currentFolder.value);
});
