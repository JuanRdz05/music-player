// JS/favoritos.js
// 1) Utilidades compartidas: ids favoritos, botón de estrella y tarjeta de canción
// 2) Lógica de la vista "Favoritos"
// Debe cargarse ANTES de home.js y library.js (ver index.html).
(function () {
	const { ipcRenderer } = require("electron");

	// ============================================================
	// 1) UTILIDADES COMPARTIDAS
	// ============================================================

	const favoritosIds = new Set();
	let promesaCarga = null;

	// Carga los ids favoritos UNA sola vez; después se mantienen al día
	// con cada clic en una estrella.
	function cargarFavoritosIds() {
		if (!promesaCarga) {
			promesaCarga = ipcRenderer
				.invoke("get-favorite-ids")
				.then((ids) => {
					favoritosIds.clear();
					(ids || []).forEach((id) => favoritosIds.add(id));
				})
				.catch((error) => {
					console.error("Error al cargar los ids de favoritos:", error);
					promesaCarga = null; // permite reintentar la próxima vez
				});
		}
		return promesaCarga;
	}

	function pintarBoton(btn, activo) {
		btn.classList.toggle("active", activo);
		btn.title = activo ? "Quitar de favoritos" : "Agregar a favoritos";
		btn.innerHTML = activo
			? `<i class="fa-solid fa-star"></i>`
			: `<i class="fa-regular fa-star"></i>`;
	}

	// Reinicia una animación CSS de un botón (clase temporal que se quita sola)
	function animarBoton(btn, clase) {
		btn.classList.remove(clase);
		void btn.offsetWidth; // fuerza el reflow para poder repetir la animación
		btn.classList.add(clase);
		btn.addEventListener("animationend", () => btn.classList.remove(clase), {
			once: true,
		});
	}

	// Pinta TODAS las estrellas de una canción que estén en pantalla
	function actualizarEstrellas(cancionId, activo, conAnimacion) {
		document
			.querySelectorAll(`.fav-btn[data-id="${cancionId}"]`)
			.forEach((btn) => {
				pintarBoton(btn, activo);
				if (conAnimacion) animarBoton(btn, "pop");
			});
	}

	// Estrella para una tarjeta de canción.
	function crearBotonFavorito(cancionId) {
		const btn = document.createElement("button");
		btn.type = "button";
		btn.classList.add("fav-btn");
		btn.dataset.id = cancionId;
		pintarBoton(btn, favoritosIds.has(cancionId));

		btn.addEventListener("click", async (e) => {
			// Que el clic no llegue a la tarjeta (no debe reproducir la canción)
			e.stopPropagation();
			if (btn.disabled) return;

			const antes = favoritosIds.has(cancionId);
			const despues = !antes;

			// Cambio INMEDIATO en pantalla (la estrella se rellena / vacía al
			// instante); si la base de datos falla, se revierte más abajo.
			actualizarEstrellas(cancionId, despues, true);
			btn.disabled = true;

			try {
				const resultado = await ipcRenderer.invoke(
					"toggle-favorite",
					cancionId,
				);
				if (!resultado || !resultado.success) {
					throw new Error(
						(resultado && resultado.error) || "No se pudo guardar el favorito",
					);
				}

				if (resultado.esFavorito) favoritosIds.add(cancionId);
				else favoritosIds.delete(cancionId);

				// Por si la base de datos quedó distinta a lo esperado
				if (resultado.esFavorito !== despues) {
					actualizarEstrellas(cancionId, resultado.esFavorito, false);
				}

				// Avisa a las vistas (p. ej. Favoritos) para que se actualicen
				document.dispatchEvent(
					new CustomEvent("favoritos-cambiaron", {
						detail: { id: cancionId, esFavorito: resultado.esFavorito },
					}),
				);
			} catch (error) {
				console.error("Error al cambiar favorito:", error);
				// Revertimos y sacudimos la estrella para que se note que falló
				actualizarEstrellas(cancionId, antes, false);
				animarBoton(btn, "error");
			} finally {
				btn.disabled = false;
			}
		});

		return btn;
	}

	// Tarjeta de canción (miniatura + play + info + estrella).
	// La usan la Biblioteca y Favoritos.
	function crearTarjetaCancion(cancion, indice = 0) {
		const tarjeta = document.createElement("div");
		tarjeta.classList.add("song-card");
		tarjeta.dataset.id = cancion.id;
		// Animación escalonada (con tope para que no tarde en listas grandes)
		tarjeta.style.setProperty("--i", Math.min(indice, 12));

		const thumb = document.createElement("div");
		thumb.classList.add("song-thumb");

		const img = document.createElement("img");
		img.classList.add("song-image");
		img.alt = cancion.nombre || "";
		img.src = cancion.thumbnail || cancion.imagen || "";

		const overlay = document.createElement("div");
		overlay.classList.add("song-play-overlay");
		overlay.innerHTML = `<i class="fa-solid fa-play"></i>`;

		thumb.appendChild(img);
		thumb.appendChild(overlay);

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
		tarjeta.appendChild(crearBotonFavorito(cancion.id));
		return tarjeta;
	}

	// ============================================================
	// 2) VISTA "FAVORITOS"
	// ============================================================

	let favoritos = []; // todas las favoritas (desde la BD)
	let visibles = []; // las que se ven ahora (filtradas + ordenadas) = cola

	function crearEstadoVacio(icono, titulo, texto) {
		const vacio = document.createElement("div");
		vacio.classList.add("empty-state");
		vacio.innerHTML = `
			<div class="empty-state-icon"><i class="fa-solid ${icono}"></i></div>
			<p class="empty-state-title"></p>
			<p class="empty-state-text"></p>
		`;
		vacio.querySelector(".empty-state-title").textContent = titulo;
		vacio.querySelector(".empty-state-text").textContent = texto;
		return vacio;
	}

	function ordenar(lista, criterio) {
		const copia = [...lista];
		copia.sort((a, b) => {
			switch (criterio) {
				case "name_asc":
					return (a.nombre || "").localeCompare(b.nombre || "");
				case "name_desc":
					return (b.nombre || "").localeCompare(a.nombre || "");
				case "artist_asc":
					return (a.artista || "").localeCompare(b.artista || "");
				default: // id_asc: orden en que se agregaron a la biblioteca
					return a.id - b.id;
			}
		});
		return copia;
	}

	// "animar" = false al buscar/ordenar/quitar una favorita, para que las
	// tarjetas no vuelvan a hacer la animación de entrada.
	function renderFavoritos(animar = true) {
		const grid = document.getElementById("favoritesGrid");
		if (!grid) return;

		const buscador = document.getElementById("favoritesSearchInput");
		const selector = document.getElementById("favoritesSortSelect");
		const contador = document.getElementById("favoritesCount");

		const query = buscador ? buscador.value.toLowerCase().trim() : "";
		let lista = favoritos;
		if (query) {
			lista = lista.filter(
				(c) =>
					(c.nombre || "").toLowerCase().includes(query) ||
					(c.artista || "").toLowerCase().includes(query),
			);
		}
		visibles = ordenar(lista, selector ? selector.value : "id_asc");

		if (contador) {
			const total = favoritos.length;
			contador.hidden = total === 0;
			contador.textContent = `${total} canción${total === 1 ? "" : "es"}`;
		}

		grid.classList.toggle("no-anim", !animar);
		grid.innerHTML = "";

		if (favoritos.length === 0) {
			grid.appendChild(
				crearEstadoVacio(
					"fa-star",
					"Aún no tienes favoritas",
					"Pasa el mouse sobre una canción y toca la estrella para guardarla aquí.",
				),
			);
			return;
		}

		if (visibles.length === 0) {
			grid.appendChild(
				crearEstadoVacio(
					"fa-magnifying-glass",
					"No se encontraron canciones",
					"Prueba con otro nombre o artista.",
				),
			);
			return;
		}

		visibles.forEach((cancion, i) => {
			grid.appendChild(crearTarjetaCancion(cancion, i));
		});
	}

	async function cargarDatosFavoritos() {
		try {
			await cargarFavoritosIds();
			favoritos = (await ipcRenderer.invoke("get-favorites")) || [];
		} catch (error) {
			console.error("Error al cargar favoritos:", error);
			favoritos = [];
		}
	}

	async function initFavoritesView() {
		const grid = document.getElementById("favoritesGrid");
		if (!grid) return;

		const buscador = document.getElementById("favoritesSearchInput");
		const selector = document.getElementById("favoritesSortSelect");

		await cargarDatosFavoritos();
		// Si el usuario cambió de vista mientras cargaba, no hacemos nada
		if (!grid.isConnected) return;

		// oninput / onchange / onclick REEMPLAZAN el handler en cada llamada
		// (addEventListener los acumularía al recargar la vista)
		if (buscador) buscador.oninput = () => renderFavoritos(false);
		if (selector) selector.onchange = () => renderFavoritos(false);

		// Al tocar una tarjeta, la cola pasa a ser SOLO la lista de favoritos
		// que se está viendo (igual que con las playlists).
		grid.onclick = (e) => {
			const tarjeta = e.target.closest(".song-card");
			if (!tarjeta) return;

			const id = Number(tarjeta.dataset.id);
			const indice = visibles.findIndex((c) => c.id === id);
			if (indice === -1) return;

			if (typeof window.cargarYReproducirLista === "function") {
				window.cargarYReproducirLista(visibles, indice);
			}
		};

		renderFavoritos(true);
	}

	// Si se marca/desmarca una estrella y la vista de Favoritos está abierta
	// (p. ej. quitas una favorita desde ahí), se actualiza al momento.
	document.addEventListener("favoritos-cambiaron", async () => {
		if (!document.getElementById("favoritesGrid")) return;
		await cargarDatosFavoritos();
		renderFavoritos(false);
	});

	// ============================================================
	// Exponer al entorno global
	// ============================================================
	window.cargarFavoritosIds = cargarFavoritosIds;
	window.crearBotonFavorito = crearBotonFavorito;
	window.crearTarjetaCancion = crearTarjetaCancion;
	window.initFavoritesView = initFavoritesView;
})();
