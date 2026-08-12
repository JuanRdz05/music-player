module.exports = function formatTime(seconds) {
	if (isNaN(seconds)) return "0:00";
	const min = Math.floor(seconds / 60);
	const sec = Math.floor(seconds % 60);
	return `${min}:${sec < 10 ? "0" : ""}${sec}`;
};
