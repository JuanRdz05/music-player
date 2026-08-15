const fs = require("fs/promises");
const path = require("path");
const sharp = require("sharp");

const CONFIG = {
	//Carpeta donde estan las imagenes
	sourceDir: path.join(__dirname, "../img"),
	//Carpeta donde se guardaran las imagenes reducidads
	thumbsDir: path.join(__dirname, "../img", "thumbnails"),
	//Tamaño de las imagenes
	thumbSize: 150,
	//Extensiones que se procesarán
	extensions: [".png", ".jpg", ".jpeg", ".webp"],
};

async function generateThumbnail(sourcePath, destPath) {
	try {
		await fs.access(destPath);
		return { skipped: true, file: path.basename(sourcePath) };
	} catch {}

	await sharp(sourcePath)
		.resize(CONFIG.thumbSize, CONFIG.thumbSize, {
			fit: "cover",
			position: "centre",
		})
		.resize({ kernel: sharp.kernel.lanczos3 })
		.toFile(destPath);

	return { skipped: false, file: path.basename(sourcePath) };
}

async function generateAllThumbnails() {
	await fs.mkdir(CONFIG.thumbsDir, { recursive: true });

	const entries = await fs.readdir(CONFIG.sourceDir, { withFileTypes: true });

	const imageFiles = entries.filter((entry) => {
		if (!entry.isFile()) return false;
		const ext = path.extname(entry.name).toLowerCase();
		return CONFIG.extensions.includes(ext);
	});

	console.log(
		`Encontradas ${imageFiles.length} imágenes en ${CONFIG.sourceDir}`,
	);

	const results = await Promise.all(
		imageFiles.map((entry) => {
			const sourcePath = path.join(CONFIG.sourceDir, entry.name);
			const destPath = path.join(CONFIG.thumbsDir, entry.name);
			return generateThumbnail(sourcePath, destPath).catch((err) => {
				console.error(`Error procesando ${entry.name}:`, err.message);
				return { skipped: false, failed: true, file: entry.name };
			});
		}),
	);

	const generated = results.filter((r) => !r.skipped && !r.failed).length;
	const skipped = results.filter((r) => r.skipped).length;
	const failed = results.filter((r) => r.failed).length;

	console.log(
		`Listo → generados: ${generated}, ya existían: ${skipped}, fallidos: ${failed}`,
	);
}

async function getThumbnailPath(originalImagePath) {
	const filename = path.basename(originalImagePath);
	const destPath = path.join(CONFIG.thumbsDir, filename);

	await fs.mkdir(CONFIG.thumbsDir, { recursive: true });
	await generateThumbnail(originalImagePath, destPath);

	return destPath;
}

module.exports = { generateAllThumbnails, getThumbnailPath, CONFIG };

if (require.main === module) {
	generateAllThumbnails().catch((err) => {
		console.error("Error generando thumbnails:", err);
		process.exit(1);
	});
}
