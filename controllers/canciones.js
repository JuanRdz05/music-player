const db = require("../database/conexion.js");

function obtenerTodasLasCanciones() {
	return db.prepare("SELECT * FROM songs ORDER BY id").all();
}

function obtenerCancionPorId(id) {
	return db.prepare("SELECT * FROM songs WHERE id = ?").get(id);
}

function agregarCancion({
	nombre,
	artista,
	album,
	archivo,
	imagen,
	thumbnail,
	duration,
}) {
	const stmt = db.prepare(`
		INSERT OR IGNORE INTO songs
			(nombre, artista, album, archivo, imagen, thumbnail, duration)
		VALUES
			(@nombre, @artista, @album, @archivo, @imagen, @thumbnail, @duration)
	`);

	return stmt.run({
		nombre,
		artista,
		album,
		archivo,
		imagen,
		thumbnail,
		duration,
	});
}

module.exports = {
	obtenerTodasLasCanciones,
	obtenerCancionPorId,
	agregarCancion,
};
