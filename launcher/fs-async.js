const _fs = require("fs");
const fs = _fs.promises;

fs.exists = (...args) => _fs.existsSync(...args);
fs.createWriteStream = _fs.createWriteStream;
fs.createReadStream = _fs.createReadStream;

module.exports = fs;