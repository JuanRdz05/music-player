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

// ipcMain.handle("get-song", () => {
// 	return db.prepare("SELECT * FROM songs WHERE eliminado = 0").all();
// });

ipcMain.handle("delete-songs", (event, ids) => {
	const { borrarCancionesLogico } = require("./controllers/canciones.js");
	try {
		const resultado = borrarCancionesLogico(ids);
		return { success: true, changes: resultado.changes };
	} catch (error) {
		console.error("Error en DB al hacer borrado lógico:", error);
		return { success: false, error: error.message };
	}
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

ipcMain.handle("get-lyrics", async (event, { nombre, artista, duration }) => {
	try {
		const params = new URLSearchParams({
			track_name: nombre,
			artist_name: artista,
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
			plainLyrics: data.plainLyrics,
		};
	} catch (error) {
		console.error("Error obteniendo letra desde LRCLIB:", error);
		return { found: false, error: error.message };
	}
});

// Agregar una nueva canción: copia archivos y la inserta en la base de datos
ipcMain.handle(
	"add-song",
	async (
		event,
		{ nombre, artista, audioPath, imagePath, duration, lyrics, lyricsTimed },
	) => {
		const fs = require("fs");
		const { agregarCancion } = require("./controllers/canciones.js");

		try {
			// Carpetas de destino (relativas al directorio de la app)
			const musicDir = path.join(__dirname, "music");
			const imgDir = path.join(__dirname, "img");

			if (!fs.existsSync(musicDir)) fs.mkdirSync(musicDir, { recursive: true });
			if (!fs.existsSync(imgDir)) fs.mkdirSync(imgDir, { recursive: true });

			// Copiar audio
			const audioExt = path.extname(audioPath);
			const audioBaseName = `${nombre}${audioExt}`;
			const audioDest = path.join(musicDir, audioBaseName);
			fs.copyFileSync(audioPath, audioDest);
			const archivoRelativo = `music/${audioBaseName}`;

			// Copiar imagen (si se proporcionó)
			let imagenRelativa = null;
			let thumbnailRelativa = null;

			if (imagePath) {
				const imgExt = path.extname(imagePath);
				const imgBaseName = `${nombre}${imgExt}`;
				const imgDest = path.join(imgDir, imgBaseName);
				fs.copyFileSync(imagePath, imgDest);
				imagenRelativa = `img/${imgBaseName}`;

				// Generar miniatura
				try {
					const thumbPath = await getThumbnailPath(imagenRelativa);
					thumbnailRelativa = thumbPath;
				} catch (thumbErr) {
					console.warn("No se pudo generar miniatura:", thumbErr.message);
					thumbnailRelativa = imagenRelativa;
				}
			}

			const resultado = agregarCancion({
				nombre,
				artista,
				archivo: archivoRelativo,
				imagen: imagenRelativa,
				thumbnail: thumbnailRelativa,
				duration,
				lyrics: lyrics ?? null,
				lyricsTimed: lyricsTimed ?? null,
			});

			if (resultado.changes === 0) {
				return {
					success: false,
					error: "La canción ya existe en la biblioteca",
				};
			}

			return { success: true, id: resultado.lastInsertRowid };
		} catch (err) {
			console.error("Error al agregar canción:", err);
			return { success: false, error: err.message };
		}
	},
);

// Obtener todas las playlists guardadas (con su portada y total de canciones)
ipcMain.handle("get-playlists", () => {
	const { obtenerPlaylists } = require("./controllers/playlists.js");
	return obtenerPlaylists();
});

// Obtener las canciones de una playlist específica, en orden
ipcMain.handle("get-playlist-songs", (event, playlistId) => {
	const { obtenerCancionesDePlaylist } = require("./controllers/playlists.js");
	return obtenerCancionesDePlaylist(playlistId);
});

// Crear una nueva playlist: copia la portada (si hay) y guarda el registro
ipcMain.handle(
	"create-playlist",
	async (event, { nombre, imagePath, cancionIds }) => {
		const fs = require("fs");
		const { crearPlaylist } = require("./controllers/playlists.js");

		try {
			let imagenRelativa = null;

			if (imagePath) {
				const playlistImgDir = path.join(__dirname, "img", "playlists");
				if (!fs.existsSync(playlistImgDir)) {
					fs.mkdirSync(playlistImgDir, { recursive: true });
				}

				// Prefijo con timestamp: como "playlist.nombre" no es único
				// en la base de datos, dos playlists con el mismo nombre no
				// deben pisarse la portada.
				const imgExt = path.extname(imagePath);
				const imgBaseName = `${Date.now()}-${nombre}${imgExt}`;
				const imgDest = path.join(playlistImgDir, imgBaseName);
				fs.copyFileSync(imagePath, imgDest);
				imagenRelativa = `img/playlists/${imgBaseName}`;
			}

			return crearPlaylist({ nombre, imagen: imagenRelativa, cancionIds });
		} catch (err) {
			console.error("Error al crear playlist:", err);
			return { success: false, error: err.message };
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
