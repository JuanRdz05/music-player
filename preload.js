const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("music", {
	getSongs: () => {
		return ipcRenderer.invoke("get-songs");
	},
});
