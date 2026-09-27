// JS/home.js
// Genera las tarjetas de canciones que se muestran en la vista de Inicio.
// No hace su propia consulta a la base de datos: reutiliza el arreglo
// "canciones" que ya carga renderer.js con ipcRenderer.invoke("get-songs"),
// para no pedir la lista dos veces.

// Cuántas canciones se muestran en el home (el resto vivirá en Biblioteca)
const LIMITE_CANCIONES_HOME = 6;

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

function renderHomeCards() {
	const contenedor = document.querySelector(".card-container");

	// La vista de inicio todavía no está montada en el DOM (por ejemplo,
	// el usuario está en otra ruta). No hay nada que hacer.
	if (!contenedor) return;

	// Las canciones todavía no llegaron desde la base de datos. Cuando
	// terminen de cargar, renderer.js vuelve a llamar a esta misma función.
	if (typeof canciones === "undefined" || canciones.length === 0) return;

	contenedor.innerHTML = "";

	canciones.slice(0, LIMITE_CANCIONES_HOME).forEach((cancion) => {
		contenedor.appendChild(crearTarjetaCancionHome(cancion));
	});

	// Delegación de eventos: como el contenedor se vacía y se vuelve a
	// llenar en cada render, es seguro añadir el listener una sola vez aquí.
	contenedor.addEventListener("click", (e) => {
		const tarjeta = e.target.closest(".song-card");
		if (!tarjeta) return;

		const id = Number(tarjeta.dataset.id);
		const indiceSeleccionado = canciones.findIndex(
			(cancion) => cancion.id === id,
		);
		if (indiceSeleccionado === -1) return;

		if (indiceSeleccionado !== indiceCancion) {
			actualizarConAnimacion();
		}
		reproducirCancion(indiceSeleccionado);
	});
}

// router.js llama a esto justo después de insertar pages/home.html en el DOM.
// renderer.js llama a esto justo después de que "canciones" termina de cargar.
window.initHomeView = renderHomeCards;
