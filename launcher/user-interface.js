const React = require("react");
const ReactDOM = require("react-dom");
const EventEmitter = require("events");

const loadingScreenEvents = new EventEmitter;
class LoadingScreen extends React.PureComponent {
	defaultStatus = "Please wait a moment...";

	constructor(props) {
		super(props);
		this.state = {
			status: this.defaultStatus,
			icon: false,
			color: false,
			progressValue: false,
			progressLabel: false
		};
	}

	componentDidMount() {
		loadingScreenEvents.on("setState", this.setState.bind(this));
	}

	render() {
		const { state } = this;
		const children = [];

		const messageChildren = [];

		// Create icon
		if (state.icon) {
			const icon = React.createElement("img", {
				src: `./assets/${state.icon}.png`,
				className: "icon"
			});
			messageChildren.push(icon);
		}

		// Create status text
		const statusText = React.createElement("font", null, state.status);
		messageChildren.push(statusText);

		const message = React.createElement("span", { className: "loading-message" }, messageChildren);
		children.push(message);

		// Progress bar
		if (state.progressValue) {
			// Create progress bar
			const progressBar = React.createElement("progress", {
				value: state.progressValue,
				id: "progress"
			});
			children.push(progressBar);

			// Create progress bar label
			if (state.progressLabel) {
				const label = React.createElement("label", { for: "progress" }, state.progressLabel);
				children.push(label);
			}
		}

		return React.createElement("span", {
			className: "loading-screen",
			style: {
				color: state.color
			}
		}, children);
	}
}

const loadingScreenElement = React.createElement(LoadingScreen);

const loadingScreen = {
	loadingScreenElement,
	status(status=this.defaultStatus, icon=false, color=false) {
		loadingScreenEvents.emit("setState", { status, icon, color });
	},
	error(err) {
		this.status(err.stack || err.message || err.toString(), "error");
	},
	updateProgress(progress, label) {
		loadingScreenEvents.emit("setState", {
			progressValue: progress,
			progressLabel: label
		});
	},
	clearProgress() {
		loadingScreenEvents.emit("setState", {
			progressValue: false,
			progressLabel: false
		});
	},

	parentTo(element) {
		ReactDOM.render(this.loadingScreenElement, element);
	}
};

module.exports = {
	LoadingScreen,

	show(win) {
		win.show();
	},
	hide(win) {
		win.hide();
	},

	loadingScreen
};