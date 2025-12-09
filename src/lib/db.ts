// src/lib/db.ts
import mongoose, { type Connection } from 'mongoose';

const uri = process.env.MONGODB_URI;   // ❌ no "!" and no throw here

type Cached = { conn: Connection | null; promise: Promise<Connection> | null };

// eslint-disable-next-line no-var
declare global {
  // allow global caching in dev (hot reload)
  var _mongoose: Cached | undefined;
}

const cached: Cached = global._mongoose ?? { conn: null, promise: null };

export async function connectDB(): Promise<Connection> {
  if (!uri) {
    // Now we only complain when someone actually tries to connect
    throw new Error('[db] MONGODB_URI is not set in environment variables.');
  }

  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    cached.promise = mongoose.connect(uri, { dbName: 'Live' }).then((m) => {
      const conn = m.connection as Connection;
      const dbName =
        (conn as any).db?.databaseName ??
        (conn as any).name ??
        '(unknown)';
      console.log('[db] connected to:', dbName);
      return conn;
    });
  }

  cached.conn = await cached.promise;
  global._mongoose = cached;
  return cached.conn;
}
