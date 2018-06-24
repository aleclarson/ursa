
var path = require('path');

var binaryName = [
  process.platform,
  process.arch,
  process.versions.modules,
].join('-');

module.exports = function(name) {
  return require(path.join(
    __dirname, '..', 'vendor', binaryName, (name || 'binding') + '.node'
  ));
};
