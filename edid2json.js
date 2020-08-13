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
buf = eutil.binary_from(buf);

const data = edid.read(buf);

if (data) {
  const hexbuf = edid.write(data);
  if (!hexbuf) {
    console.log('WARNING: edid was not re-serializable');
  } else if (!buf.equals(hexbuf)) {
    console.log('WARNING: edid did not round-trip');
    console.log(eutil.hex16(hexbuf));
    console.log(' ^-- new   v-- orig ');
    console.log(eutil.hex16(buf));
  }
}

console.log(JSON.stringify(data, null, 2));

