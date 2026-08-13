import Database from "better-sqlite3";
import { existsSync } from "node:fs";
import path from "node:path";

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    const dbPath =
      process.env.DB_PATH ||
      path.join(process.cwd(), "data", "lol.db");
    db = new Database(dbPath, { readonly: true });
  }
  return db;
}

export function dbExists(): boolean {
  const dbPath =
    process.env.DB_PATH || path.join(process.cwd(), "data", "lol.db");
  return existsSync(dbPath);
}
