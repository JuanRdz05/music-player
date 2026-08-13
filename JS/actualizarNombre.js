function actualizarNombreCancion(canciones, indiceCancion, songNameElement) {
	let titulo = canciones[indiceCancion].nombre.split(".");
	titulo.pop();
	songNameElement.innerHTML = titulo.join(".");
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
