"use strict";

const HEADER = Buffer.from([0x00, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x00]);

function checksum(buf) { // {{{
  const sum = buf.reduce((acc, c) => (acc + c)&0xff, 0);
  return (-sum)&0xff;
}
// }}}


function read_std_timing(b0, b1) { // {{{
  if (b0 == 0x01 && b1 == 0x01) {
    return null; // unused
  }
  return {
    h_active8: b0 + 31,    // note: 0x00 is reserved
    aspect_ratio: (b1 >> 6) & 0x03,
    refresh_rate: (b1 & 0x1f) + 60
  };
}
// }}}

function write_std_timing(obj) { // {{{
  if (obj == null) {
    return [0x01, 0x01];
  }
  return [
    obj.h_active8 - 31,
    ((obj.aspect_ratio & 0x03) << 6) | ((obj.refresh_rate - 60) & 0x1f)
  ];
}
// }}}


function read_dtd(buf) { // {{{
  if (buf.length < 18) {
    return false;
  } else if (buf[0] === 0x00 && buf[1] === 0x00) {
    if (buf[2] === 0x00) {
      return null; // a tagged display descriptor
    }
    return false; // TODO? ... unknown
  }

  return {
    timings: {
      pixel_clock: buf.readUInt16LE(0x00) / 100,      // ###.## MHz
      h_active: ((buf[0x04] & 0xf0) << 4) | buf[0x02],  // pixels
      h_blank: ((buf[0x04] & 0x0f) << 8) | buf[0x03],

      v_active: ((buf[0x07] & 0xf0) << 4) | buf[0x05],  // lines
      v_blank: ((buf[0x07] & 0x0f) << 8) | buf[0x06],

      h_front_porch: ((buf[0x0b] & 0xc0) << 2) | buf[0x08],  // pixels
      h_sync_pulse: ((buf[0x0b] & 0x30) << 4) | buf[0x09],

      v_front_porch: ((buf[0x0b] & 0x0c) << 2) | ((buf[0x0a] & 0xf0) >> 4),  // lines
      v_sync_pulse: ((buf[0x0b] & 0x03) << 4) | (buf[0x0a] & 0x0f),
    },

    h_size: ((buf[0x0e] & 0xf0) << 4) | buf[0x0c],  // mm  (shall be <= global screen_size_ratio.h_size/.v_size)
    v_size: ((buf[0x0e] & 0x0f) << 8) | buf[0x0d],

    h_borders: buf[0x0f],  // pixel
    v_borders: buf[0x10],

    interlaced: !!(buf[0x11] & 0x80),
    stereo: ((buf[0x11] & 0x01) << 2) | ((buf[0x11] >> 5) & 0x03),
    sync: (buf[0x11] & 0x10) ? {
      analog: false, digital: true,
      composite: !(buf[0x11] & 0x08),  // otherwise: separate
      serrations: ((buf[0x11] & 0x08) === 0) ? !!(buf[0x11] & 0x04) : null,   // only defined for composite sync
      v_sync_positive: ((buf[0x11] & 0x08) !== 0) ? !!(buf[0x11] & 0x04) : null,   // only defined for separate sync
      h_sync_positive: !!(buf[0x11] & 0x02)
    } : {
      analog: true, digital: false,
      bipolar: !!(buf[0x11] & 0x08),
      serrations: !!(buf[0x11] & 0x04),
      sync_on_green: !(buf[0x11] & 0x02)  // otherwise: on all rgb
    }
  };
}
// }}}

