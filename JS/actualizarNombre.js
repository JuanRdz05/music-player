function actualizarNombreCancion(canciones, indiceCancion, songNameElement) {
	songNameElement.textContent = canciones[indiceCancion].nombre;
}

function actualizarImagenCancion(canciones, indiceCancion, songImageElement) {
	let imagen = canciones[indiceCancion].imagen;
	songImageElement.src = imagen;

	const fondoContainer = document.querySelector(".fondo-container");
	if (fondoContainer) {
		fondoContainer.style.backgroundImage = `url('${imagen}')`;
	}
}

module.exports = {
	actualizarNombreCancion,
	actualizarImagenCancion,
};
