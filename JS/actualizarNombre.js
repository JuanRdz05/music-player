function actualizarNombreCancion(canciones, indiceCancion, songNameElement) {
	let titulo = canciones[indiceCancion].nombre.split(".");
	titulo.pop();
	songNameElement.innerHTML = titulo.join(".");
}

function actualizarImagenCancion(canciones, indiceCancion, songImageElement) {
	let imagen = canciones[indiceCancion].imagen;
	songImageElement.src = imagen;
}

module.exports = {
	actualizarNombreCancion,
	actualizarImagenCancion,
};