function write_dtd(obj) { // {{{
  const t = obj.timings;
  const pc = Math.round(t.pixel_clock * 100);
  return [
    (pc & 0xff), (pc >> 8) & 0xff, // writeUInt16LE...
    t.h_active & 0xff,
    t.h_blank & 0xff,
    ((t.h_active >> 4) & 0xf0) | ((t.h_blank >> 8) & 0x0f),

    t.v_active & 0xff,
    t.v_blank & 0xff,
    ((t.v_active >> 4) & 0xf0) | ((t.v_blank >> 8) & 0x0f),

    t.h_front_porch & 0xff,
    t.h_sync_pulse & 0xff,
    ((t.v_front_porch << 4) & 0xf0) | (t.v_sync_pulse & 0x0f),
    ((t.h_front_porch >> 2) & 0xc0) | ((t.h_sync_pulse >> 4) & 0x30) | ((t.v_front_porch >> 2) & 0x0c) | ((t.v_sync_pulse >> 4) & 0x03),

    obj.h_size & 0xff,
    obj.v_size & 0xff,
    ((obj.h_size >> 4) & 0xf0) | ((obj.v_size >> 8) & 0x0f),

    obj.h_borders & 0xff,
    obj.v_borders & 0xff,

    (obj.interlaced ? 0x80 : 0) | ((obj.stereo << 5) & 0x60) | ((obj.stereo >> 2) & 0x01) |
      (obj.sync.analog ?
        (obj.sync.bipolar ? 0x08 : 0) |
        (obj.sync.serrations ? 0x04 : 0) |
        (obj.sync.sync_on_green ? 0 : 0x02)
      : 0x10 |
        (obj.sync.composite ? (obj.sync.serrations ? 0x04 : 0) : (0x08 | (obj.sync.v_sync_positive ? 0x04 : 0))) |
        (obj.sync.h_sync_positive ? 0x02 : 0)
      )
  ];
}
// }}}

const established_III = [ // {{{
  '640 x 350 @ 85', '640 x 400 @ 85', '720 x 400 @ 85', '640 x 480 @ 85',
  '848 x 480 @ 60', '800 x 600 @ 85', '1024 x 768 @ 85', '1152 x 864 @ 75',

  '1280 x 768 @ 60rb', '1280 x 768 @ 60', '1280 x 768 @ 75', '1280 x 768 @ 85',
  '1280 x 960 @ 60', '1280 x 960 @ 85', '1280 x 1024 @ 60', '1280 x 1024 @ 85',

  '1360 x 768 @ 60', '1440 x 900 @ 60rb', '1440 x 900 @ 60', '1440 x 900 @ 75',
  '1440 x 900 @ 85', '1400 x 1050 @ 60rb', '1400 x 1050 @ 60', '1400 x 1050 @ 75',

  '1400 x 1050 @ 85', '1680 x 1050 @ 60rb', '1680 x 1050 @ 60', '1680 x 1050 @ 75',
  '1680 x 1050 @ 85', '1600 x 1200 @ 60', '1600 x 1200 @ 65', '1600 x 1200 @ 70',

  '1600 x 1200 @ 75', '1600 x 1200 @ 85', '1792 x 1344 @ 60', '1792 x 1344 @ 75',
  '1856 x 1392 @ 60', '1856 x 1392 @ 75', '1920 x 1200 @ 60rb', '1920 x 1200 @ 60',

  '1920 x 1200 @ 75', '1920 x 1200 @ 85', '1920 x 1440 @ 60', '1920 x 1440 @ 75'
];
// }}}

