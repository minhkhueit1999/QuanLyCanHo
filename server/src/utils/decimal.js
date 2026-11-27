import mongoose from 'mongoose';

/**
 * Convert numeric or string input to Mongoose Decimal128 rounded to 2 decimals.
 * @param {number|string|mongoose.Types.Decimal128|null|undefined} val
 * @param {number} fallback
 * @returns {mongoose.Types.Decimal128}
 */
export function toDecimal128(val, fallback = 0) {
  if (val instanceof mongoose.Types.Decimal128) return val;
  const num = val === null || val === undefined || val === '' ? fallback : Number(val);
  if (Number.isNaN(num) || !Number.isFinite(num)) {
    return mongoose.Types.Decimal128.fromString(String(fallback));
  }
  return mongoose.Types.Decimal128.fromString(num.toFixed(2).replace(/\.00$/, ''));
}

/**
 * Convert Decimal128 (or number/string) to plain JS number rounded to 2 decimal places.
 * @param {unknown} val
 * @returns {number}
 */
export function decToNumber(val) {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return Number.isFinite(val) ? val : 0;
  if (typeof val === 'string') {
    const n = Number(val);
    return Number.isFinite(n) ? n : 0;
  }
  if (val instanceof mongoose.Types.Decimal128 || val?._bsontype === 'Decimal128') {
    return Number(val.toString());
  }
  if (typeof val === 'object' && val.$numberDecimal !== undefined) {
    return Number(val.$numberDecimal);
  }
  const n = Number(val);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Round VND money neatly to integer or 2 decimals for rates.
 * @param {number} val
 */
export function roundMoney(val) {
  return Math.round((Number(val) || 0) * 100) / 100;
}

/**
 * Recursively convert all Decimal128 values inside a document / plain object to JS numbers
 * for clean JSON serialization in REST API responses.
 * @param {any} input
 * @returns {any}
 */
export function serializeDecimals(input) {
  if (input === null || input === undefined) return input;
  if (input instanceof mongoose.Types.Decimal128 || input?._bsontype === 'Decimal128') {
    return Number(input.toString());
  }
  if (input instanceof Date || input instanceof mongoose.Types.ObjectId) {
    return input;
  }
  if (Array.isArray(input)) {
    return input.map(serializeDecimals);
  }
  if (typeof input === 'object') {
    if (input.$numberDecimal !== undefined) {
      return Number(input.$numberDecimal);
    }
    const out = {};
    for (const [k, v] of Object.entries(input)) {
      out[k] = serializeDecimals(v);
    }
    return out;
  }
  return input;
}

/**
 * Attach clean JSON & Object transform converting Decimal128 fields to plain numbers.
 * @param {mongoose.Schema} schema
 */
export function applyDecimalTransform(schema) {
  const transform = (_doc, ret) => serializeDecimals(ret);
  schema.set('toJSON', { virtuals: true, transform });
  schema.set('toObject', { virtuals: true, transform });
}
