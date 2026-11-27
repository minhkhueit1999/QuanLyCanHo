import mongoose from 'mongoose';

let cachedSupportsTransactions = null;

/**
 * Connect to MongoDB using Mongoose 8+ configuration.
 * Also detects whether the cluster supports multi-document ACID transactions.
 * @param {string} uri
 */
export async function connectDB(uri) {
  if (!uri) {
    throw new Error('MONGODB_URI is required to connect to MongoDB');
  }

  mongoose.set('strictQuery', true);

  mongoose.connection.on('error', (err) => {
    console.error('[MongoDB] Connection error:', err.message);
  });

  mongoose.connection.on('disconnected', () => {
    cachedSupportsTransactions = null;
    console.warn('[MongoDB] Disconnected from database');
  });

  const conn = await mongoose.connect(uri, {
    autoIndex: true,
  });

  await detectTransactionSupport();
  console.log(
    `[MongoDB] Connected: ${conn.connection.host}/${conn.connection.name} (Transactions: ${
      cachedSupportsTransactions ? 'REPLICA_SET_ACID' : 'STANDALONE_ATOMIC'
    })`
  );
  return conn;
}

/**
 * Detect whether connected MongoDB topology is a Replica Set or mongos.
 * @returns {Promise<boolean>}
 */
export async function detectTransactionSupport() {
  if (cachedSupportsTransactions !== null) return cachedSupportsTransactions;
  try {
    const hello = await mongoose.connection.db.admin().command({ hello: 1 });
    cachedSupportsTransactions = Boolean(hello.setName || hello.msg === 'isdbgrid');
  } catch {
    cachedSupportsTransactions = false;
  }
  return cachedSupportsTransactions;
}

/**
 * Run business logic inside a MongoDB ACID Session Transaction when Replica Set / mongos is active.
 * On standalone local MongoDB, gracefully runs with session = null so single-document atomic ops
 * and compensating guards still execute cleanly without throwing replica-set topology errors.
 * @template T
 * @param {(session: import('mongoose').ClientSession | null) => Promise<T>} work
 * @returns {Promise<T>}
 */
export async function runInTransaction(work) {
  const canTransact = await detectTransactionSupport();
  if (!canTransact) {
    return work(null);
  }

  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}

/**
 * Attach optional Mongoose session to query/save options cleanly.
 * @param {import('mongoose').ClientSession | null} session
 */
export function sessionOpts(session) {
  return session ? { session } : {};
}

/**
 * Strictly validate a 24-character hex MongoDB ObjectId.
 * @param {unknown} value
 * @returns {boolean}
 */
export function isValidObjectId(value) {
  if (!value) return false;
  const str = String(value);
  return /^[0-9a-fA-F]{24}$/.test(str) && mongoose.Types.ObjectId.isValid(str);
}
