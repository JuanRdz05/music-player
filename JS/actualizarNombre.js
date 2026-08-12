module.exports = function actualizarNombreCancion(
	canciones,
	indiceCancion,
	songNameElement,
) {
	let titulo = canciones[indiceCancion].split(".");
	titulo.pop();
	songNameElement.innerHTML = titulo.join(".");
};
