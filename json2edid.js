#!/usr/bin/env node
"use strict";

const fs = require('fs');

const eutil = require('./lib/util');
const edid = require('./lib/edid');

let buf;
if (process.argv[2]) {
  buf = fs.readFileSync(process.argv[2]);
} else { // read from stdin
  buf = require('./lib/readStdinSync')();
}

const json = JSON.parse(buf);

const data = edid.write(json);
if (!data) {
  console.log('Error: Serialization failed');  // TODO? stderr?
  process.exit(1);
}

// if (isTTY) else bin? [process.stdout.write()] /  process.argv.slice(2).indexOf('-bin') ?
console.log(eutil.hex16(data));

