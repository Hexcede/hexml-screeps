const path = require("path");

const steamappsBase = (() => {
	switch (process.platform) {
		case "linux":
			return path.join(process.env.HOME, ".steam/steam/steamapps/common")
		case "darwin":
			return path.join(process.env.HOME, "Library/Application Support/Steam/steamapps/common");
		case "win32":
			return "C:\\Program Files (x86)\\Steam\\steamapps\\common";
		default:
			throw new Error(`Unsupported platform. ${process.platform}`);
	}
})();

const nwExe = (() => {
	switch (process.platform) {
		case "win32":
			return "nw.exe";
		case "darwin":
			return "nwjs.app/Contents/MacOS/nwjs";
		case "linux":
			return "nw";
		default:
			throw new Error(`Unsupported platform. ${process.platform}`);
	}
})();

const gamePath = path.join(steamappsBase, "Screeps");
const modloaderJsonPath = path.join(gamePath, "hexcede.modloader.json");
const gameNWPath = path.join(gamePath, "game.nw");

module.exports = {
	gamePath,
	gameNWPath,
	modloaderJsonPath,
	nwExe
};