// JS/home.js
(function () {
	const { ipcRenderer } = require("electron");
	const fs = require("fs");
	const path = require("path");
	const { pathToFileURL } = require("url");

	// Cuántas canciones / playlists se muestran en el home
	const LIMITE_CANCIONES_HOME = 6;
	const LIMITE_PLAYLIST_HOME = 6;

	// Imagen fija de la app (assets/ va dentro del paquete, junto a index.html)
	const IMAGEN_DEFAULT = "assets/default-playlist.png";

	function resolverImagenPlaylist(imagen) {
		if (!imagen) return IMAGEN_DEFAULT;
		if (
			imagen.startsWith("data:image") ||
			imagen.startsWith("http") ||
			imagen.startsWith("file:")
		) {
			return imagen;
		}
		const rutaAbsoluta = path.isAbsolute(imagen)
			? imagen
			: path.join(__dirname, imagen);

		try {
			if (fs.existsSync(rutaAbsoluta)) {
				return pathToFileURL(rutaAbsoluta).href;
			}
		} catch (e) {
			// ruta inválida, cae a la imagen por defecto
		}

		return IMAGEN_DEFAULT;
	}

	// ------------------------------------------------------------
	// Helpers de UI
	// ------------------------------------------------------------

	// Tarjeta de "estado vacío" reutilizable (canciones y playlists)
	function crearEstadoVacio({ icono, titulo, texto }) {
		const vacio = document.createElement("div");
		vacio.classList.add("empty-state");
		vacio.innerHTML = `
			<div class="empty-state-icon"><i class="fa-solid ${icono}"></i></div>
			<p class="empty-state-title"></p>
			<p class="empty-state-text"></p>
		`;
		// textContent: el texto nunca se interpreta como HTML
		vacio.querySelector(".empty-state-title").textContent = titulo;
		vacio.querySelector(".empty-state-text").textContent = texto;
		return vacio;
	}

	// Contador junto al título de sección: "6 de 24" o "3". Se oculta en 0.
	function actualizarContador(idElemento, mostrados, total) {
		const el = document.getElementById(idElemento);
		if (!el) return;

		if (!total) {
			el.hidden = true;
			return;
		}
		el.textContent =
			total > mostrados ? `${mostrados} de ${total}` : `${total}`;
		el.hidden = false;
	}

	// Miniatura cuadrada con botón de play encima (aparece al hover)
	function crearMiniatura(src, alt) {
		const thumb = document.createElement("div");
		thumb.classList.add("song-thumb");

		const img = document.createElement("img");
		img.classList.add("song-image");
		img.alt = alt || "";
		img.src = src;

		const overlay = document.createElement("div");
		overlay.classList.add("song-play-overlay");
		overlay.innerHTML = `<i class="fa-solid fa-play"></i>`;

		thumb.appendChild(img);
		thumb.appendChild(overlay);
		return { thumb, img };
	}

	function crearTarjetaCancionHome(cancion, indice) {
		const tarjeta = document.createElement("div");
		tarjeta.classList.add("song-card");
		tarjeta.dataset.id = cancion.id;
		tarjeta.style.setProperty("--i", indice); // para la animación escalonada

		const { thumb } = crearMiniatura(
			cancion.thumbnail || IMAGEN_DEFAULT,
			cancion.nombre,
		);

		const info = document.createElement("div");
		info.classList.add("song-info");
		info.innerHTML = `
			<h3 class="song-name"></h3>
			<p class="song-artist"></p>
		`;
		info.querySelector(".song-name").textContent = cancion.nombre;
		info.querySelector(".song-artist").textContent = cancion.artista || "";

		tarjeta.appendChild(thumb);
		tarjeta.appendChild(info);
		return tarjeta;
	}

	function crearTarjetaPlaylistHome(playlist, indice) {
		const tarjeta = document.createElement("div");
		// "playlist-card-home" agrega position:relative para ubicar
		// el botón de editar en la esquina (ver home.css)
		tarjeta.classList.add("song-card", "playlist-card-home");
		tarjeta.dataset.id = playlist.id;
		tarjeta.style.setProperty("--i", indice);

		const { thumb, img } = crearMiniatura(
			resolverImagenPlaylist(playlist.imagen),
			playlist.nombre,
		);
		// Listener en JS: funciona aunque la CSP bloquee handlers inline
		img.addEventListener("error", function manejarError() {
			img.removeEventListener("error", manejarError); // evita bucle infinito
			if (img.src !== IMAGEN_DEFAULT) {
				img.src = IMAGEN_DEFAULT;
			}
		});

		const total = playlist.totalCanciones;
		const info = document.createElement("div");
		info.classList.add("song-info");
		info.innerHTML = `
			<h3 class="song-name"></h3>
			<p class="song-artist">${total} canción${total === 1 ? "" : "es"}</p>
		`;
		info.querySelector(".song-name").textContent = playlist.nombre;

		// Botón de editar: visible al pasar el mouse sobre la tarjeta.
		// stopPropagation() para que el clic no dispare la reproducción.
		const editBtn = document.createElement("button");
		editBtn.classList.add("playlist-edit-btn");
		editBtn.type = "button";
		editBtn.title = "Editar playlist";
		editBtn.innerHTML = `<i class="fa-solid fa-pencil"></i>`;
		editBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			if (typeof window.abrirEditarPlaylist === "function") {
				window.abrirEditarPlaylist(playlist.id);
			}
		});

		tarjeta.appendChild(thumb);
		tarjeta.appendChild(info);
		tarjeta.appendChild(editBtn);
		return tarjeta;
	}

	// ------------------------------------------------------------
	// Render de canciones
	// ------------------------------------------------------------

	async function renderHomeCards() {
		const contenedor = document.getElementById("home-songs-container");
		if (!contenedor) return;

		try {
			const todasLasCanciones = await ipcRenderer.invoke("get-songs");

			// Siempre limpiamos primero (así también se limpia al borrar la última)
			contenedor.innerHTML = "";

			if (!todasLasCanciones || todasLasCanciones.length === 0) {
				contenedor.appendChild(
					crearEstadoVacio({
						icono: "fa-music",
						titulo: "Aún no hay canciones",
						texto:
							"Agrega tu primera canción desde el menú lateral y aparecerá aquí.",
					}),
				);
				contenedor.onclick = null;
				actualizarContador("home-songs-count", 0, 0);
				return;
			}

			const mostradas = todasLasCanciones.slice(0, LIMITE_CANCIONES_HOME);
			mostradas.forEach((cancion, i) => {
				contenedor.appendChild(crearTarjetaCancionHome(cancion, i));
			});

			actualizarContador(
				"home-songs-count",
				mostradas.length,
				todasLasCanciones.length,
			);

			// onclick reemplaza el handler en cada recarga (addEventListener
			// los acumulaba y dejaba listas desactualizadas)
			contenedor.onclick = (e) => {
				const tarjeta = e.target.closest(".song-card");
				if (!tarjeta) return;

				const id = Number(tarjeta.dataset.id);
				const indiceSeleccionado = todasLasCanciones.findIndex(
					(cancion) => cancion.id === id,
				);
				if (indiceSeleccionado === -1) return;

				if (typeof window.cargarYReproducirLista === "function") {
					window.cargarYReproducirLista(todasLasCanciones, indiceSeleccionado);
				}
			};
		} catch (error) {
			console.error("Error al cargar canciones en el home:", error);
		}
	}

	// ------------------------------------------------------------
	// Render de playlists
	// ------------------------------------------------------------

	async function renderHomePlaylists() {
		const contenedorPlaylists = document.querySelector(
			".playlist-container-home",
		);
		if (!contenedorPlaylists) return;

		try {
			const playlists = await ipcRenderer.invoke("get-playlists");

			contenedorPlaylists.innerHTML = "";

			if (!playlists || playlists.length === 0) {
				contenedorPlaylists.appendChild(
					crearEstadoVacio({
						icono: "fa-compact-disc",
						titulo: "No tienes playlists creadas aún",
						texto:
							"Crea una playlist desde el menú lateral para agrupar tus canciones favoritas.",
					}),
				);
				contenedorPlaylists.onclick = null;
				actualizarContador("home-playlists-count", 0, 0);
				return;
			}

			const mostradas = playlists.slice(0, LIMITE_PLAYLIST_HOME);
			mostradas.forEach((playlist, i) => {
				contenedorPlaylists.appendChild(crearTarjetaPlaylistHome(playlist, i));
			});

			actualizarContador(
				"home-playlists-count",
				mostradas.length,
				playlists.length,
			);

			contenedorPlaylists.onclick = async (e) => {
				const tarjeta = e.target.closest(".song-card");
				if (!tarjeta) return;

				const playlistId = Number(tarjeta.dataset.id);

				try {
					const cancionesPlaylist = await ipcRenderer.invoke(
						"get-playlist-songs",
						playlistId,
					);

					if (cancionesPlaylist && cancionesPlaylist.length > 0) {
						if (typeof window.cargarYReproducirLista === "function") {
							window.cargarYReproducirLista(cancionesPlaylist);
						}
					} else {
						await avisar({
							titulo: "Playlist vacía",
							mensaje: "Esta playlist no tiene canciones aún.",
							tipo: "info",
						});
					}
				} catch (err) {
					console.error("Error al obtener canciones de la playlist:", err);
				}
			};
		} catch (error) {
			console.error("Error al cargar las playlists en el inicio:", error);
		}
	}

	// Exponemos las funciones al entorno global
	window.initHomeView = () => {
		renderHomeCards();
		renderHomePlaylists();
	};

	window.recargarPlaylists = renderHomePlaylists;
})();
