const path = require("path");
const fs = require("fs");
const fsAsync = fs.promises;

const extract = require("extract-zip");
const yauzl = require("yauzl");
const tar = require("tar-stream");
const gunzipStream = require("gunzip-stream");

module.exports = async (loadingScreen, archiveType, zipPath, dir) => {
	switch (archiveType) {
		case "zip": {
			// TODO: Validate that this works properly
			const zipfile = yauzl.open(zipPath);

			let entryCount = 0;
			const totalEntries = zipfile.entryCount;

			loadingScreen.status(`Extracting ${totalEntries} files to ${dir}...`);
			loadingScreen.update(0);
			await extract(zipPath, {
				dir,
				onEntry: async (entry) => {
					entryCount++;
					loadingScreen.status(`Installing NW.js - Extracting file...`);
					loadingScreen.updateProgress(entryCount/totalEntries, entry.fileName);
				}
			});
			break;
		}
		case "tar.gz": {
			const stats = await fsAsync.stat(zipPath);
			const totalSize = stats.size;

			await new Promise((resolve, reject) => {
				const extract = tar.extract();
				
				loadingScreen.status(`Extracting ${totalSize} bytes to ${dir}...`);
				extract.on("entry", async (header, stream, next) => {
					new Promise(async (resolve, reject) => {
						try {
							const { type, size, name, mode } = header;
							const rerooted = name.split(path.sep);
							rerooted.splice(0, 1);
							const filename = path.join(dir, ...rerooted);

							loadingScreen.status(`Installing NW.js - Extracting ${type}...`);
							loadingScreen.updateProgress(0, name);

							switch (type) {
								case "file": {
									const entrydir = path.dirname(filename)
									if (!fs.existsSync(entrydir))
										await fsAsync.mkdir(entrydir, { recursive: true });
									
									const total = size;
									let progress = 0;
									stream.on("data", async (chunk) => {
										try {
											progress += chunk.length;
											loadingScreen.updateProgress(progress/total, name);
										}
										catch (err) {
											reject(err);
										}
									});
									
									stream.pipe(fs.createWriteStream(filename));
									stream.on("end", async () => {
										await fsAsync.chmod(filename, mode);
										resolve();
									});
									stream.on("error", reject);
									stream.resume();
									return
								}
								case "directory": {
									if (!fs.existsSync(filename))
										await fsAsync.mkdir(filename, { recursive: true });
									await fsAsync.chmod(filename, mode);
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
			alert(`Unsupported archive format: ${archiveType}. Please report this.`);
	}
}