const descriptor_types = {
  [0x10]: { // {{{ dummy descriptor
    read(buf) {
      return {};
    },
    write(obj) {
      if (obj != null) {
        for (let k in obj) {
          return false;  // has at least one key
        }
      }
      const ret = Buffer.alloc(18);
      ret[3] = 0x10;
      return ret;
    }
  },
  // }}}

  [0xff]: { // {{{ serial number
    read(buf) {
      if (buf[4] !== 0) return false;
      return {
        serial_number: buf.slice(5, 18).toString()
      };
    },
    write(obj) {
      if (!('serial_number' in obj)) {
        return false;
      }
      const ret = Buffer.alloc(13, 0x20);
      ret[ret.write(obj.serial_number)] = 0x10;
      return Buffer.concat([Buffer.from([0, 0, 0, 0xff, 0]), ret]);
    }
  },
  // }}}

  [0xfe]: { // {{{ alphanumeric data string  (note: multiple are possible!)
    read(buf) {
      if (buf[4] !== 0) return false;
      return {
        string: buf.slice(5, 18).toString('latin1')  // TODO?
      };
    },
    write(obj) {
      if (!('string' in obj)) {
        return false;
      }
      const ret = Buffer.alloc(13, 0x20);
      ret[ret.write(obj.string, 'latin1')] = 0x10;
      return Buffer.concat([Buffer.from([0, 0, 0, 0xfe, 0]), ret]);
    }
  },
  // }}}

  [0xfd]: { // {{{ display range limits
    read(buf) {
      return {
        range_limits: {
          rsvd0: (buf[0x04] >> 4) & 0x0f,

          v_min_rate: (buf[0x04] & 0x01 ? 255 : 0) + buf[0x05],   // NOTE: min_rate +255 but max_rate w/o is forbidden (min<max!)
          v_max_rate: (buf[0x04] & 0x02 ? 255 : 0) + buf[0x06],   // NOTE: 0x05..0x09 == 0 is reserved...

          h_min_rate: (buf[0x04] & 0x04 ? 255 : 0) + buf[0x07],
          h_max_rate: (buf[0x04] & 0x08 ? 255 : 0) + buf[0x08],

          max_pixel_clock: buf[0x09] * 10,  // MHz

          timing_support: buf[0x0a],  // enum ...  // TODO?

          rsvd_0a: (buf[0x0a] !== 0x02 && buf[0x0a] !== 0x04) ? buf[0x0b] : null,      // NOTE: expected to be 0x0a when [0x0a] === 0 / 1 (- or null)
          rsvd1: (buf[0x0a] !== 0x02 && buf[0x0a] !== 0x04) ? buf.slice(0x0c, 0x12) : null,  // expected to be all 0x20 w/ [0x0a] == 0 / 1 (or null)

          gtf_secondary: (buf[0x0a] === 0x02) ? {
            rsvd0: buf[0x0b],  // expected to be 0
            h_rate_break: buf[0x0c] * 2,  // kHz
            c: buf[0x0d] / 2,
            m: buf.readUInt16LE(0x0e),
            k: buf[0x10],
            j: buf[0x11] / 2
          } : null,

          cvt: (buf[0x0a] === 0x04) ? {
            version: [buf[0x0b] >> 4, buf[0x0b] & 0x0f],   // TODO? field definition might change for > 1.1 ??

            max_pixel_clock: buf[0x09] * 10 - (buf[0x0c] >> 2) / 4,   // w/ extra precision ...

            h_max_active: (((buf[0x0c] & 0x03) << 8) | buf[0x0d]) * 8,  // NOTE: when buf[0x0d] == 0, buf[0x0c]&0x02 shall be ignored...(?)

            aspect_ratios: {
              '4:3': !!(buf[0x0e] & 0x80),
              '16:9': !!(buf[0x0e] & 0x40),
              '16:10': !!(buf[0x0e] & 0x20),
              '5:4': !!(buf[0x0e] & 0x10),
              '15:9': !!(buf[0x0e] & 0x08),
              rsvd0 : buf[0x0e] & 0x07
            },

            preferred_aspect_ratio: (buf[0x0f] >> 5),  // NOTE: values 5..7 unused... (also cf. PREFERRED_ARs)
            blanking_support: {
              standard: !!(buf[0x0f] & 0x08),
              reduced: !!(buf[0x0f] & 0x10),  // (also: preferred, if set)
              rsvd0 : buf[0x0f] & 0x07
            },

            scaling_support: {
              h_shrink: !!(buf[0x10] & 0x80),
              h_stretch: !!(buf[0x10] & 0x40),
              v_shrink: !!(buf[0x10] & 0x20),
              v_stretch: !!(buf[0x10] & 0x10),
              rsvd0 : buf[0x10] & 0x0f
            },
            preferred_v_rate: buf[0x11]  // Hz  // NOTE: 00 is reserved
          } : null
        }
      }
    },
    write(obj) {
      if (!('range_limits' in obj)) {
        return false;
      }
      const rl = obj.range_limits;
      const buf = Buffer.alloc(18);
      buf[0x03] = 0xfd;

      buf[0x04] = ((rl.rsvd0 & 0x0f) << 4) |
                  (rl.v_min_rate > 255 ? 0x01 : 0) | (rl.v_max_rate > 255 ? 0x02 : 0) |
                  (rl.h_min_rate > 255 ? 0x04 : 0) | (rl.h_max_rate > 255 ? 0x08 : 0);

      buf[0x05] = (rl.v_min_rate > 255) ? rl.v_min_rate - 255 : rl.v_min_rate;
      buf[0x06] = (rl.v_max_rate > 255) ? rl.v_max_rate - 255 : rl.v_max_rate;

      buf[0x07] = (rl.h_min_rate > 255) ? rl.h_min_rate - 255 : rl.h_min_rate;
      buf[0x08] = (rl.h_max_rate > 255) ? rl.h_max_rate - 255 : rl.h_max_rate;

      buf[0x09] = Math.round(rl.max_pixel_clock / 10);

      buf[0x0a] = rl.timing_support;

      if (rl.timing_support === 0x02) {
        const gs = rl.gtf_secondary;
        // assert(gs);
        buf[0x0b] = gs.rsvd0;
        buf[0x0c] = Math.round(gs.h_rate_break) / 2;
        buf[0x0d] = gs.c * 2;
        buf.writeUInt16LE(gs.m, 0x0e);
        buf[0x10] = gs.k;
        buf[0x11] = gs.j * 2;
      } else if (rl.timing_support === 0x04) {
        const cvt = rl.cvt;
        // assert(cvt);
        buf[0x0b] = ((cvt.version[0] & 0x0f) << 4) | (cvt.version[1] & 0x0f);

        const mpc = Math.round((buf[0x09] * 10 - cvt.max_pixel_clock) * 4);
        const hma = Math.round(cvt.h_max_active / 8);
        buf[0x0c] = ((mpc & 0x3f) << 2) | ((hma >> 8) & 0x300);
        buf[0x0d] = hma & 0xff;

        const ars = cvt.aspect_ratios;
        buf[0x0e] = (ars['4:3'] ? 0x80 : 0) | (ars['16:9'] ? 0x40 : 0) |
                    (ars['16:10'] ? 0x20 : 0) | (ars['5:4'] ? 0x10 : 0) |
                    (ars['15:9'] ? 0x08 : 0) | (ars.rsvd0 & 0x07);

        const bs = cvt.blanking_support;
        buf[0x0f] = ((cvt.preferred_aspect_ratio & 0x07) << 5) |
                    (bs.standard ? 0x08 : 0) | (bs.reduced ? 0x10 : 0) |
                    (bs.rsvd0 & 0x07);

        const ss = cvt.scaling_support;
        buf[0x10] = (ss.h_shrink ? 0x80 : 0) | (ss.h_stretch ? 0x40 : 0) |
                    (ss.v_shrink ? 0x20 : 0) | (ss.v_stretch ? 0x10 : 0) |
                    (ss.rsvd0 & 0x0f);

        buf[0x11] = cvt.preferred_v_rate;
      } else {
        buf[0x0b] = rl.rsvd_0a;
        buf.set(rl.rsvd1, 0x0c);
      }

      return buf;
    }
  },
  // }}}

  [0xfc]: { // {{{ product name
    read(buf) {
      if (buf[4] !== 0) return false;
      return {
        product_name: buf.slice(5, 18).toString()  // todo? latin1
      };
    },
    write(obj) {
      if (!('product_name' in obj)) {
        return false;
      }
      const ret = Buffer.alloc(13, 0x20);
      ret[ret.write(obj.product_name)] = 0x10;
      return Buffer.concat([Buffer.from([0, 0, 0, 0xfc, 0]), ret]);
    }
  },
  // }}}

/* TODO
  [0xfb]: { // color point data
    read(buf) {}
  },
  [0xfa]: { // standard timing ids
    read(buf) {}
  },
  [0xf9]: { // display color management (DCM) data
    read(buf) {}
  },
  [0xf8]: { // CVT 3 byte timing codes
    read(buf) {}
  },
*/

  [0xf7]: { // {{{ established timings (III)
    read(buf) {
      if (buf[5] !== 0x0a) return false;

      const ret = {
        established_timings: {
          _raw: [buf[0x06], buf[0x07], buf[0x08], buf[0x09], buf[0x0a], buf[0x0b]]
        }
      };

      for (let bit = 0, len=established_III.length; bit < len; bit++) {
        const key = established_III[bit];
        const byte = bit >> 3,
              shift = bit & 0x07;
        ret.established_timings[key] = !!(buf[byte + 6] & (1 << (7 - shift)));
      }

      ret.established_timings.rsvd0 = buf[0x0b] & 0x0f;
      ret.established_timings.rsvd1 = buf.slice(0x0c, 0x11);
      return ret;
    },
    write(obj) {
      if (!('established_timings' in obj)) {
        return false;
      }
      const et = obj.established_timings;
      const buf = Buffer.alloc(18);
      buf[3] = 0xf7;
      buf[5] = 0x0a;

      for (let bit = 0, len=established_III.length; bit < len; bit++) {
        const key = established_III[bit];
        if (et[key]) {
          const byte = bit >> 3,
                shift = bit & 0x07;
          buf[byte + 6] |= 1 << (7 - shift);
        }
      }
      buf[0x0b] |= et.rsvd0 & 0x0f;
      buf.set(et.rsvd1, 0x0c);

      return buf;
    }
  }
  // }}}
};


