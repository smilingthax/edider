"use strict";

const ARs = [
  [4, 3], [16, 9], [16, 10], [15, 9]
];

const VRATEs = [  // i.e. preferred_v_rate
  50, 60, 75, 85   // Hz
];

// v_rates = { 50: true/false, 60: true/false, 75: , 85: , 60rb: }
function encode(v_active, aspect_ratio, preferred_v_rate, v_rates, rsvd0 = 0, rsvd1 = 0) {
  v_active = Math.round(v_active / 2) - 1;
  return [
    v_active & 0xff,
    ((v_active >> 4) & 0xf0) | ((aspect_ratio & 0x03) << 2) | (rsvd0 & 0x03),
    ((rsvd1 & 0x01) << 7) | ((preferred_v_rate & 0x03) << 5) |
      (v_rates[50] ? 0x10 : 0) | (v_rates[60] ? 0x08 : 0) |
      (v_rates[75] ? 0x04 : 0) | (v_rates[85] ? 0x02 : 0) |
      (v_rates['50rb'] ? 0x01 : 0)
  ];
}

function decode(buf) {
  return {
    v_active: 2 * (((buf[0] & 0xff) | ((buf[1] & 0xf0) << 4)) + 1),  // note: 00 reserved
    aspect_ratio: (buf[1] >> 2) & 0x03,
    preferred_v_rate: (buf[2] >> 5) & 0x03,
    v_rates: {
      50: !!(buf[2] & 0x10),
      60: !!(buf[2] & 0x08),
      75: !!(buf[2] & 0x04),
      85: !!(buf[2] & 0x02),
      '60rb': !!(buf[2] & 0x01)
    },

    rsvd0: buf[1] & 0x03,
    rsvd1: (buf[2] >> 7) & 0x01
  };
}

module.exports = {
  ARs,
  VRATEs,

  encode,
  decode
};

