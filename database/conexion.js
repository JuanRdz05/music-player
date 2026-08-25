const { app } = require("electron");
const path = require("path");
const Database = require("better-sqlite3");

// app.setName() NO va aquí: para cuando este archivo se carga (dentro de
// app.whenReady()), el evento "ready" ya se disparó, y Electron solo
// permite cambiar el nombre ANTES de ese evento. Por eso setName() se
// llama al principio de main.js / importarCanciones.js, no en este módulo.

const dbPath = path.join(app.getPath("userData"), "reproductor.db");

// { verbose: console.log } es útil en desarrollo para ver cada SQL ejecutado.
// Cuando empaquetes la app para distribución, considera quitarlo o
// condicionarlo (ej. solo si process.env.NODE_ENV === "development").
const db = new Database(dbPath, { verbose: console.log });
const querySelect = "SELECT * FROM songs";
const result = db.prepare(querySelect).all();
console.log(result);

// SQLite no valida FOREIGN KEY / ON DELETE CASCADE a menos que lo actives
// explícitamente por conexión.
db.pragma("foreign_keys = ON");

db.exec(`
	CREATE TABLE IF NOT EXISTS songs (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		nombre TEXT NOT NULL,
		artista TEXT NOT NULL,
		album TEXT NOT NULL,
		archivo TEXT NOT NULL UNIQUE,
		imagen TEXT,
		thumbnail TEXT,
		duration REAL NOT NULL,
		es_favorito BOOLEAN DEFAULT 0
	);

	CREATE TABLE IF NOT EXISTS playlist (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		nombre TEXT NOT NULL,
		imagen TEXT
	);

	CREATE TABLE IF NOT EXISTS playlist_canciones (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		playlist_id INTEGER NOT NULL,
		cancion_id INTEGER NOT NULL,
		FOREIGN KEY (playlist_id) REFERENCES playlist(id) ON DELETE CASCADE,
		FOREIGN KEY (cancion_id) REFERENCES songs(id) ON DELETE CASCADE,
		UNIQUE(playlist_id, cancion_id)
	);
`);

console.log("Base de datos lista en:", dbPath);

module.exports = db;
