"use strict";

const data = require('./dmt113.json');

function fromTbl(data) {
  const cols = data[0],
        rows = data.slice(1);
  return rows.map((row) => {
    const obj = {};
    cols.forEach((col, idx) => {
      obj[col] = row[idx];
    });
    return obj;
  });
}

module.exports = fromTbl(data);

