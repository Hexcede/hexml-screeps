const child_process = require("child_process");
const path = require("path");

const fs = require("fs");
const fsAsync = fs.promises;
const { modloaderJsonPath, gamePath, gameNWPath, nwExe } = require("./launcher/variables.js");

const packageNWPath = path.join(gamePath, "package.nw");
const packageNWBak = "package.nw.original";
const packageNWBakPath = path.join(gamePath, packageNWBak);

// Default modloader configuration
const defaultConfig = {
	isEnabled: true,
	installInfo: {
		packageBak: packageNWBak,
		gameFile: path.relative(gamePath, gameNWPath),
		modsFolder: "mods"
	},
	remoteDebuggingPort: 40449,
	mods: {}
};

const isLauncherInstalled = async () => {
	return fs.existsSync(gameNWPath) && fs.existsSync(modloaderJsonPath) && fs.existsSync(packageNWPath) && (await fsAsync.stat(packageNWPath)).isDirectory();
};
const installLauncher = async () => {
	console.log("Installing launcher...");

	// Create modloader json
	if (!fs.existsSync(modloaderJsonPath)) {
		console.log("Creating modloader json...");
		await fsAsync.writeFile(modloaderJsonPath, JSON.stringify(defaultConfig));
	}

	// Rename package file to prevent the game from launching it instead of the modloader, and to preserve the state for uninstallation
	if (!fs.existsSync(packageNWBakPath) && fs.existsSync(packageNWPath) && (await fsAsync.stat(packageNWPath)).isFile()) {
		console.log("Backing up package.nw...");
		await fsAsync.rename(packageNWPath, packageNWBakPath);
	}

	// Copy package.nw backup file to game.nw
	if (fs.existsSync(packageNWBakPath) && !fs.existsSync(gameNWPath)) {
		console.log("Copying package.nw backup file to game.nw...");
		await fsAsync.copyFile(packageNWBakPath, gameNWPath);
	}

	// Create directory symlink to "package.nw"
	if (!fs.existsSync(packageNWPath)) {
		console.log("Creating launcher symlink to package.nw...");
		await fsAsync.symlink(path.join(__dirname, "launcher"), packageNWPath, "dir");
	}
};
const uninstallLauncher = async (deleteMods=false, deleteConfiguration=false) => {
	// if (fs.existsSync(packageNWBakPath)) {
	// 	await fsAsync.unlink(packageNWPath);
	// 	await fsAsync.rename(packageNWBakPath, packageNWPath);
	// }
	
	if (fs.existsSync(modloaderJsonPath)) {
		const { installInfo } = JSON.parse(await fsAsync.readFile(modloaderJsonPath));
		const { gameFile, modsFolder } = installInfo;

		// Delete the mods folder
		if (deleteMods)
			await fsAsync.unlink(path.join(gamePath, modsFolder));

		// Delete the modloader json
		if (deleteConfiguration)
			await fsAsync.unlink(modloaderJsonPath);
	}

	// Replace package.nw file with the game.nw file
	if (fs.existsSync(gameNWPath)) {
		if (fs.existsSync(packageNWPath))
			await fsAsync.unlink(packageNWPath);
		await fsAsync.rename(gameNWPath, packageNWPath);
	}
};
const startLauncher = async (remoteDebuggingPort) => {
	if (!await isLauncherInstalled())
		await installLauncher();

	// Start the launcher
	const child = child_process.spawn(path.join(gamePath, nwExe), [remoteDebuggingPort.toString()], {
		// detached: true,
		// stdio: "ignore",
		windowsHide: true
	});
	// child.unref();

	await new Promise((resolve, reject) => {
		child.on("error", reject);
		child.on("exit", resolve);
	});
};
const readConfig = async () => {
	if (!fs.existsSync(modloaderJsonPath))
		return defaultConfig;
	return JSON.parse(await fsAsync.readFile(modloaderJsonPath));
};

module.exports = {
	isLauncherInstalled,
	installLauncher,
	uninstallLauncher,
	startLauncher,
	readConfig
};