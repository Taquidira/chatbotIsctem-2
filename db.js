const path = require("path");
const Database = require("better-sqlite3");

// base de dados no diretório correto do Render
const dbPath = path.join(process.cwd(), "database.db");

const db = new Database(dbPath);

/* ---------------- CRIAR TABELAS ---------------- */

db.prepare(`
    CREATE TABLE IF NOT EXISTS admins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT
    )
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS faq (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        question TEXT,
        answer TEXT,
        variations TEXT,
        answers TEXT
    )
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        message TEXT,
        response TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`).run();

/* ADMIN PADRÃO */
db.prepare(`
    INSERT OR IGNORE INTO admins (username, password)
    VALUES ('admin', '1234')
`).run();

module.exports = db;