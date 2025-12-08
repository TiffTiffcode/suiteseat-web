//C:\Users\tiffa\OneDrive\Desktop\suiteseat-web\src\lib\db.ts
import mongoose, { type Connection } from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI!;
if (!MONGODB_URI) throw new Error('MONGODB_URI missing');

type Cached = { conn: Connection | null; promise: Promise<Connection> | null };

// eslint-disable-next-line no-var
declare global {
  // allow global caching in dev (hot reload)
  var _mongoose: Cached | undefined;
}

const cached: Cached = global._mongoose ?? { conn: null, promise: null };

export async function connectDB(): Promise<Connection> {
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(MONGODB_URI, { dbName: 'Live' })
      .then((m) => {
        const conn = m.connection as Connection;
        // db may be undefined in types; guard for safety
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
