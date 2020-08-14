"use strict";

const margin_percent = 1.8,
      h_sync_percent = 8,
      cell_gran_rnd = 8,
      min_v_porch_rnd = 1,  // MIN_PORCH
      min_vsync_bp = 550,   // MIN_VSYNC_PLUS_BP
      v_sync_rqd = 3;

function cell_rnd(num, denom, val) { // {{{ returns val * w / h rounded to cell_gran_rnd
  return cell_gran_rnd * Math.round((val * num / denom) / cell_gran_rnd);
}
// }}}

function gtf(h_active, v_active, refresh_rate, interlaced = false, margins = false, M = 600, C = 40, K = 128, J = 20) {
  const C_PRIME = ((C - J) * K / 256.0) + J,
        M_PRIME = M * K / 256.0;

  const h_pixels_rnd = Math.round(h_active / cell_gran_rnd) * cell_gran_rnd;
  const v_lines_rnd = Math.round(interlaced ? v_active / 2 : v_active);
  const v_field_rate_rqd = (interlaced) ? 2 * refresh_rate : refresh_rate;

  let borders = (margins) ? [
    cell_rnd(margin_percent, 100, h_pixels_rnd),
    Math.round(margin_percent / 100 * v_lines_rnd)
  ] : [0, 0];

  const total_active_pixels = h_pixels_rnd + 2 * borders[0];

  const interlace_add = (interlaced) ? 0.5 : 0;

  const h_period_est = 1000000.0 * ((1 / v_field_rate_rqd) - min_vsync_bp / 1000000.0) / (v_lines_rnd + 2 * borders[1] + min_v_porch_rnd + interlace_add);

  const v_sync_bp = Math.round(min_vsync_bp / h_period_est);

  const v_total = v_lines_rnd + 2 * borders[1] + v_sync_bp + interlace_add + min_v_porch_rnd;

  const v_field_rate_est = 1 / h_period_est / v_total * 1000000;
  const h_period = h_period_est / (v_field_rate_rqd / v_field_rate_est);
  const v_field_rate = 1 / h_period / v_total * 1000000;

  const ideal_duty_cycle = C_PRIME - (M_PRIME * h_period / 1000.0);

  const h_blank = Math.round(total_active_pixels * ideal_duty_cycle / (100.0 - ideal_duty_cycle) / (2 * cell_gran_rnd)) * (2 * cell_gran_rnd);

  const h_total = total_active_pixels + h_blank;

  const pixel_clock = h_total / h_period;

  const h_rate = 1000 / h_period;  // = 1000 * pixel_clock / h_total;

  const h_sync = cell_rnd(h_sync_percent, 100, h_total);

  return {
    h_total,
    h_active,
//    h_blank,
    h_front_porch: h_blank / 2 - h_sync,  // h_blank - h_sync - .h_back_porch
    h_sync: h_sync,
    h_back_porch: h_blank / 2,

    v_total,
    v_active,
//      v_blank: v_sync_bp + min_v_porch_rnd + interlace_add,  // ??
    v_front_porch: min_v_porch_rnd + interlace_add,   // V ODD FRONT PORCH
    v_sync: v_sync_rqd,
    v_back_porch: v_sync_bp - v_sync_rqd,

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
  };
}

module.exports = gtf;

