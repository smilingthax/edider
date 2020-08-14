"use strict";

const ARs = [  // equal to ARs in edid_enums.js
  [16, 10], [4, 3], [5, 4], [16, 9]
];

function encode(h_active, aspect_ratio, v_rate) {
  return [
    Math.round(h_active / 8 - 31) & 0xff,
    ((aspect_ratio & 0x03) << 6) | ((v_rate - 60) & 0x3f)
  ];
}

function decode(buf) {
  return {
    h_active: ((buf[0] & 0xff) + 31) * 8,
    aspect_ratio: (buf[1] >> 6) & 0x03,
    v_rate: (buf[1] & 0x3f) + 60
  };
}

module.exports = {
  ARs,

  encode,
  decode
};

