#!/usr/bin/env node
const path = require("path");
const fs = require("fs").promises;
const readline = require("readline/promises");
const CDP = require("chrome-remote-interface");
const modloader = require("..");

(async () => {
	const config = await modloader.readConfig();
	await modloader.startLauncher(config.remoteDebuggingPort);

	let client;
	try {
		while (!client) {
			let connectionAttempts = 0;
			try {
				client = await CDP({
					host: "localhost",
					port: config.remoteDebuggingPort
				});
			}
			catch (err) {
				await new Promise(resolve => setTimeout(resolve, 1000));

				connectionAttempts++;
				if (connectionAttempts >= 5) {
					break;
				}
			}
		}
		const { Runtime, Page } = client;

		Runtime.on("consoleAPICalled", ({ type, args }) => {
			if (console[type])
				console[type](...args.map(arg => arg.value));
		});
		Runtime.on("executionContextCreated", ({ context }) => {
			console.log("Execution context created:", context);
		});

		await Runtime.enable();
		await Page.enable();

		const reader = await readline.createInterface({
			input: process.stdin,
			output: process.stdout,
			async completer(linePartial) {
				return [linePartial];
			},
			history: [],
			terminal: true,
			tabSize: 4
		});
		reader.on("close", () => {
			client.close()
			process.exit(0)
		});

		while (true) {
			const input = await reader.question("> ");
			if (input[0] === ".") {

			}
			else {
				try {
					const { result } = await Runtime.evaluate({
						expression: input[0] === "~" ? input.slice(1) : input,
						replMode: true,
						allowUnsafeEvalBlockedByCSP: true,
						userGesture: true
					});
					console.log(result.value);

					if (input[0] === "~") {
						console.log("~", await eval(`async () => ${await reader.question("~> ")}`)());
					}
				}
				catch (err) {
					console.log(err);
				}
			}
		}
	}
	catch (err) {
		if (client)
			client.close();
		return console.error(err);
	}
	finally {
		if (client)
			client.close();
	}
})();