function read(buf) {
  if (buf.length < 128) {
    return false;
  } else if (buf.compare(HEADER, 0, 8, 0, 8) !== 0) {
    return false;
  }

  const ret = {
    manufacturer_name_id: {
//      _raw: [buf[0x08], buf[0x09]],
      rsrvd0: (buf[0x08] >> 7) & 0x01,
      str: String.fromCharCode(((buf[0x08] >> 2) & 0x1f) + 64,
                               (((buf[0x08] << 3) | (buf[0x09] >> 5)) & 0x1f) + 64,
                               (buf[0x09] & 0x1f) + 64)
    },
    product_code_id: buf.readUInt16LE(0x0a),
    serial_number_id: buf.readUInt32LE(0x0c),
    manufactured: (buf[0x10] === 0xff) ? {
      model_year: buf[0x11] + 1990  // note: 00h - 0Fh is reserved
    } : {
      month: buf[0x10],             // note: 00h: not specified, 37h - FEh: reserved
      year: buf[0x11] + 1990        // note: 00h - 0Fh is reserved
    },
    edid_version: [buf[0x12], buf[0x13]],

    video_input: ((buf[0x14] & 0x80) === 0) ? {
      analog: true, digital: false,
      signal_level: (buf[0x14] >> 5) & 0x03,
      video_setup: (buf[0x14] >> 4) & 0x01,
      sync_type_support: {
        separate_h_v: !!(buf[0x14] & 0x08),
        composite_on_h: !!(buf[0x14] & 0x04),
        composite_on_green: !!(buf[0x14] & 0x02)
      },
      serration_on_v: !!(buf[0x14] & 0x01)
    } : {
      analog: false, digital: true,
      color_depth: (buf[0x14] >> 4) & 0x07,
      dvi_standard: buf[0x14] & 0x0f
    },

    screen_size_ratio: (buf[0x15] !== 0) ? (
      (buf[0x16] !== 0) ? { // screen sizes in cm
        h_size: buf[0x15],
        v_size: buf[0x16]
      } : { // landscape
        aspect_ratio: [(buf[0x15] + 99), 100]
      }
    ) : (buf[0x16] !== 0) ? { // portrait
      aspect_ratio: [100, (buf[0x16] + 99)]
    } : null,  // unknown/not defined

    gamma: (buf[0x17] !== 0xff) ? (buf[0x17] + 100) / 100 : null,

    feature_support: {
      power_management: {
        standby: !!(buf[0x18] & 0x80),   // DPMS
        suspend: !!(buf[0x18] & 0x40),   // DPMS
        active_off: !!(buf[0x18] & 0x20) // DPMS / DPM
      },

      color_type: ((buf[0x14] & 0x80) === 0) ? (buf[0x18] >> 3) & 0x03 : null, // analog
      color_format: ((buf[0x14] & 0x80) !== 0) ? (buf[0x18] >> 3) & 0x03 : null, // digital

      sRGB: !!(buf[0x18] & 0x04),              // i.e. sRGB is default
      preferred_timing: !!(buf[0x18] & 0x02),  // i.e. preferred timing mode includes native pixel format + refresh rate  // note edid 1.3 requires 1
// FIXME? edid 1.3:   use_gtf   -> edid 1.4: continuous_frequency
      continuous_frequency: !!(buf[0x18] & 0x01)
    },

    chromaticity: {
      red_x: ((buf[0x1b] << 2) | ((buf[0x19] >> 6) & 0x03)) / 1024,
      red_y: ((buf[0x1c] << 2) | ((buf[0x19] >> 4) & 0x03)) / 1024,
      green_x: ((buf[0x1d] << 2) | ((buf[0x19] >> 2) & 0x03)) / 1024,
      green_y: ((buf[0x1e] << 2) | (buf[0x19] & 0x03)) / 1024,
      blue_x: ((buf[0x1f] << 2) | ((buf[0x1a] >> 6) & 0x03)) / 1024,
      blue_y: ((buf[0x20] << 2) | ((buf[0x1a] >> 4) & 0x03)) / 1024,
      white_x: ((buf[0x21] << 2) | ((buf[0x1a] >> 2) & 0x03)) / 1024,
      white_y: ((buf[0x22] << 2) | (buf[0x1a] & 0x03)) / 1024,
    },

    established_timings: {  // including manufacturer's timings
      _raw: [buf[0x23], buf[0x24], buf[0x25]],
      '720 x 400 @ 70': !!(buf[0x23] & 0x80),
      '720 x 400 @ 88': !!(buf[0x23] & 0x40),
      '640 x 480 @ 60': !!(buf[0x23] & 0x20),
      '640 x 480 @ 67': !!(buf[0x23] & 0x10),
      '640 x 480 @ 72': !!(buf[0x23] & 0x08),
      '640 x 480 @ 75': !!(buf[0x23] & 0x04),
      '800 x 600 @ 56': !!(buf[0x23] & 0x02),
      '800 x 600 @ 60': !!(buf[0x23] & 0x01),

      '800 x 600 @ 72': !!(buf[0x24] & 0x80),
      '800 x 600 @ 75': !!(buf[0x24] & 0x40),
      '832 x 624 @ 75': !!(buf[0x24] & 0x20),
      '1024 x 768 @ 87i': !!(buf[0x24] & 0x10),
      '1024 x 768 @ 60': !!(buf[0x24] & 0x08),
      '1024 x 768 @ 70': !!(buf[0x24] & 0x04),
      '1024 x 768 @ 75': !!(buf[0x24] & 0x02),
      '1280 x 1024 @ 75': !!(buf[0x24] & 0x01),

      '1152 x 870 @ 75': !!(buf[0x25] & 0x80),
      'manu6': !!(buf[0x25] & 0x40),
      'manu5': !!(buf[0x25] & 0x20),
      'manu4': !!(buf[0x25] & 0x10),
      'manu3': !!(buf[0x25] & 0x08),
      'manu2': !!(buf[0x25] & 0x04),
      'manu1': !!(buf[0x25] & 0x02),
      'manu0': !!(buf[0x25] & 0x01)
    },

    standard_timings: [
      read_std_timing(buf[0x26], buf[0x27]),
      read_std_timing(buf[0x28], buf[0x29]),
      read_std_timing(buf[0x2a], buf[0x2b]),
      read_std_timing(buf[0x2c], buf[0x2d]),
      read_std_timing(buf[0x2e], buf[0x2f]),
      read_std_timing(buf[0x30], buf[0x31]),
      read_std_timing(buf[0x32], buf[0x33]),
      read_std_timing(buf[0x34], buf[0x35])
    ],

    descriptors: [],

    extensions: [],

    _checksum: buf[0x7f],
    valid: (checksum(buf.slice(0, 0x80)) === 0)
  };

  for (let i = 0; i < 4; i++) {
    const sub = buf.slice(0x36 + 18 * i, 0x36 + 18 * (i+1));
    let res = read_dtd(sub);
    if (res === null) {
      const read_fn = descriptor_types[sub[3]] && descriptor_types[sub[3]].read;
      if (read_fn) {
        res = read_fn(sub);
        if (res === false) {
          res = sub;
        }
      } else {
        res = sub;
      }
    }
else if (res === false) res = sub; // TODO??
    ret.descriptors[i] = res;
  }

  const num_ext = buf[0x7e];
  if (buf.length !== (num_ext + 1) * 128) {
    return false;  // TODO?
  }
  for (let i = 0; i < num_ext; i++) {
    ret.extensions.push(buf.slice((i + 1) * 128, (i + 2) * 128));   // TODO: parse...
  }

  return ret;
}

