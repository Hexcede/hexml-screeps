const path = require("path");
const fs = require("fs");
const child_process = require("child_process");

const util = require("util");
const rmdir = util.promisify(require("rimraf"));

const fsAsync = fs.promises;

const UI = require("./user-interface.js");
const { loadingScreen } = UI;

const { getTempFolderPath, gamePath, gameNWPath, nwExe } = require("./variables.js");

const nwjsHost = "https://dl.nwjs.io";
module.exports = {
	setWindow(win) {
		this.window = win;
	},
	displayError(err) {
		UI.show(this.window);

		loadingScreen.error(`Failed to download.`);
		alert(err.stack || err);
	},

	getTargetNWJS(nwPlatform, version, arch, flavor="sdk") {
		return `nwjs-${flavor}-v${version}-${nwPlatform}-${arch}`;
	},
	getSDKPath(nwPlatform, version, arch, flavor="sdk") {
		return path.join(__dirname, this.getTargetNWJS(nwPlatform, version, arch, flavor));
	},

	async downloadNWJS(nwPlatform, version, arch, flavor="sdk") {
		const archiveType = nwPlatform === "linux" ? "tar.gz" : "zip";
		const targetFile = `${this.getTargetNWJS(nwPlatform, version, arch, flavor)}.${archiveType}`;
		const remoteFile = new URL(`v${version}/${targetFile}`, nwjsHost).href;

		const tmp = getTempFolderPath();
		if (!fs.existsSync(tmp))
			throw new Error("Could not locate temporary directory.");
		
		const sdkDownloadPath = path.join(tmp, targetFile);
		const downloadExists = fs.existsSync(sdkDownloadPath);
		const downloadFail = downloadExists && (await fsAsync.stat(sdkDownloadPath)).size === 0;

		if (this.isSDKVersionInstalled(nwPlatform, version, arch, flavor) && !downloadFail)
			return loadingScreen.status("Already installed...");

		// We're going to be displaying a lot of information, not just launching the game, so show the status screen
		UI.show(this.window);
		loadingScreen.status(`Locating NW.js v${version}...`);

		if (!downloadExists || downloadFail) {
			if (downloadExists)
				await fsAsync.unlink(sdkDownloadPath);

			loadingScreen.status(`Downloading NW.js v${version}...`);
			loadingScreen.updateProgress(0);
			await new Promise((resolve, reject) => {
				const xhr = new XMLHttpRequest();
				xhr.open("GET", remoteFile, true);
				xhr.responseType = "blob";

				xhr.addEventListener("progress", async (progress) => {
					loadingScreen.updateProgress(progress.loaded / progress.total);
				});

				xhr.addEventListener("load", async () => {
					try {
						if (xhr.status >= 200 && xhr.status < 300) {
							loadingScreen.status("Saving downloaded zip...");
							loadingScreen.updateProgress(0);

							const blob = xhr.response;

							const writeStream = fs.createWriteStream(sdkDownloadPath);
							const reader = new FileReader();
							reader.addEventListener("loadend", async () => {
								try {
									writeStream.write(Buffer.from(reader.result));
									writeStream.close();

									loadingScreen.status("Please wait...");
									resolve();
								}
								catch (err) {
									reject(err);
								}
							});
							reader.addEventListener("progress", async (progress) => {
								loadingScreen.updateProgress(progress.loaded / progress.total);
							});
							reader.addEventListener("error", reject);
							reader.readAsArrayBuffer(blob);
						}
						else {
							switch (xhr.status) {
								case 404:
									loadingScreen.error(`NW.js version ${version} doesn't seem to exist or is missing the target flavor.`);
									break;
								default:
									loadingScreen.error(`Failed to download. HTTP ${xhr.status}`);
							}
							reject();
							close();
						}
					}
					catch (err) {
						this.displayError(err);
					}
				});
				xhr.addEventListener("error", reject);
				xhr.send();
			}).catch(this.displayError.bind(this));
		}
		else {
			loadingScreen.status("Found cached version...");
			loadingScreen.updateProgress(1);
		}

		const sdkPath = this.getSDKPath(nwPlatform, version, arch, flavor);
		if (fs.existsSync(sdkPath))
			await rmdir(sdkPath); // Node 12.9.x compatability for old nw.js versions
		await fsAsync.mkdir(sdkPath, { recursive: true });

		// Extract SDK
		loadingScreen.status("Preparing to extract...");
		loadingScreen.updateProgress(false);

		const extract = require("./extractor.js");
		await extract(loadingScreen, archiveType, sdkDownloadPath, sdkPath);
	},
	getNWPlatform() {
		switch (process.platform) {
			case "win32":
				return "win";
			case "darwin":
				return "osx";
			case "linux":
				return "linux";
		}
	},
	getLocalVersion() {
		return process.versions["nw"];
	},
	getLocalFlavor() {
		return process.versions["nw-flavor"];
	},
	getLocalArch() {
		return process.arch;
	},
	isSDKVersionInstalled(nwPlatform, version, arch, flavor="sdk") {
		const dir = path.join(__dirname, this.getTargetNWJS(nwPlatform, version, arch, flavor));
		return fs.existsSync(dir) && fs.existsSync(path.join(dir, nwExe));
	},
	async installSDK(nwPlatform, version, arch, flavor="sdk") {
		await this.downloadNWJS(nwPlatform, version, arch, flavor);

		loadingScreen.status("Installed...");
		loadingScreen.updateProgress(false);
	},
	async launch(nwPlatform, version, arch, flavor="sdk") {
		await this.installSDK(nwPlatform, version, arch, flavor);

		const sdkPath = this.getSDKPath(nwPlatform, version, arch, flavor);

		// Greenworks
		if (!fs.existsSync(path.join(sdkPath, "greenworks")))
			await fsAsync.symlink(path.join(gamePath, "greenworks"), path.join(sdkPath, "greenworks"), "dir");
		if (!fs.existsSync(path.join(sdkPath, "steam_appid.txt")))
			await fsAsync.symlink(path.join(gamePath, "steam_appid.txt"), path.join(sdkPath, "steam_appid.txt"), "file");

		// Apply updates that the game makes
		const updateFile = path.join(sdkPath, "package.nw");
		if (fs.existsSync(updateFile)) {
			loadingScreen.status("Applying update...");
			await fsAsync.rename(updateFile, gameNWPath);
		}

		// Update status
		loadingScreen.status("Starting the game...");

		// Get the arguments
		const args = nw.App.fullArgv; // Get full list of arguments
		args.splice(0, 0, gameNWPath); // Add the game path to the front
		args[1] = `--remote-debugging-port=${args[1]}`; // Add the remote debugging port option

		// Launch the game
		const sdkExe = path.join(sdkPath, nwExe);

		const child = child_process.spawn(sdkExe, args, {
			detached: true,
			stdio: "ignore",
			windowsHide: true
		});
		child.unref();

		loadingScreen.status("Finishing up...");
	}
};