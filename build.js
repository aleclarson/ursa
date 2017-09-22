#!/usr/bin/env node

var {spawn} = require('child_process');
var path = require('path');
var fs = require('fs');

if (hasArgument('-h') || hasArgument('--help')) {
  return console.log('\n' + [
    '-n --name      The file path to the native binding (defaults to "binding")',
    '-p --platform  Either "node" or "electron" (defaults to "node")',
    '-t --target    The platform version (optional)',
    '--version      The module version (optional)',
  ].join('\n') + '\n');
}

build();

//
// Helpers
//

function build() {
  var bindingName = getArgument('-n') || getArgument('--name') || 'binding';
  var platform = getArgument('-p') || getArgument('--platform') || 'node';
  var target = getArgument('-t') || getArgument('--target') || getTarget(platform);

  console.log('');
  console.log('bindingPath = ' + bindingName);
  console.log('platform = ' + platform);
  console.log('target = ' + target);
  console.log('arch = ' + process.arch);
  console.log('');

  var gypPath = require.resolve(path.join('node-gyp', 'bin', 'node-gyp.js'));
  var args = [
    gypPath,
    'rebuild',
    '--target=' + target,
    '--arch=' + process.arch,
  ];

  if (platform === 'electron') {
    args.push('--dist-url=https://atom.io/download/electron');
  }

  console.log('Building...');
  console.log(process.execPath + ' ' + args.join(' '));
  console.log('');

  var proc = spawn(process.execPath, args, {
    stdio: ['ignore', 'ignore', 2]
  });

  proc.on('exit', function(errorCode) {
    if (!errorCode) {
      var buildPath = path.resolve(__dirname, '..', 'build', 'Release');
      var bindingPath = path.join(buildPath, bindingName + '.node');
      if (!fs.existsSync(bindingPath)) {
        console.error('Binding does not exist: ' + bindingPath);
        process.exit(1);
      }

      var vendorPath = path.resolve(__dirname, '..', 'vendor');
      if (!isDirectory(vendorPath)) {
        fs.mkdirSync(vendorPath);
        console.log('Created directory: ' + vendorPath);
      }

      return getModuleVersion(platform).then(function(moduleVersion) {
        console.log('moduleVersion = ' + moduleVersion);
        var targetName = [
          process.platform, '-',
          process.arch, '-',
          moduleVersion
        ].join('');

        var targetPath = path.join(vendorPath, targetName);
        if (!isDirectory(targetPath)) {
          fs.mkdirSync(targetPath);
          console.log('Created directory: ' + targetPath);
        }

        targetPath = path.join(targetPath, bindingName + '.node');
        fs.writeFileSync(targetPath, fs.readFileSync(bindingPath));
        console.log('Copied binding: ' + targetPath);
      }, function(error) {
        console.error('Failed to get Electron\'s module version');
        throw error;
      })
      .then(process.exit, function(error) {
        console.error(error);
        process.exit(1);
      });
    }

    if (errorCode === 127 ) {
      console.error('node-gyp not found!');
    } else {
      console.error('Build failed with error code: ' + errorCode);
    }
    process.exit(1);
  });
}

function hasArgument(name) {
  var args = process.argv.slice(2);
  return args.lastIndexOf(name) >= 0;
}

function getArgument(name) {
  var args = process.argv.slice(2);
  var index = args.lastIndexOf(name);
  if (~index) {
    return args[index + 1] || null;
  }
  return null;
}

function getTarget(platform) {
  if (platform === 'node') {
    return process.versions.node;
  } else if (platform === 'electron') {
    return getElectronVersion();
  } else {
    console.error('Unsupported platform: ' + platform);
    process.exit(1);
  }
}

function getModuleVersion(platform) {
  var version = getArgument('--version');
  if (version) {
    return Promise.resolve(version);
  }
  if (platform === 'node') {
    return Promise.resolve(process.versions.modules);
  }
  if (platform === 'electron') {
    return getElectronModuleVersion();
  }
}

function getElectronVersion() {
  var electronRoot = path.dirname(require.resolve('electron'));
  var config = require(path.join(electronRoot, 'package.json'));
  console.log('Electron path: ' + electronRoot);
  console.log('Electron version: ' + config.version);
  return config.version;
}

function getElectronModuleVersion() {
  var electronRoot = path.dirname(require.resolve('electron'));
  var electronPath = path.join(electronRoot, 'path.txt');
  electronPath = path.join(electronRoot, fs.readFileSync(electronPath, 'utf8'));
  return new Promise(function(resolve) {
    var args = ['-e', '"console.log(process.versions.modules)"'];
    var opts = {env: {ELECTRON_RUN_AS_NODE: '1'}};

    console.log('Spawning: ' + [electronPath].concat(args).join(' '));
    var proc = spawn(electronPath, args, opts);

    var stdout = [];
    proc.stdout.on('data', function(data) {
      stdout.push(data.toString());
    });

    var stderr = [];
    proc.stderr.on('data', function(data) {
      stderr.push(data.toString());
    });

    proc.on('exit', function() {
      if (stderr.length) {
        console.error('Failed to get Electron\'s module version: ' + stderr.join(''));
        process.exit(1);
      }
      if (!stdout.length) {
        console.error('Failed to get Electron\'s module version');
        process.exit(1);
      }
      return resolve(stdout.join(''));
    });
  });
}

function isDirectory(filePath) {
  var result;
  try {
    result = fs.statSync(filePath).isDirectory();
  } catch(error) {}
  return !!result;
}
