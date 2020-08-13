"use strict";

const SIGNAL_LEVELS = [
  'video 0.700 Vpp : sync 0.300 Vpp : total 1.000 Vpp',
  'video 0.714 Vpp : sync 0.286 Vpp : total 1.000 Vpp',
  'video 1.000 Vpp : sync 0.400 Vpp : total 1.400 Vpp',
  'video 0.700 Vpp : sync 0.000 Vpp : total 0.700 Vpp'
];
const VIDEO_SETUPS = [
  'blank level = black level',
  'blank-to-blank setup / pedestal'
];

const COLOR_DEPTHS = [
  'not defined',
  '6 bits',
  '8 bits',
  '10 bits',
  '12 bits',
  '14 bits',
  '16 bits',
  'reserved'
];
const DVI_STANDARDS = [
  'not defined', 'DVI',         'HDMI-a',   'HDMI-b',
  'MDDI',        'DisplayPort', 'reserved', 'reserved',
  'reserved',    'reserved',    'reserved', 'reserved',
  'reserved',    'reserved',    'reserved', 'reserved'
];

const COLOR_TYPES = [
  'monochrome / gray scale',
  'RGB color',
  'Non-RGB color',
  'not defined'
];
const COLOR_FORMATS = [
  'monochrome / gray scale',
  'RGB color',
  'Non-RGB color',
  'not defined'
];

const ARs = [
  [16, 10], [4, 3], [5, 4], [16, 9]
];

// TODO? not used for output right now
// NOTE: ordering might be unexpected.
const STEREOS = [
  'no stereo',
  'field sequential, sync on right image',
  'field sequential, sync on left image',
  '4-way interleaved',

  'no stereo',
  '2-way interleaved, even lines are right image',
  '2-way interleaved, even lines are left image',
  'side-by-side interleaved'
];

// TODO? not used for output right now
const PREFERRED_ARs = [
  [4, 3], [16, 9], [16, 10], [5, 4],
  [15, 9], 'reserved', 'reserved', 'reserved'
];

module.exports = {
  SIGNAL_LEVELS,
  VIDEO_SETUPS,

  COLOR_DEPTHS,
  DVI_STANDARDS,

  COLOR_TYPES,
  COLOR_FORMATS,

  ARs,
  PREFERRED_ARs,

  STEREOS
};

