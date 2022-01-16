const { gamePath, gameNWPath, nwExe } = require("./variables.js");

const win = nw.Window.get();
(async () => {
	// await new Promise((resolve, reject) => {
	// 	setTimeout(resolve);
	// });

	const path = require("path");
	const fs = require("./fs-async.js");
	const child_process = require("child_process");
	const extract = require("extract-zip");
	const yauzl = require("yauzl");
	const tar = require("tar-stream");
	const gunzipStream = require("gunzip-stream");

	const statusText = document.getElementById("status");

	const version = process.versions["nw"];
	const flavor = process.versions["nw-flavor"];
	const platform = process.platform;
	const arch = process.arch;

	const nwPlatformMap = {
		"win32": "win",
		"darwin": "osx",
		"linux": "linux"
	};
	const nwPlatform = nwPlatformMap[platform];

	const ext = platform === "linux" ? "tar.gz" : "zip";
	
	const sdkPath = "./sdk";
	// if (flavor !== "sdk") {
	if (!fs.exists(sdkPath)) {
		win.show();
		win.focus();

		const targetfile = `nwjs-sdk-v${version}-${nwPlatform}-${arch}.${ext}`;
		const dltarget = `https://dl.nwjs.io/v${version}/${targetfile}`;
		if (!confirm(`Screem needs a copy of the NW.js SDK flavor. Press OK to download & install it automatically.\nCurrent NW.js information\n\tFlavor: ${flavor}\n\tVersion: ${version}\n\tPlatform: ${nwPlatform}\n\tArchitecture: ${arch}\n\tTarget: ${dltarget}`))
			return close();
		
		try {
			// Download SDK

			const toPercentage = (decimal) => Math.round(decimal * 100 * 1e1)/1e1;

			statusText.innerText = "Locating NW.js SDK...";

			const tmp = nwPlatform === "win" ? process.env.TEMP : nwPlatform === "osx" ? process.env.TMPDIR : "/tmp";
			if (!fs.exists(tmp))
				throw new Error("Could not locate temporary directory.");

			const zipPath = path.join(tmp, targetfile);
			if (!fs.exists(zipPath)) {
				(await new Promise((resolve, reject) => {
					const xhr = new XMLHttpRequest();
					xhr.open("GET", dltarget, true);
					xhr.responseType = "blob";

					xhr.addEventListener("progress", async (progress) => {
						statusText.innerText = `Downloading NW.js SDK...\n${toPercentage(progress.loaded / progress.total)}%`;
					});

					xhr.addEventListener("load", async () => {
						try {
							if (xhr.status === 200) {
								const blob = xhr.response;

								statusText.innerText = `Saving downloaded zip 0%...`;
								const writeStream = fs.createWriteStream(zipPath);
								const reader = new FileReader();
								reader.addEventListener("loadend", async () => {
									try {
										writeStream.write(Buffer.from(reader.result));
										writeStream.close();

										statusText.innerText = "Saved successfully.";
										resolve();
									}
									catch (err) {
										alert(err.stack);
										reject(err);
									}
								});
								reader.addEventListener("progress", async (progress) => {
									statusText.innerText = `Saving downloaded zip ${toPercentage(progress.loaded / progress.total)}%...`;
								});
								reader.addEventListener("error", reject);
								reader.readAsArrayBuffer(blob);
							} else {
								switch (xhr.status) {
									case 404:
										alert(`No NW.js SDK version exists for the target. Please download the SDK manually, and extract it to a folder called "sdk" (make sure this folder is within the screeps directory).`);
										break;
									default: alert(`Failed to download SDK. HTTP ${xhr.status}`);
								}
								reject();
								close();
							}
						}
						catch (err) {
							reject();
							alert(`Failed to extract SDK:\n${err.stack}`);
							close();
						}
					});

					xhr.send();
				}));
			}
			else {
				statusText.innerText = "Found cached zip...";
			}

			if (!fs.exists(sdkPath))
				await fs.mkdir(sdkPath, { recursive: true });

			switch (ext) {
				case "zip": {
					// const JSZip = require("jszip");
					// const zip = new JSZip();

					// await zip.loadAsync(blob);
					
					// zip.forEach((relativePath, file) => {
					// 	// Don't write absolute paths
					// 	if (path.isAbsolute(relativePath))
					// 		return;

					// 	// Normalize path from zip
					// 	const normalized = path.normalize(relativePath);

					// 	// Don't write to parent directories
					// 	if (normalized.indexOf("..") === 0 || normalized.indexOf("../") !== -1)
					// 		return;
						
					// 	const targetPath = path.join(sdkPath, normalized);
					// 	if (file.dir) { // Directory
					// 		if (!fs.existsSync(targetPath))
					// 			await fs.mkdir(targetPath, { recursive: true });
					// 	}
					// 	else { // File
					// 		// Create parent directory if it doesn't exist
					// 		const targetDir = path.dirname(targetPath);
					// 		if (!fs.existsSync(targetDir))
					// 			await fs.mkdir(targetDir, { recursive: true });

					// 		// Write the file
					// 		await fs.writeFile(targetPath, await file.async("nodebuffer"));
					// 	}
					// });

					// TODO: Validate

					statusText.innerText = `Preparing to extract...`;
					const zipfile = yauzl.open(zipPath);//yauzl.fromBuffer(await blob.arrayBuffer())

					let entryCount = 0;
					const totalEntries = zipfile.entryCount;

					statusText.innerText = `Preparing to extract (${totalEntries} files)...`;
					await extract(zipPath, {
						dir: sdkPath,
						onEntry: async (entry) => {
							entryCount++;
							statusText.innerText = `Extracting NW.js SDK zip to ${sdkPath}...\n${toPercentage(entryCount/totalEntries)}% (${entry.fileName})`;
						}
					});
					break;
				}
				case "tar.gz": {
					statusText.innerText = `Preparing to extract...`;

					const stats = await fs.stat(zipPath);
					const totalSize = stats.size;

					await new Promise((resolve, reject) => {
						const extract = tar.extract();
					
						statusText.innerText = `Preparing to extract (${totalSize} bytes)...`;
						extract.on("entry", async (header, stream, next) => {
							new Promise(async (resolve, reject) => {
								try {
									const { type, size, name, mode } = header;
									const rerooted = name.split(path.sep);
									rerooted.splice(0, 1);
									const filename = path.join(sdkPath, ...rerooted);

									statusText.innerText = `Extracting ${type}...\n'${filename}' (${name})`;

									switch (type) {
										case "file": {
											const entrydir = path.dirname(filename)
											if (!fs.exists(entrydir))
												await fs.mkdir(entrydir, { recursive: true });
											
											const total = size;
											let progress = 0;
											stream.on("data", async (chunk) => {
												try {
													progress += chunk.length;
													statusText.innerText = `Extracting ${type}...\n'${filename}' ${toPercentage(progress / total)}% (${name})`;
												}
												catch (err) {
													reject(err);
												}
											});
											
											stream.pipe(fs.createWriteStream(filename));
											stream.on("end", async () => {
												await fs.chmod(filename, mode);
												resolve();
											});
											stream.on("error", reject);
											stream.resume();
											return
										}
										case "directory": {
											if (!fs.exists(filename))
												await fs.mkdir(filename, { recursive: true });
											await fs.chmod(filename, mode);
											break;
										}
										default: alert(`Unknown header type: ${type}`);
									}
									resolve();
								}
								catch (err) {
									reject(err);
								}
							}).catch((err) => alert(err.stack)).finally(next);
						});
						extract.on("finish", resolve);
						extract.on("error", reject);

						const gunzip = gunzipStream.createGunzip();
						fs.createReadStream(zipPath).pipe(gunzip).pipe(extract);
					});
					break;
				}
				default:
					alert(`Unsupported extension for SDK download: ${ext}. Please report this.`);
			}
			statusText.innerText = "Done! Restarting with SDK...";
		}
		catch (err) {
			alert(`Failed to download SDK:\n${err.stack}`);
		}
	}

	// Greenworks
	if (!fs.exists(path.join(sdkPath, "greenworks")))
		await fs.symlink(path.join(gamePath, "greenworks"), path.join(sdkPath, "greenworks"), "dir");
	if (!fs.exists(path.join(sdkPath, "steam_appid.txt")))
		await fs.symlink(path.join(gamePath, "steam_appid.txt"), path.join(sdkPath, "steam_appid.txt"), "file");

	// Apply updates
	const updateFile = path.join(sdkPath, "package.nw");
	if (fs.exists(updateFile)) {
		await fs.rename(updateFile, gameNWPath);
	}

	// Launch Screeps with SDK
	const args = nw.App.fullArgv;
	args.splice(0, 0, gameNWPath);
	args[1] = `--remote-debugging-port=${args[1]}`;

	const sdkExe = "." + path.sep + path.join(sdkPath, nwExe);
	const child = child_process.spawn(sdkExe, args, {
		detached: true,
		stdio: "ignore",
		windowsHide: true
	});
	child.unref();
	await new Promise((resolve, reject) => {
		child.on("error", reject);
		setTimeout(resolve, 1000);
	});
})().catch(err => {
	win.show();
	win.focus();
	alert(`Failed to launch Screeps:\n${err.stack}`);
}).then(close);