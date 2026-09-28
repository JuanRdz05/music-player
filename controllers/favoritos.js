// controllers/favoritos.js
// Los favoritos se guardan en la columna "es_favorito" de la tabla songs.
// Así no hay tabla extra y el borrado lógico (eliminado = 1) se respeta
// con un solo WHERE.
const db = require("../database/conexion.js");

// Devuelve las canciones favoritas que NO están eliminadas.
function obtenerFavoritos() {
	return db
		.prepare(
			`SELECT * FROM songs
				WHERE es_favorito = 1 AND eliminado = 0
				ORDER BY id ASC`,
		)
		.all();
}

// Devuelve solo los ids de las favoritas activas, para pintar las estrellas
// en cualquier vista sin traer todas las canciones.
function obtenerIdsFavoritos() {
	return db
		.prepare("SELECT id FROM songs WHERE es_favorito = 1 AND eliminado = 0")
		.all()
		.map((fila) => fila.id);
}

// Marca la canción como favorita si no lo era, o la desmarca si ya lo era.
// Devuelve true si QUEDÓ como favorita, false si quedó fuera.
function alternarFavorito(cancionId) {
	const cancion = db
		.prepare("SELECT es_favorito FROM songs WHERE id = ? AND eliminado = 0")
		.get(cancionId);

	if (!cancion) {
		throw new Error("La canción no existe o fue eliminada");
	}

	const nuevoValor = cancion.es_favorito ? 0 : 1;
	db.prepare("UPDATE songs SET es_favorito = ? WHERE id = ?").run(
		nuevoValor,
		cancionId,
	);

	return nuevoValor === 1;
}

module.exports = {
	obtenerFavoritos,
	obtenerIdsFavoritos,
	alternarFavorito,
};
