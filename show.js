#!/usr/bin/env node
"use strict";

const fs = require('fs');
const util = require('util');

const eutil = require('./lib/util');
const edid = require('./lib/edid');
const add_edid_inspect = require('./lib/edid_inspect.js');

let buf;
if (process.argv[2]) {
  buf = fs.readFileSync(process.argv[2]);
} else { // read from stdin
  buf = require('./lib/readStdinSync')();
}
buf = eutil.binary_from(buf);

const data = edid.read(buf);
if (data) {
  add_edid_inspect(data);
}

console.log(util.inspect(data, {depth: null}));

