"use strict";

const RXP_IS_HEX = /^[0-9a-fA-F \n]+$/;

function is_hex_string(buf) {
  return RXP_IS_HEX.test(buf);
}

function from_hex(buf) {
  return Buffer.from(buf.toString().replace(/[ \t\r\n]/g, ''), 'hex');
}

function hex16(buf) {
  return buf.toString('hex').replace(/(..)(?!$)/g, '$1 ').replace(/(.{47}) /g, '$1\n');
}

module.exports = {
  is_hex_string,

  from_hex,
  hex16,

  binary_from(hex_or_bin) {
    if (is_hex_string(hex_or_bin)) {
      return from_hex(hex_or_bin);
    }
    return hex_or_bin;
  }
};

