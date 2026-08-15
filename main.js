const { app, BrowserWindow, ipcMain, globalShortcut } = require("electron");
const path = require("path");
const fs = require("fs");

function createWindow() {
	let pathPreload = path.join(__dirname, "preload.js");
	const win = new BrowserWindow({
		width: 1920,
		height: 1080,
		fullscreen: false,
		webPreferences: {
			nodeIntegration: true,
			contextIsolation: false,
		},
	});

	win.maximize();

	win.loadFile("index.html");
	console.log("Iniciando aplicación");
	//Atajos de teclado
	globalShortcut.register("CommandOrControl+o", () => {
		if (win.isVisible()) win.hide();
		else win.show();
	});
	globalShortcut.register("CommandOrControl+q", () => {
		console.log("Saliendo de la aplicación");
		app.quit();
	});
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
