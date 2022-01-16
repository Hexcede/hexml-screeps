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

		{
			const executionContextId = 3;
			const { scriptId, exceptionDetails } = await Runtime.compileScript({
				expression: await fs.readFile(path.join(__dirname, "injectionAPI.js"), "utf8"),
				sourceURL: "injectionAPI.js",
				persistScript: true,
				executionContextId
			});

			if (exceptionDetails)
				return console.error("Compile error:", exceptionDetails);

			const runInpsectionAPI = async () => {
				const { exceptionDetails } = await Runtime.runScript({
					scriptId,
					includeCommandLineAPI: true,
					executionContextId
				});

				if (exceptionDetails)
					return console.error("InjectionAPI error:", exceptionDetails);

				const injectionAPI = {};
				injectionAPI.invoke = async (funcName, args, opts={}) => {
					const { result, exceptionDetails } = await Runtime.callFunctionOn({
						functionDeclaration: funcName,
						arguments: args.map(arg => {
							if (typeof arg === "object") {
								if (arg.objectId) {
									return arg;
								}
							}
							return { value: arg };
						}),
						returnByValue: opts.returnByValue,
						awaitPromise: opts.awaitPromise,
						executionContextId
					});

					if (exceptionDetails)
						return console.error("Exception:", exceptionDetails);
					if (opts.returnByValue)
						return result.value;
					return result;
				};

				while (true) {
					const calls = await injectionAPI.invoke("getPendingCalls", [], {
						returnByValue: true,
						awaitPromise: true
					});

					if (calls) {
						for (const callId of calls) {
							const callInfo = await injectionAPI.invoke("getCallInfo", [callId], {
								returnByValue: true
							});
							const [target, funcName, args] = callInfo;

							let localTarget;
							switch (target) {
								case "Runtime": {
									localTarget = Runtime;
									break;
								}
							}

							if (localTarget) {
								const result = [null, false];
								try {
									result[0] = await localTarget[funcName].apply(localTarget, args);
									result[1] = true;
								}
								catch (err) {
									result[0] = err;
									result[1] = false;
								}
								await injectionAPI.invoke("emitCallResult", [callId, result]);
							}
						}
					}
				}
			};
			runInpsectionAPI();
		}

		// {
		// 	await Runtime.evaluate({
		// 		expression: `this._ml_dumpValue = (object, key, value) => {object[key] = value;};`,
		// 		replMode: true,
		// 		allowUnsafeEvalBlockedByCSP: true,
		// 		userGesture: true
		// 	});
		// 	const globalThis = (await Runtime.evaluate({
		// 		expression: `this`
		// 	})).result;

		// 	const globalProto = (await Runtime.evaluate({
		// 		expression: `this.__proto__`
		// 	})).result;

		// 	const windowObjects = (await Runtime.queryObjects({ prototypeObjectId: globalProto.objectId })).objects;
		// 	await Runtime.callFunctionOn({
		// 		functionDeclaration: `_ml_dumpValue`,
		// 		objectId: globalThis.objectId,
		// 		arguments: [
		// 			globalThis,
		// 			{ value: `__windowObjects` },
		// 			windowObjects
		// 		]
		// 	});
		// }

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