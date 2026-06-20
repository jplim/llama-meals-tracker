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

    // Check if migration is needed (i.e. check if trackerId exists in friends)
    try {
      const columnCheck = await db.all("PRAGMA table_info(friends)");
      const hasTrackerId = columnCheck.some((col: any) => col.name === "trackerId");
      if (columnCheck.length > 0 && !hasTrackerId) {
        console.log("Migrating database schema: Re-creating tables with trackerId support...");
        await db.exec(`
          DROP TABLE IF EXISTS expense_items;
          DROP TABLE IF EXISTS expense_participants;
          DROP TABLE IF EXISTS expenses;
          DROP TABLE IF EXISTS friends;
          DROP TABLE IF EXISTS trackers;
          DROP TABLE IF EXISTS users;
        `);
      }
    } catch (e) {
      // Table doesn't exist yet, which is fine
    }

    // Initialize Schema
    await db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        picture TEXT
      );

      CREATE TABLE IF NOT EXISTS trackers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        ownerId TEXT NOT NULL,
        FOREIGN KEY (ownerId) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS tracker_shares (
        trackerId TEXT NOT NULL,
        userId TEXT NOT NULL,
        PRIMARY KEY (trackerId, userId),
        FOREIGN KEY (trackerId) REFERENCES trackers(id) ON DELETE CASCADE,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS friends (
        id TEXT PRIMARY KEY,
        trackerId TEXT NOT NULL,
        name TEXT NOT NULL,
        color TEXT NOT NULL,
        FOREIGN KEY (trackerId) REFERENCES trackers(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS expenses (
        id TEXT PRIMARY KEY,
        trackerId TEXT NOT NULL,
        title TEXT NOT NULL,
        date TEXT NOT NULL,
        paidById TEXT NOT NULL,
        amount REAL NOT NULL,
        estimatedCalories INTEGER NOT NULL,
        notes TEXT,
        receiptImage TEXT,
        FOREIGN KEY (trackerId) REFERENCES trackers(id) ON DELETE CASCADE,
        FOREIGN KEY (paidById) REFERENCES friends(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS expense_participants (
        expenseId TEXT NOT NULL,
        friendId TEXT NOT NULL,
        PRIMARY KEY (expenseId, friendId),
        FOREIGN KEY (expenseId) REFERENCES expenses(id) ON DELETE CASCADE,
        FOREIGN KEY (friendId) REFERENCES friends(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS expense_items (
        id TEXT PRIMARY KEY,
        expenseId TEXT NOT NULL,
        name TEXT NOT NULL,
        price REAL NOT NULL,
        estimatedCalories INTEGER NOT NULL,
        FOREIGN KEY (expenseId) REFERENCES expenses(id) ON DELETE CASCADE
      );
    `);
  }
  return db;
}
