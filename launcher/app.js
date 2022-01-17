const win = nw.Window.get();
(async () => {
	try {
		const ReactDOM = require("react-dom");

		const { loadingScreen } = require("./user-interface.js");
		loadingScreen.parentTo(document.getElementById("status-screen"));

		const sdkInstaller = require("./sdk-installer.js");
		try {
			sdkInstaller.setWindow(win);

			const nwPlatform = sdkInstaller.getNWPlatform();
			const version = sdkInstaller.getLocalVersion();
			const arch = sdkInstaller.getLocalArch();

			await sdkInstaller.launch(nwPlatform, version, arch);
		}
		catch (err) {
			sdkInstaller.displayError(err);
		}
	}
	catch (err) {
		win.show();
		alert(err.stack);
	}
	win.close(true);
})();