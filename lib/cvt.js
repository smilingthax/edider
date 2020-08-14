"use strict";

const margin_percent = 1.8,
      h_sync_percent = 8,
      cell_gran_rnd = 8,
      min_v_back_porch = 6,
      min_v_porch_rnd = 3;

const C = 40,
      M = 600,
      K = 128,
      J = 20;

const C_PRIME = ((C - J) * K / 256.0) + J,
      M_PRIME = M * K / 256.0;

function cell_rnd(num, denom, val) { // {{{ returns val * w / h rounded to cell_gran_rnd
  return cell_gran_rnd * Math.floor((val * num / denom) / cell_gran_rnd);
}
// }}}

// reduced_blanking = 0(false) / 1(true) / 2 / '2video'
// NOTE: will not check refresh_rate == 60 for reduced_blanking = 1 ...
function cvt(h_active, v_active, refresh_rate, reduced_blanking = 0, interlaced = false, margins = false) {
  const v_field_rate_rqd = refresh_rate;
  const h_pixels_rnd = Math.floor(h_active / cell_gran_rnd) * cell_gran_rnd;

  let aspect_ratio, v_sync;
  if (h_pixels_rnd === cell_rnd(4, 3, v_active)) {
    aspect_ratio = [4, 3];
    v_sync = 4;
  } else if (h_pixels_rnd === cell_rnd(16, 9, v_active)) {
    aspect_ratio = [16, 9];
    v_sync = 5;
  } else if (h_pixels_rnd === cell_rnd(16, 10, v_active)) {
    aspect_ratio = [16, 10];
    v_sync = 6;
  } else if (h_pixels_rnd === cell_rnd(5, 4, v_active)) {
    aspect_ratio = [5, 4];
    v_sync = 7;
  } else if (h_pixels_rnd === cell_rnd(15, 9, v_active)) {
    aspect_ratio = [15, 9];
    v_sync = 7;
  } else {
    aspect_ratio = null;
    v_sync = 10;
  }

  const v_lines_rnd = Math.floor(interlaced ? v_active / 2 : v_active);

  let borders = (margins) ? [
    cell_rnd(margin_percent, 100, h_pixels_rnd),
    Math.floor(margin_percent / 100 * v_lines_rnd)
  ] : [0, 0];

  const total_active_pixels = h_pixels_rnd + 2 * borders[0];

  const interlace_add = (interlaced) ? 0.5 : 0;

  if (reduced_blanking == 0) {
    const clock_step = 0.25,
          min_vsync_bp = 550;

    const h_period_est = 1000000.0 * ((1 / v_field_rate_rqd) - min_vsync_bp / 1000000.0) / (v_lines_rnd + 2 * borders[1] + min_v_porch_rnd + interlace_add);

    const v_sync_bp = Math.max(v_sync + min_v_back_porch, Math.floor(min_vsync_bp / h_period_est) + 1);

    const v_total = v_lines_rnd + 2 * borders[1] + v_sync_bp + interlace_add + min_v_porch_rnd;

    const cur_duty_cycle = Math.max(C_PRIME - (M_PRIME * h_period_est / 1000.0), 20);
    const h_blank = Math.floor(total_active_pixels * cur_duty_cycle / (100.0 - cur_duty_cycle) / (2 * cell_gran_rnd)) * (2 * cell_gran_rnd);

    const h_total = total_active_pixels + h_blank;

    const h_sync = cell_rnd(h_sync_percent, 100, h_total);  // (note: x.org's cvt seems to round up here?)

    const pixel_clock = Math.floor((h_total / h_period_est) / clock_step) * clock_step;

    const h_rate = 1000 * pixel_clock / h_total;
    const v_field_rate = 1000 * h_rate / v_total;

    return {
      h_total,
      h_active,
//      h_blank,
      h_front_porch: h_blank / 2 - h_sync,  // h_blank - h_sync - .h_back_porch
      h_sync: h_sync,
      h_back_porch: h_blank / 2,

      v_total,
      v_active,
//      v_blank: v_sync_bp + min_v_porch_rnd,
      v_front_porch: min_v_porch_rnd,
      v_sync: v_sync,
      v_back_porch: v_sync_bp - v_sync,

      pixel_clock,
      h_rate,
      v_field_rate,
      v_rate: (interlaced) ? v_field_rate / 2 : v_field_rate,

      border_left: borders[0],
      border_right: borders[0],

      border_top: borders[1],
      border_bottom: borders[1],

      interlaced,
      h_sync_positive: false,
      v_sync_positive: true
      // reduced_blanking: 0
    };
  } else {
    const rb_h_sync = 32,
          rb_min_v_blank = 460,
          rb_min_v_back_porch = 6;

    let clock_step, pixel_clock_factor, h_blank, rb_v_front_porch;
    if (reduced_blanking == 1) {
      clock_step = 0.25;
      pixel_clock_factor = 1;
      h_blank = 160;
      rb_v_front_porch = 3;
    } else if (reduced_blanking == '2video') {
      clock_step = 0.001;
      pixel_clock_factor = 1000 / 1001;
      v_sync = 8;
      h_blank = 80;
      rb_v_front_porch = 1;
    } else if (reduced_blanking == 2) {
      clock_step = 0.001;
      pixel_clock_factor = 1;
      v_sync = 8;
      h_blank = 80;
      rb_v_front_porch = 1;
    } else {
      throw new Error('unknown reduced_blanking version');
    }

    const h_period_est = ((1000000.0 / v_field_rate_rqd) - rb_min_v_blank) / (v_lines_rnd + 2 * borders[1]);

    const vbi_lines = Math.floor(rb_min_v_blank / h_period_est) + 1;
    const v_blank = Math.max(vbi_lines, rb_v_front_porch + v_sync + rb_min_v_back_porch);

    const v_front_porch = (reduced_blanking == 1) ? rb_v_front_porch : v_blank - rb_min_v_back_porch - v_sync;

    const v_total = v_blank + v_lines_rnd + 2 * borders[1] + interlace_add;

    const h_total = total_active_pixels + h_blank;

    const pixel_clock = Math.floor((v_field_rate_rqd * v_total * h_total / 1000000.0 * pixel_clock_factor) / clock_step) * clock_step;

    const h_rate = 1000 * pixel_clock / h_total;
    const v_field_rate = 1000 * h_rate / v_total;

    return {
      h_total,
      h_active,
//      h_blank,
      h_front_porch: h_blank / 2 - rb_h_sync,  // h_blank - rb_h_sync - .h_back_porch
      h_sync: rb_h_sync,
      h_back_porch: h_blank / 2,

      v_total,
      v_active,
//      v_blank,
      v_front_porch,
      v_sync: v_sync,
      v_back_porch: v_blank - v_front_porch - v_sync,  // (reduced_blanking != 1): rb_min_v_back_porch (==6)

      pixel_clock,
      h_rate,
      v_field_rate,
      v_rate: (interlaced) ? v_field_rate / 2 : v_field_rate,

      border_left: borders[0],
      border_right: borders[0],

      border_top: borders[1],
      border_bottom: borders[1],

      interlaced,
      h_sync_positive: true,
      v_sync_positive: false
      // reduced_blanking: (reduced_blanking == 1) ? 1 : 2  // ?video
    };
  }
}

module.exports = cvt;

