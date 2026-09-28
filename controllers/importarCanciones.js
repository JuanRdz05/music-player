const { app } = require("electron");

app.setName("electron-app");

const fs = require("fs");
const path = require("path");
const getMP3Duration = require("get-mp3-duration");

app.whenReady().then(() => {
	const { agregarCancion } = require("./canciones.js");

	const musicPath = path.join(__dirname, "..", "music");
	const metadataPath = path.join(__dirname, "..", "metadata", "songs.json");

	const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf-8"));

	console.log(`Importando ${metadata.length} canciones...`);

	let insertadas = 0;
	let omitidas = 0;

	for (const cancion of metadata) {
		try {
			const archivoPath = path.join(musicPath, cancion.archivo);
			const buffer = fs.readFileSync(archivoPath);
			const duration = getMP3Duration(buffer) / 1000;

			const resultado = agregarCancion({
				nombre: cancion.nombre,
				artista: cancion.artista,
				album: cancion.album,
				archivo: `music/${cancion.archivo}`,
				imagen: `img/${cancion.archivo.replace(".mp3", ".png")}`,
				thumbnail: `img/thumbnails/${cancion.archivo.replace(".mp3", ".png")}`,
				duration,
			});

			if (resultado.changes > 0) {
				insertadas++;
				console.log(`✓ Insertada: ${cancion.nombre}`);
			} else {
				omitidas++;
				console.log(`- Ya existía, omitida: ${cancion.nombre}`);
			}
		} catch (error) {
			console.error(`✗ Error importando "${cancion.nombre}":`, error.message);
		}
	}

	console.log(`\nListo. Insertadas: ${insertadas}, omitidas: ${omitidas}`);
	app.quit();
});
