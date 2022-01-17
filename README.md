# hexml-screeps
A fully external Screeps modloader for the steam client.
This is currently just a prototype, there is no actual modloader functionality or user-facing stuff, so I only recommend this if you are interested in the technical details and want to mess with it, or want to contribute.

## Requirements
The modloader requires that you have [Node.js](https://nodejs.org/en/) installed in order to run.
It additionally only works on the Steam client, it will not and cannot work in the browser version.

## Windows & OSX Support
This should support Windows and OSX, but, the installer is untested and will most likely be non functional until I have an opportunity to debug other OS paths in more depth.
You can follow the steps in [Manual Installation](#manual-installation) below to work around any issues, and please feel free to [create a report](../../issues)

## Installation
To install the modloader, clone the repository and open a terminal window within the 
1. Clone the repository, and `cd` into it - `cd hexml-screeps`
2. Install the launcher globally - `npm install -g`
3. Run the modloader's main command - `hexml`

## Manual Installation
If the installer does not work and you need to install and run the modloader manually, you can follow the steps below after cloning the repository.
1. Download the NW.js **SDK** version that matches Screep's NW.js version and your system version (Currently [`v0.40.2`](https://dl.nwjs.io/v0.40.2/))
2. Extract it into the `launcher` folder with the name of the archive (e.g. `nwjs-sdk-v0.40.2-win-x64`)
3. Run the moadloader (`hexml`)

## Technical Details
### The modloader backend
The backend of the moadloader uses the [Chrome DevTools protocol](https://chromedevtools.github.io/devtools-protocol/) in conjunction with Chrome's remote debugging to execute code in the game, without modifying the `package.nw` file. Avoiding the requirement for updating patches means that mods will be more functional across game updates, and the modloader won't make Screeps unlaunchable when issues occur, allowing for mods to gracefully notify users of incompatability, and dynamically adapt themselves to the game.

### Benefits of the DevTools protocol for modding
The usage of the Chrome DevTools protocol additionally allows for a lot of previously unusable power, such as traversing function scopes programatically, and creating isolated JavaScript contexts for mod scripts to execute in. All of the functionality of the DevTools protocol can be found on its [documentation page](https://chromedevtools.github.io/devtools-protocol/).

### The modloader frontend
The frontend (the launcher) works by hotswapping the `package.nw` file for a symlink which points to the launcher's NW.js package.
This package has access to NW.js version information, allowing it to select the correct NW.js SDK and automatically download it.
Once the launcher has determined that it has a valid NW.js version that matches Screeps, it will launch the game using it, and enable remote debugging.
