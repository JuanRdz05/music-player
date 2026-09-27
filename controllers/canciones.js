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
	archivo,
	imagen,
	thumbnail,
	duration,
	lyrics,
	lyricsTimed,
}) {
	const stmt = db.prepare(`
		INSERT OR IGNORE INTO songs
			(nombre, artista, archivo, imagen, thumbnail, duration, lyrics, lyricsTimed)
		VALUES
			(@nombre, @artista, @archivo, @imagen, @thumbnail, @duration, @lyrics, @lyricsTimed)
	`);

	return stmt.run({
		nombre,
		artista,
		archivo,
		imagen,
		thumbnail,
		duration,
		lyrics,
		lyricsTimed,
	});
}

//Modificar una cancion
function actualizarCancion({
	id,
	nombre,
	artista,
	archivo,
	imagen,
	thumbnail,
	duration,
	lyrics,
	lyricsTimed,
}) {
	const stmt = db.prepare(`
		UPDATE songs
		SET 
			nombre = @nombre,
			artista = @artista,
			archivo = @archivo,
			imagen = @imagen,
			thumbnail = @thumbnail,
			duration = @duration,
			lyrics = @lyrics,
			lyricsTimed = @lyricsTimed
		WHERE id = @id
	`);

	return stmt.run({
		id,
		nombre,
		artista,
		archivo,
		imagen,
		thumbnail,
		duration,
		lyrics,
		lyricsTimed,
	});
}

//Eliminar una canción
function eliminarCancion(id) {
	const stmt = db.prepare("DELETE FROM songs WHERE id = ?");
	return stmt.run(id);
}

module.exports = {
	obtenerTodasLasCanciones,
	obtenerCancionPorId,
	agregarCancion,
	actualizarCancion,
	eliminarCancion,
};

//MODIFICAR TABLA DE CANCIONES

// try {
// } catch (error) {
// 	console.log("Error al mostrar la tabla de las canciones:", error);
// }
