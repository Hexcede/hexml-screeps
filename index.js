const child_process = require("child_process");
const path = require("path");

const fs = require("./launcher/fs-async.js");
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
	return fs.exists(gameNWPath) && fs.exists(modloaderJsonPath) && fs.exists(packageNWPath) && (await fs.stat(packageNWPath)).isDirectory();
};
const installLauncher = async () => {
	console.log("Installing launcher...");

	// Create modloader json
	if (!fs.exists(modloaderJsonPath)) {
		console.log("Creating modloader json...");
		await fs.writeFile(modloaderJsonPath, JSON.stringify(defaultConfig));
	}

	// Rename package file to prevent the game from launching it instead of the modloader, and to preserve the state for uninstallation
	if (!fs.exists(packageNWBakPath) && fs.exists(packageNWPath) && (await fs.stat(packageNWPath)).isFile()) {
		console.log("Backing up package.nw...");
		await fs.rename(packageNWPath, packageNWBakPath);
	}

	// Copy package.nw backup file to game.nw
	if (fs.exists(packageNWBakPath) && !fs.exists(gameNWPath)) {
		console.log("Copying package.nw backup file to game.nw...");
		await fs.copyFile(packageNWBakPath, gameNWPath);
	}

	// Create directory symlink to "package.nw"
	if (!fs.exists(packageNWPath)) {
		console.log("Creating launcher symlink to package.nw...");
		await fs.symlink(path.join(__dirname, "launcher"), packageNWPath, "dir");
	}
};
const uninstallLauncher = async (deleteMods=false, deleteConfiguration=false) => {
	// if (fs.exists(packageNWBakPath)) {
	// 	await fs.unlink(packageNWPath);
	// 	await fs.rename(packageNWBakPath, packageNWPath);
	// }
	
	if (fs.exists(modloaderJsonPath)) {
		const { installInfo } = JSON.parse(await fs.readFile(modloaderJsonPath));
		const { gameFile, modsFolder } = installInfo;

		// Delete the mods folder
		if (deleteMods)
			await fs.unlink(path.join(gamePath, modsFolder));

		// Delete the modloader json
		if (deleteConfiguration)
			await fs.unlink(modloaderJsonPath);
	}

	// Replace package.nw file with the game.nw file
	if (fs.exists(gameNWPath)) {
		if (fs.exists(packageNWPath))
			await fs.unlink(packageNWPath);
		await fs.rename(gameNWPath, packageNWPath);
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
	if (!fs.exists(modloaderJsonPath))
		return defaultConfig;
	return JSON.parse(await fs.readFile(modloaderJsonPath));
};

module.exports = {
	isLauncherInstalled,
	installLauncher,
	uninstallLauncher,
	startLauncher,
	readConfig
};