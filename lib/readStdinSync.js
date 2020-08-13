"use strict";

const fs = require('fs');

function readStdinSync() {
  const fd = fs.openSync('/dev/stdin', 'rs');
  try {
    const ret = [];
    while (true) {
      let len;
      const buf = Buffer.allocUnsafe(4096);
      try {
        len = fs.readSync(fd, buf, 0, buf.length, null);
      } catch (e) {
        if (e.code === 'EOF') { // win
          break;
        }
        throw e;
      }
      if (len === 0) {
        break;
      }
      ret.push((buf.length === len) ? buf : buf.slice(0, len));
    }
    return Buffer.concat(ret);
  } finally {
    fs.closeSync(fd);
  }
}

module.exports = readStdinSync;

