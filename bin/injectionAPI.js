Object.assign(this,{
	currentCallId: 0,
	pendingCalls: [],
	callInfo: {},
	resultCallbacks: {},
	_currentResolvers: [],

	async remoteApply(target, funcName, ...args) {
		await new Promise((resolve, reject) => {
			this._addPendingCallId(this.currentCallId++, [
				target, funcName, args
			], ([data, success]) => {
				if (success)
					return resolve(data);
				return reject(data);
			});
		})
	},

	_maybeSendAllPendingCalls() {
		if (this.pendingCalls.length) {
			const resolve = this._currentResolve;
			if (resolve)
				resolve(this.pendingCalls.splice(0, this.pendingCalls.length));
		}
	},
	_addPendingCallId(callId, callInfo, callback) {
		this.pendingCalls.push(callId);

		this.callInfo[callId] = callInfo;
		this.resultCallbacks[callId] = callback;

		// Try to send the call we just added
		this._maybeSendAllPendingCalls();
	},

	getPendingCalls() {
		return new Promise((resolve, reject) => {
			// Release prior request
			if (this._currentResolve)
				this._currentResolve();

			// Set the current pending request
			this._currentResolve = resolve;

			// Try to send all pending calls
			this._maybeSendAllPendingCalls();
		});
	},
	getCallInfo(callId) {
		return this.callInfo[callId];
	},
	emitCallResult(callId, result) {
		const callback = this.resultCallbacks[callId];
		if (callback)
			callback(result);
		
		delete this.callInfo[callId];
		delete this.resultCallbacks[callId];
	}
});

setInterval(async () => {
	await remoteApply("Runtime", "evaluate", {
		expression: `console.log("ping");`,
		replMode: true,
		allowUnsafeEvalBlockedByCSP: true,
		userGesture: true
	});
}, 1000);