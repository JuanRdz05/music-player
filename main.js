const {
	app,
	BrowserWindow,
	ipcMain,
	globalShortcut,
	dialog,
} = require("electron");

app.setName("electron-app");

const path = require("path");

const URL = "https://lrclib.net/api/get";

//Generador de miniaturas
const {
	generateAllThumbnails,
	getThumbnailPath,
	CONFIG,
} = require("./JS/image-reductor");

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

//Obtener todas las canciones desde la base de datos
ipcMain.handle("get-songs", () => {
	const { obtenerTodasLasCanciones } = require("./controllers/canciones.js");
	return obtenerTodasLasCanciones();
});

ipcMain.handle("get-thumbnail", async (event, imagePath) => {
	try {
		const thumbPath = await getThumbnailPath(imagePath);
		return thumbPath;
	} catch (error) {
		console.error("Error generando miniatura:", error);
		return null;
	}
});

ipcMain.handle(
	"get-lyrics",
	async (event, { nombre, artista, album, duration }) => {
		try {
			const params = new URLSearchParams({
				track_name: nombre,
				artist_name: artista,
				album_name: album,
				duration: Math.round(duration),
			});

			const response = await fetch(`${URL}?${params.toString()}`, {
				headers: {
					"User-Agent": "ReproductorMusica/1.0.0",
				},
			});

			if (response.status === 404) {
				return { found: false };
			}
			if (!response.ok) {
				throw new Error(`LRCLIB respondió con estado ${response.status}`);
			}

			const data = await response.json();

			return {
				found: true,
				instrumental: data.instrumental,
				syncedLyrics: data.syncedLyrics,
			};
		} catch (error) {
			console.error("Error obteniendo letra desde LRCLIB:", error);
			return { found: false, error: error.message };
		}
	},
);

app.whenReady().then(async () => {
	try {
		console.log("Generando miniaturas...");
		await generateAllThumbnails();
		console.log("Miniaturas listas");
	} catch (error) {
		console.error("Error generando miniaturas:", error);
	}

	try {
		require("./database/conexion.js");
		console.log("--Base de datos lista--");
	} catch (error) {
		console.error("Error inicializando la base de datos:", error);

		dialog.showErrorBox(
			"Error al iniciar la base de datos",
			`No se pudo preparar la base de datos de la aplicación.\n\n${error.message}`,
		);

		app.quit();
		return;
	}

	createWindow();
});

app.on("window-all-closed", () => {
	if (process.platform !== "darwin") app.quit();
});
