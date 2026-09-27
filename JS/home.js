// JS/home.js
(function () {
	const { ipcRenderer } = require("electron");
	const fs = require("fs");
	const path = require("path");
	const { pathToFileURL } = require("url");

	// Cuántas canciones se muestran en el home
	const LIMITE_CANCIONES_HOME = 6;
	const LIMITE_PLAYLIST_HOME = 6;

	// Ruta ABSOLUTA a la imagen por defecto: no depende de dónde se inyecte la vista
	const RUTA_DEFAULT = path.join(__dirname, "img", "default-playlist.png");
	const IMAGEN_DEFAULT = fs.existsSync(RUTA_DEFAULT)
		? pathToFileURL(RUTA_DEFAULT).href
		: ""; // si no existe, dejamos vacío para poder verlo en consola

	function resolverImagenPlaylist(imagen) {
		if (!imagen) return IMAGEN_DEFAULT;

		// Base64, link web o file:// ya resueltos: directo
		if (
			imagen.startsWith("data:image") ||
			imagen.startsWith("http") ||
			imagen.startsWith("file:")
		) {
			return imagen;
		}

		// Rutas relativas tipo "img/playlists/xxx.jpg" (igual que los
		// thumbnails de las canciones): las resolvemos contra la carpeta
		// de la app, que es donde __dirname apunta en el renderer
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

	function crearTarjetaCancionHome(cancion) {
		const tarjeta = document.createElement("div");
		tarjeta.classList.add("song-card");
		tarjeta.dataset.id = cancion.id;

		tarjeta.innerHTML = `
			<img class="song-image" src="${cancion.thumbnail}" alt="${cancion.nombre}" />
			<div class="song-info">
				<h3 class="song-name">${cancion.nombre}</h3>
				<p class="song-artist">${cancion.artista}</p>
			</div>
		`;
		return tarjeta;
	}

	function crearTarjetaPlaylistHome(playlist) {
		const tarjeta = document.createElement("div");
		tarjeta.classList.add("song-card");
		tarjeta.dataset.id = playlist.id;

		const imagenSrc = resolverImagenPlaylist(playlist.imagen);

		const img = document.createElement("img");
		img.classList.add("song-image");
		img.alt = playlist.nombre;
		img.src = imagenSrc;
		// Listener en JS: funciona aunque la CSP bloquee handlers inline
		img.addEventListener("error", function manejarError() {
			img.removeEventListener("error", manejarError); // evita bucle infinito
			if (img.src !== IMAGEN_DEFAULT) {
				img.src = IMAGEN_DEFAULT;
			}
		});

		const info = document.createElement("div");
		info.classList.add("song-info");
		info.innerHTML = `
			<h3 class="song-name">${playlist.nombre}</h3>
			<p class="song-artist">${playlist.totalCanciones} canciones</p>
		`;

		tarjeta.appendChild(img);
		tarjeta.appendChild(info);
		return tarjeta;
	}

	// La convertimos en async para pedir las canciones a la base de datos
	async function renderHomeCards() {
		const contenedor = document.getElementById("home-songs-container");
		if (!contenedor) return;

		try {
			// Obtenemos TODAS las canciones independientes de lo que se esté reproduciendo
			const todasLasCanciones = await ipcRenderer.invoke("get-songs");

			if (!todasLasCanciones || todasLasCanciones.length === 0) return;

			contenedor.innerHTML = "";

			todasLasCanciones.slice(0, LIMITE_CANCIONES_HOME).forEach((cancion) => {
				contenedor.appendChild(crearTarjetaCancionHome(cancion));
			});

			// Solo añadimos el event listener una vez
			contenedor.addEventListener("click", (e) => {
				const tarjeta = e.target.closest(".song-card");
				if (!tarjeta) return;

				const id = Number(tarjeta.dataset.id);

				// Buscamos el índice en la lista global, no en la cola actual
				const indiceSeleccionado = todasLasCanciones.findIndex(
					(cancion) => cancion.id === id,
				);

				if (indiceSeleccionado === -1) return;

				// Restauramos la cola global completa en el reproductor y empezamos a reproducir
				if (typeof window.cargarYReproducirLista === "function") {
					window.cargarYReproducirLista(todasLasCanciones, indiceSeleccionado);
				}
			});
		} catch (error) {
			console.error("Error al cargar canciones en el home:", error);
		}
	}

	async function renderHomePlaylists() {
		const contenedorPlaylists = document.querySelector(
			".playlist-container-home",
		);
		if (!contenedorPlaylists) return;

		try {
			// Obtenemos las playlists desde el proceso principal
			const playlists = await ipcRenderer.invoke("get-playlists");

			contenedorPlaylists.innerHTML = "";

			if (!playlists || playlists.length === 0) {
				const emptyMsg = document.createElement("p");
				emptyMsg.textContent = "No tienes playlists creadas aún.";
				emptyMsg.style.color = "#aaa";
				contenedorPlaylists.appendChild(emptyMsg);
				return;
			}

			playlists.slice(0, LIMITE_PLAYLIST_HOME).forEach((playlist) => {
				contenedorPlaylists.appendChild(crearTarjetaPlaylistHome(playlist));
			});

			// Usamos onclick en vez de addEventListener: se reemplaza en vez
			// de acumular cada vez que se recarga la lista de playlists
			contenedorPlaylists.onclick = async (e) => {
				const tarjeta = e.target.closest(".song-card");
				if (!tarjeta) return;

				const playlistId = Number(tarjeta.dataset.id);

				try {
					// Pedimos las canciones de esta playlist a la base de datos
					const cancionesPlaylist = await ipcRenderer.invoke(
						"get-playlist-songs",
						playlistId,
					);

					if (cancionesPlaylist && cancionesPlaylist.length > 0) {
						// Llamamos a la función global que añadimos en renderer.js
						if (typeof window.cargarYReproducirLista === "function") {
							window.cargarYReproducirLista(cancionesPlaylist);
						}
					} else {
						alert("Esta playlist no tiene canciones aún.");
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