function write(opts) {
  const buf = Buffer.alloc(128);
  HEADER.copy(buf, 0x00);  // or: buf.set(HEADER, 0x00);

  const mf = [0, 1, 2].map((idx) => opts.manufacturer_name_id.str.charCodeAt(idx));  //  -64 not required: removed via & 0x1f
  buf[0x08] = (opts.manufacturer_name_id.rsrvd0 ? 0x80 : 0x00) | ((mf[0] & 0x1f) << 2) | ((mf[1] & 0x18) >> 3);
  buf[0x09] = ((mf[1] & 0x07) << 5) | (mf[2] & 0x1f);

  buf.writeUInt16LE(opts.product_code_id, 0x0a);
  buf.writeUInt32LE(opts.serial_number_id, 0x0c);

  const manu = opts.manufactured;
  if (manu.model_year) {
    buf[0x10] = 0xff;
    buf[0x11] = manu.model_year - 1990;
  } else {
    buf[0x10] = manu.month;
    buf[0x11] = manu.year - 1990;
  }

  buf[0x12] = opts.edid_version[0];
  buf[0x13] = opts.edid_version[1];

  const vi = opts.video_input;
  if (vi.analog) {
    const sts = vi.sync_type_support;
    buf[0x14] = ((vi.signal_level & 0x03) << 5) | ((vi.video_setup & 0x01) << 4) |
                ((sts.separate_h_v & 0x01) << 3) | ((sts.composite_on_h & 0x01) << 2) | ((sts.composite_on_green & 0x01) << 1) |
                ((vi.serration_on_v & 0x01));
  } else {
    buf[0x14] = 0x80 | ((vi.color_depth & 0x07) << 4) | (vi.dvi_standard & 0x0f);
  }

  const ssr = opts.screen_size_ratio;
  if (ssr === null) {
    buf[0x15] = 0;
    buf[0x16] = 0;
  } else if (ssr.aspect_ratio) {
    const ar = (Array.isArray(ssr.aspect_ratio)) ? ssr.aspect_ratio[0] / ssr.aspect_ratio[1] : +ssr.aspect_ratio;
    // assert(ar >= 0.28 && ar <= 3.54);
    if (ar[0] < 1) { // portrait
      buf[0x15] = 0;
      buf[0x16] = Math.round(100 / ar) - 99;
    } else { // landscape
      buf[0x15] = Math.round(ar * 100) - 99;
      buf[0x16] = 0;
    }
  } else {
    // assert(ssr.h_size > 0 && ssr.v_size > 0);
    buf[0x15] = ssr.h_size;
    buf[0x16] = ssr.v_size;
  }

  buf[0x17] = (opts.gamma != null) ? Math.round(opts.gamma * 100 - 100) : 0xff;

  const fs = opts.feature_support;
  const pm = fs.power_management;
  buf[0x18] = (pm.standby ? 0x80 : 0) | (pm.suspend ? 0x40 : 0) | (pm.active_off ? 0x20 : 0) |
              (((vi.analog ? fs.color_type : fs.color_format) & 0x03) << 3) |
              (fs.sRGB ? 0x04 : 0) | (fs.preferred_timing ? 0x02 : 0) | (fs.continuous_frequency ? 0x01 : 0);

  const cr = ['red_x', 'red_y', 'green_x', 'green_y', 'blue_x', 'blue_y', 'white_x', 'white_y'].map((k) => Math.round(opts.chromaticity[k] * 1024));
  buf[0x19] = ((cr[0] & 0x03) << 6) | ((cr[1] & 0x03) << 4) |
              ((cr[2] & 0x03) << 2) | (cr[3] & 0x03);
  buf[0x1a] = ((cr[4] & 0x03) << 6) | ((cr[5] & 0x03) << 4) |
              ((cr[6] & 0x03) << 2) | (cr[7] & 0x03);
  for (let i = 0; i < 8; i++) {
    buf[0x1b + i] = ((cr[i] & 0x3fc) >> 2);
  }

  const et = opts.established_timings;
  buf[0x23] = (et['720 x 400 @ 70'] ? 0x80 : 0) | (et['720 x 400 @ 88'] ? 0x40 : 0) |
              (et['640 x 480 @ 60'] ? 0x20 : 0) | (et['640 x 480 @ 67'] ? 0x10 : 0) |
              (et['640 x 480 @ 72'] ? 0x08 : 0) | (et['640 x 480 @ 75'] ? 0x04 : 0) |
              (et['800 x 600 @ 56'] ? 0x02 : 0) | (et['800 x 600 @ 60'] ? 0x01 : 0);
  buf[0x24] = (et['800 x 600 @ 72'] ? 0x80 : 0) | (et['800 x 600 @ 75'] ? 0x40 : 0) |
              (et['832 x 624 @ 75'] ? 0x20 : 0) | (et['1024 x 768 @ 87i'] ? 0x10 : 0) |
              (et['1024 x 768 @ 60'] ? 0x08 : 0) | (et['1024 x 768 @ 70'] ? 0x04 : 0) |
              (et['1024 x 768 @ 75'] ? 0x02 : 0) | (et['1280 x 1024 @ 75'] ? 0x01 : 0);
  buf[0x25] = (et['1152 x 870 @ 75'] ? 0x80 : 0) | (et['manu6'] ? 0x40 : 0) |
              (et['manu5'] ? 0x20 : 0) | (et['manu4'] ? 0x10 : 0) |
              (et['manu3'] ? 0x08 : 0) | (et['manu2'] ? 0x04 : 0) |
              (et['manu1'] ? 0x02 : 0) | (et['manu0'] ? 0x01 : 0);

  for (let i = 0; i < 8; i++) {
    buf.set(write_std_timing(opts.standard_timings[i]), 0x26 + 2*i);
  }

  for (let i = 0; i < 4; i++) {
    const desc = opts.descriptors[i];
    let res;
    if (Buffer.isBuffer(desc) || Array.isArray(desc)) {
      res = desc;
    } else if (desc.type === 'Buffer' && 'data' in desc) {
      res = Buffer.from(desc);
    } else if ('timings' in desc) {
      res = write_dtd(desc);
      // assert(res);
    } else {
      for (let k in descriptor_types) {
        const write_fn = descriptor_types[k] && descriptor_types[k].write;
        if (write_fn) {
          res = write_fn(desc);
          if (res !== false) {
            break;
          }
        }
      }
      if (!res) {
        return false;
      }
    }
    // assert(res.length === 18);
    buf.set(res, 0x36 + 18 * i);
  }

  buf[0x7e] = opts.extensions.length;
  buf[0x7f] = (opts.valid ? checksum(buf) : opts._checksum);

  const ret = [buf];
  if (!opts.extensions.every((ext) => {
    let res;
    if (Buffer.isBuffer(ext)) {
      res = ext;
    } else if (Array.isArray(ext) ||
               (desc.type === 'Buffer' && data in desc) ) {
      res = Buffer.from(ext);
    }
    ret.push(res);
    return (res && res.length === 128);
  })) {
    return false;
  }

  return Buffer.concat(ret);
}

module.exports = {
  read,
  write
};

