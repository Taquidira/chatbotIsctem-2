const path = require("path");
const sqlite3 = require("sqlite3").verbose();

// 📁 garante que a base de dados fica sempre no mesmo sítio
const dbPath = path.join(process.cwd, "database.db");

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.log("Erro ao abrir DB:", err.message);
    } else {
        console.log("Base de dados ligada:", dbPath);
    }
});

/* ---------------- CRIAR TABELAS AUTOMATICAMENTE ---------------- */

db.serialize(() => {

    // 🔐 ADMINS
    db.run(`
        CREATE TABLE IF NOT EXISTS admins (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            password TEXT
        )
    `);

    // 👤 FAQS
    db.run(`
        CREATE TABLE IF NOT EXISTS faq (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            question TEXT,
            answer TEXT,
            variations TEXT,
            answers TEXT
        )
    `);

    // 📊 LOGS
    db.run(`
        CREATE TABLE IF NOT EXISTS logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            message TEXT,
            response TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // 👑 ADMIN PADRÃO
    db.run(`
        INSERT OR IGNORE INTO admins (username, password)
        VALUES ('admin', '1234')
    `);

});

module.exports = db;

