// JS/dialogo.js
// Reemplazo de alert() y confirm() con un diálogo HTML propio.
//
//   const ok = await confirmar({ titulo, mensaje, textoConfirmar, tipo });
//   await avisar({ titulo, mensaje, tipo });
//
// tipo: "peligro" (rojo, por defecto en confirmar) | "info"
// Debe cargarse ANTES que los demás scripts que lo usan (ver index.html).
(function () {
	const ICONOS = {
		peligro: "fa-triangle-exclamation",
		info: "fa-circle-info",
	};

	let overlay = null;
	let resolverActual = null;

	// Se crea una sola vez, la primera vez que se necesita
	function crearDOM() {
		overlay = document.createElement("div");
		overlay.classList.add("dialog-overlay");
		overlay.innerHTML = `
			<div class="dialog-box" role="alertdialog" aria-modal="true">
				<div class="dialog-icon"><i class="fa-solid"></i></div>
				<h3 class="dialog-title"></h3>
				<p class="dialog-message"></p>
				<div class="dialog-actions">
					<button type="button" class="dialog-btn dialog-btn-cancel"></button>
					<button type="button" class="dialog-btn dialog-btn-confirm"></button>
				</div>
			</div>
		`;
		document.body.appendChild(overlay);

		overlay
			.querySelector(".dialog-btn-cancel")
			.addEventListener("click", () => cerrar(false));
		overlay
			.querySelector(".dialog-btn-confirm")
			.addEventListener("click", () => cerrar(true));

		// Clic en el fondo oscuro = cancelar
		overlay.addEventListener("click", (e) => {
			if (e.target === overlay) cerrar(false);
		});

		// Fase de captura + stopImmediatePropagation: el Escape/Enter que
		// cierra este diálogo NO llega a los modales que hay debajo
		// (ellos también escuchan Escape en document).
		window.addEventListener(
			"keydown",
			(e) => {
				if (!overlay.classList.contains("active")) return;

				if (e.key === "Escape") {
					e.stopImmediatePropagation();
					cerrar(false);
				} else if (e.key === "Enter") {
					e.stopImmediatePropagation();
					e.preventDefault();
					// Enter confirma lo que tenga el foco (cancelar o aceptar)
					const foco = document.activeElement;
					cerrar(!(foco && foco.classList.contains("dialog-btn-cancel")));
				}
			},
			true,
		);
	}

	function cerrar(resultado) {
		if (!overlay) return;
		overlay.classList.remove("active");
		if (resolverActual) {
			const resolver = resolverActual;
			resolverActual = null;
			resolver(resultado);
		}
	}

	function abrir({
		titulo = "",
		mensaje = "",
		textoConfirmar = "Aceptar",
		textoCancelar = "Cancelar",
		tipo = "info",
		soloAceptar = false,
	}) {
		if (!overlay) crearDOM();

		// Si ya había uno abierto, se cancela para no dejar promesas colgadas
		if (resolverActual) cerrar(false);

		const caja = overlay.querySelector(".dialog-box");
		const btnCancel = overlay.querySelector(".dialog-btn-cancel");
		const btnConfirm = overlay.querySelector(".dialog-btn-confirm");

		caja.dataset.tipo = tipo;
		overlay.querySelector(".dialog-icon i").className =
			`fa-solid ${ICONOS[tipo] || ICONOS.info}`;
		// textContent: el texto nunca se interpreta como HTML
		overlay.querySelector(".dialog-title").textContent = titulo;
		overlay.querySelector(".dialog-message").textContent = mensaje;
		btnConfirm.textContent = textoConfirmar;
		btnCancel.textContent = textoCancelar;
		btnCancel.hidden = soloAceptar;

		overlay.classList.add("active");

		// En acciones destructivas el foco inicial va en "Cancelar":
		// un Enter accidental no borra nada.
		(tipo === "peligro" && !soloAceptar ? btnCancel : btnConfirm).focus();

		return new Promise((resolve) => {
			resolverActual = resolve;
		});
	}

	// Equivalente a confirm(): devuelve una Promesa<boolean>
	window.confirmar = (opciones) =>
		abrir({ tipo: "peligro", ...opciones, soloAceptar: false });

	// Equivalente a alert(): devuelve una Promesa que se resuelve al cerrar
	window.avisar = (opciones) =>
		abrir({ tipo: "info", ...opciones, soloAceptar: true }).then(() => {});
})();
