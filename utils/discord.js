// utils/discord.js
// Rich Presence de Discord (solo proceso principal).
const { Client } = require("@xhayper/discord-rpc");

const CLIENT_ID = "1554001740980949083";

let client = null;
let conectado = false;
let conectando = null;

function reiniciarEstado() {
	conectado = false;
	conectando = null;
	client = null;
}

async function asegurarConexion() {
	if (conectado) return true;

	if (!conectando) {
		const nuevo = new Client({ clientId: CLIENT_ID });
		nuevo.on("disconnected", reiniciarEstado);
		conectando = nuevo
			.login()
			.then(() => {
				client = nuevo;
				conectado = true;
			})
			.catch(() => {
				// Discord no está abierto: se reintenta en la próxima actualización
				conectando = null;
			});
	}

	await conectando;
	return conectado;
}

async function actualizarPresencia(datos) {
	try {
		// Sin canción o en pausa: se quita el estado
		if (!datos || !datos.reproduciendo) {
			if (conectado && client) await client.user?.clearActivity();
			return;
		}

		// Al cambiar de canción la duración aún no se conoce (NaN);
		// llegará otro aviso cuando termine de cargar.
		if (!Number.isFinite(datos.duracion)) return;

		if (!(await asegurarConexion())) return;

		const inicio = Date.now() - Math.floor(datos.posicion * 1000);

		await client.user?.setActivity({
			type: 2, // 2 = "Escuchando"
			details: String(datos.nombre).slice(0, 128),
			state: String(datos.artista || "Artista desconocido").slice(0, 128),
			startTimestamp: inicio,
			endTimestamp: inicio + Math.floor(datos.duracion * 1000),
			largeImageKey: "logo",
			largeImageText: "Banana Music",
		});
	} catch (error) {
		console.warn("Discord RPC:", error.message);
		reiniciarEstado();
	}
}

async function cerrarPresencia() {
	try {
		if (client) await client.destroy();
	} catch {}
	reiniciarEstado();
}

module.exports = { actualizarPresencia, cerrarPresencia };
