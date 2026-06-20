import sqlite3 from "sqlite3";
import { open, Database } from "sqlite";
import path from "path";
import fs from "fs";

let db: Database | null = null;

export async function getDb(): Promise<Database> {
  if (!db) {
    const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), "data", "meals.db");
    
    // Ensure the parent directory exists
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    db = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });

    // Enable foreign keys
    await db.run("PRAGMA foreign_keys = ON");

    // Initialize Schema
    await db.exec(`
      CREATE TABLE IF NOT EXISTS friends (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        color TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS expenses (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        date TEXT NOT NULL,
        paidById TEXT NOT NULL,
        amount REAL NOT NULL,
        estimatedCalories INTEGER NOT NULL,
        notes TEXT,
        receiptImage TEXT,
        FOREIGN KEY (paidById) REFERENCES friends (id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS expense_participants (
        expenseId TEXT NOT NULL,
        friendId TEXT NOT NULL,
        PRIMARY KEY (expenseId, friendId),
        FOREIGN KEY (expenseId) REFERENCES expenses (id) ON DELETE CASCADE,
        FOREIGN KEY (friendId) REFERENCES friends (id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS expense_items (
        id TEXT PRIMARY KEY,
        expenseId TEXT NOT NULL,
        name TEXT NOT NULL,
        price REAL NOT NULL,
        estimatedCalories INTEGER NOT NULL,
        FOREIGN KEY (expenseId) REFERENCES expenses (id) ON DELETE CASCADE
      );
    `);
  }
  return db;
}
