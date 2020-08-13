"use strict";

const inspect = require('util').inspect.custom;  // TODO?
//const inspect = 'toString';

const {
  SIGNAL_LEVELS,
  VIDEO_SETUPS,

  COLOR_DEPTHS,
  DVI_STANDARDS,

  COLOR_TYPES,
  COLOR_FORMATS,

  ARs,
  PREFERRED_ARs,

  STEREOS
} = require('./edid_enums');

function _video_input_toString() { // {{{
  if (this.analog) {
    const st = this.sync_type_support;
    return 'analog, ' +
           'signal_level (' + this.signal_level + '): ' + SIGNAL_LEVELS[this.signal_level] + ', ' +
           'video_setup (' + this.video_setup + '): ' + VIDEO_SETUPS[this.video_setup] + ', ' +
           'sync_type_support: separate_h_v ' + +st.separate_h_v + ' : ' +
                              'composite_on_h ' + +st.composite_on_h + ' : ' +
                              'composite_on_green ' + +st.composite_on_green + ', ' +
           'serration_on_v: ' + +this.serration_on_v;
  } else {
    return 'digital, ' +
           'color_depth (' + this.color_depth + '): ' + COLOR_DEPTHS[this.color_depth] + ', ' +
           'dvi_standard (' + this.dvi_standard + '): ' + DVI_STANDARDS[this.dvi_standard];
  }
}
// }}}

// NOTE: 16:10 -> 8:5,  15:9 -> 5:3  ...
function best_fraction(num, den) { // {{{ for num,den >= 0, precision eps < 0.5/den
  // assert(0 <= num && 0 <= den);
  // binary search in (implicit) Stern-Brocot tree
  const num_low = num - 0.5, num_high = num + 0.5;
  let a = 0, b = 1,  // L = a/b = 0
      c = 1, d = 0;  // H = c/d = Infinity
  while (true) {
    const x = (a + c) * den;
    if (x < (b + d) * num_low) {  // (a+c)/(b+d) < num_low/den
      a += c;
      b += d;
    } else if (x >= (b + d) * num_high) {
      c += a;
      d += b;
    } else {
      break;
    }
  }
  return [a + c, b + d];
}
// }}}

function _aspect_toString() { // {{{
  const ar = this.aspectRatio;
  const fr = (ar[0] > ar[1]) ?  best_fraction(ar[0], ar[1]) : best_fraction(ar[1], ar[0]).reverse();
  return 'aspectRatio: ' + fr[0] + ':' + fr[1] +
                       ' (' + ar[0] + ':' + ar[1] + ' ≈ ' + (ar[0] / ar[1]).toFixed(4) + ')';
}
// }}}

function _feature_support_toString() { // {{{
  const pm = this.power_management;
  return 'power_management: standby ' + +pm.standby + ' : ' +
                           'suspend ' + +pm.suspend + ' : ' +
                           'active_off ' + +pm.active_off + ', ' +
         (this.color_type != null ?
           'color_type (' + this.color_type + '): ' + COLOR_TYPES[this.color_type] :
           'color_format (' + this.color_format + '): ' + COLOR_FORMATS[this.color_format]) + ', ' +
         'sRGB: ' + +this.sRGB + ', ' +
         'preferred_timing: ' + +this.preferred_timing + ', ' +
         'continuous_frequency: ' + +this.continuous_frequency;
}
// }}}

function _chromaticity_toString() { // {{{
  return 'red ' + this.red_x.toFixed(3) + ' ' + this.red_y.toFixed(3) + ', ' +
         'green ' + this.green_x.toFixed(3) + ' ' + this.green_y.toFixed(3) + ', ' +
         'blue ' + this.blue_x.toFixed(3) + ' ' + this.blue_y.toFixed(3) + ', ' +
         'white ' + this.white_x.toFixed(3) + ' ' + this.white_y.toFixed(3);
}
// }}}

// TODO? returns array ...
function _established_timings_toString() { // {{{
  return Object.keys(this).filter((k) => (k[0] !== '_' && k !== inspect && this[k])); // .join(', ');
}
// }}}

function _std_timing_toString() { // {{{
  const ar = ARs[this.aspect_ratio];
  return 'h_active8: ' + this.h_active8 + ', aspect (' + this.aspect_ratio + '): ' +
         (ar[0] === 16 ? '' : ' ') + ar[0] + ':' + (ar[1] === 10 ? '' : ' ') + ar[1] + ', refresh_rate: ' + this.refresh_rate +
         ' -> ' + (this.h_active8 * 8) + ' x ' + (this.h_active8 * 8 * ar[1] / ar[0]) + ' @ ' + this.refresh_rate;
}
// }}}


module.exports = function add_inspect_fns(obj, key = inspect) {
  obj.video_input[key] = _video_input_toString;

  if (obj.screen_size_ratio && obj.screen_size_ratio.aspectRatio) {
    obj.screen_size_ratio[key] = _aspect_toString;   // TODO? also support h_size/v_size variant ?
  }

  obj.feature_support[key] = _feature_support_toString;
  obj.chromaticity[key] = _chromaticity_toString;

  obj.established_timings[key] = _established_timings_toString;

  obj.standard_timings.forEach((timing) => {
    if (timing) {
      timing[key] = _std_timing_toString;
    }
  });

  obj.descriptors.forEach((desc) => {
    if (desc.established_timings) {
      desc.established_timings[key] = _established_timings_toString; // (just reuse - TODO?)
    }
  });
};

