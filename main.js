const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");

function createWindow() {
	let pathPreload = path.join(__dirname, "preload.js");
	const win = new BrowserWindow({
		width: 800,
		height: 600,
		webPreferences: {
			nodeIntegration: true,
			contextIsolation: false,
		},
	});

	win.loadFile("index.html");
}

//Crear un objeto por canción con sus propiedades

ipcMain.handle("get-songs", () => {
	const musicPath = path.join(__dirname, "music");
	const canciones = fs.readdirSync(musicPath);

	return canciones.map((cancion) => {
		return {
			nombre: cancion,
			imagen: `img/${cancion.replace(".mp3", ".png")}`,
		};
	});
});

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
	if (process.platform !== "darwin") app.quit();
});
