// JS/library.js
// Lógica para la vista de "Biblioteca".
// Reutiliza el arreglo global "canciones" que carga renderer.js.

function renderLibraryCards(cancionesAMostrar) {
	const contenedor = document.getElementById("libraryGrid");

	// Si no estamos en la vista de biblioteca, no hacemos nada
	if (!contenedor) return;

	contenedor.innerHTML = "";

	if (!cancionesAMostrar || cancionesAMostrar.length === 0) {
		contenedor.innerHTML = `<div class="empty-library">
            <i class="fa-solid fa-music"></i>
            <p>No se encontraron canciones.</p>
        </div>`;
		return;
	}

	cancionesAMostrar.forEach((cancion) => {
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
		contenedor.appendChild(tarjeta);
	});
}

function initLibraryView() {
	const searchInput = document.getElementById("librarySearchInput");
	const sortSelect = document.getElementById("librarySortSelect");
	const grid = document.getElementById("libraryGrid");

	if (!grid) return;
	// Si las canciones aún no han sido cargadas por renderer.js, salir.
	// Cuando se carguen, renderer.js llamará a esta función nuevamente.
	if (typeof canciones === "undefined") return;

	// Función para aplicar filtros de búsqueda y orden
	function updateLibrary() {
		let filteredSongs = [...canciones];

		// 1. Filtrar por búsqueda
		if (searchInput) {
			const query = searchInput.value.toLowerCase().trim();
			if (query) {
				filteredSongs = filteredSongs.filter(
					(c) =>
						c.nombre.toLowerCase().includes(query) ||
						c.artista.toLowerCase().includes(query)
				);
			}
		}

		// 2. Ordenar
		if (sortSelect) {
			const sortValue = sortSelect.value;
			filteredSongs.sort((a, b) => {
				if (sortValue === "name_asc") {
					return a.nombre.localeCompare(b.nombre);
				} else if (sortValue === "name_desc") {
					return b.nombre.localeCompare(a.nombre);
				} else if (sortValue === "artist_asc") {
					return a.artista.localeCompare(b.artista);
				} else {
					// Predeterminado por ID (orden de subida)
					return a.id - b.id;
				}
			});
		}

		// 3. Renderizar las tarjetas
		renderLibraryCards(filteredSongs);
	}

	// Agregar eventos para que se actualice al buscar o cambiar el orden
	if (searchInput) searchInput.addEventListener("input", updateLibrary);
	if (sortSelect) sortSelect.addEventListener("change", updateLibrary);

	// Renderizar la primera vez que se carga la vista
	updateLibrary();

	// Delegación de eventos para reproducir canción al dar clic en una tarjeta
	grid.addEventListener("click", (e) => {
		const tarjeta = e.target.closest(".song-card");
		if (!tarjeta) return;

		const id = Number(tarjeta.dataset.id);
		const indiceSeleccionado = canciones.findIndex((c) => c.id === id);
		if (indiceSeleccionado === -1) return;

		if (
			typeof indiceCancion !== "undefined" &&
			indiceSeleccionado !== indiceCancion
		) {
			if (typeof actualizarConAnimacion === "function") {
				actualizarConAnimacion();
			}
		}
		
		if (typeof reproducirCancion === "function") {
			reproducirCancion(indiceSeleccionado);
		}
	});
}

// Exponer la función globalmente para que router.js y renderer.js puedan llamarla
window.initLibraryView = initLibraryView;
