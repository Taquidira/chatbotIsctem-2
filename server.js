const express = require("express");
const cors = require("cors");
const db = require("./db.js");
const app = express();
const path = require("path");
const bcrypt = require("bcryptjs");

const PORT = process.env.PORT || 3000;
//servidor
app.listen(PORT, "0.0.0.0", () => {
    console.log("Server running on " + PORT);
});

app.use(cors());

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});




const synonyms = {
    inscricao: ["matricula", "registo", "entrar"],
    notas: ["classificacao", "resultado", "pontuacao"],
    mensalidade: ["propina", "pagamento"]
};


//para reconhecer outras palavras
function expandWords(words) {
    let expanded = [...words];

    for (let w of words) {
        for (let key in synonyms) {
            if (synonyms[key].includes(w) || w === key) {
                expanded.push(key);
                expanded.push(...synonyms[key]);
            }
        }
    }

    return [...new Set(expanded)];
}

/* ---------------- UTIL ---------------- */
function normalize(text) {
    return text
        .toLowerCase()
        .replace(/[^a-zà-ú0-9\s]/gi, "")
        .trim();
}

/* ---------------- CHATBOT (VERSÃO ESTÁVEL FINAL) ---------------- */
app.post("/chat", (req, res) => {

    const message = req.body.message;

    console.log("Mensagem recebida:", message);

    // SELECT (better-sqlite3)
    let faqs;
    try {
        faqs = db.prepare("SELECT * FROM faq").all();
    } catch (err) {
        return res.json({ response: "Erro no servidor" });
    }

    let userWords = expandWords(
        normalize(message)
            .split(" ")
            .filter(w => w.length > 1)
    );

    let bestFaq = null;
    let bestScore = 0;

    for (let faq of faqs) {

        let allText = `
            ${faq.question} 
            ${faq.variations || ""} 
            ${faq.answers || ""}
        `;

        let faqWords = normalize(allText)
            .split(" ")
            .filter(w => w.length > 1);

        let common = faqWords.filter(w => userWords.includes(w)).length;

        if (common === 0) continue;

        let score = common / faqWords.length;

        if (score > bestScore) {
            bestScore = score;
            bestFaq = faq;
        }
    }

    let response;

    if (bestFaq && bestScore >= 0.25) {
        response = bestFaq.answer;
    } else {
        response = "Não percebi a tua pergunta.";
    }

    // INSERT (better-sqlite3)
    db.prepare(
        "INSERT INTO logs (message, response) VALUES (?, ?)"
    ).run(message, response);

    res.json({ response });
});
/* ---------------- FAQS ---------------- */
app.get("/faqs", (req, res) => {

   try {
    const rows = db.prepare("SELECT * FROM faq").all();
    res.json(rows);
} catch (err) {
    res.status(500).json({ error: err.message });
}
});

/* ---------------- ADD FAQ ---------------- */
app.post("/add-faq", (req, res) => {

    const { question, answer } = req.body;

    console.log("FAQ RECEBIDA:", question, answer); 
    
    try {

        const result = db.prepare(
            "INSERT INTO faq (question, answer, variations, answers) VALUES (?, ?, '', '')"
        ).run(question, answer);

        console.log("INSERT OK:", result); 

        db.prepare(
            "UPDATE logs SET response = 'ANSWERED' WHERE message = ?"
        ).run(question);

        res.json({ success: true });

    } catch (err) {
        console.log("ERRO ADD FAQ:", err); // 👈 AQUI
        res.status(500).json({ error: err.message });
    }
});

/* ---------------- DELETE FAQ ---------------- */
app.delete("/faq/:id", (req, res) => {

    try {

        db.prepare(
            "DELETE FROM faq WHERE id = ?"
        ).run(req.params.id);

        res.json({ success: true });

    } catch (err) {

        console.log(err);

        res.status(500).json({
            success: false,
            error: err.message
        });
    }

});

/* ---------------- UPDATE FAQ ---------------- */
app.put("/faq/:id", (req, res) => {

    try {

        const id = req.params.id;
        const { question, answer, variations, answers } = req.body;

        db.prepare(`
            UPDATE faq
            SET question = ?, answer = ?, variations = ?, answers = ?
            WHERE id = ?
        `).run(
            question,
            answer,
            variations || "",
            answers || "",
            id
        );

        res.json({ success: true });

    } catch (err) {

        console.log(err);

        res.status(500).json({
            success: false,
            error: err.message
        });
    }

});
/* ---------------- UNANSWERED ---------------- */
app.get("/unanswered", (req, res) => {

   const rows = db.prepare(`
SELECT *
FROM logs
WHERE response = 'Não percebi a tua pergunta.'
ORDER BY id DESC
`).all();

res.json(rows);
});

/* ---------------- MARK ANSWERED ---------------- */
app.post("/mark-answered", (req, res) => {

    const { message } = req.body;

   db.prepare(`
UPDATE logs
SET response='ANSWERED'
WHERE message=? AND response='Não percebi a tua pergunta.'
`).run(message);

res.json({ success: true });
});

/* ---------------- STATS ---------------- */
app.get("/stats", (req, res) => {

    try {

        const top = db.prepare(`
            SELECT message, COUNT(*) as total
            FROM logs
            GROUP BY message
            ORDER BY total DESC
            LIMIT 5
        `).all();

        const count = db.prepare(`
            SELECT COUNT(*) as total
            FROM logs
        `).get();

        const unanswered = db.prepare(`
            SELECT COUNT(*) as unanswered
            FROM logs
            WHERE response = 'Não percebi a tua pergunta.'
        `).get();

        res.json({
            total: count.total,
            unanswered: unanswered.unanswered,
            topQuestions: top
        });

    } catch (err) {

        console.log("STATS ERROR:", err);

        res.status(500).json({
            error: err.message
        });
    }

});



/* ---------------- LOGS ---------------- */
app.get("/logs", (req, res) => {
    const rows = db.prepare("SELECT * FROM logs").all();
    res.json(rows);
});
/* ---------------- ROOT ---------------- */
app.get("/", (req, res) => {
    res.redirect("/login.html");
});

//para login
app.post("/login", (req, res) => {

    try {

        const { username, password } = req.body;

        const user = db.prepare(
            "SELECT * FROM admins WHERE username = ?"
        ).get(username);

        console.log("USER:", user);

        if (!user) {
            return res.json({ success: false });
        }

        const valid = bcrypt.compareSync(password, user.password);

        console.log("PASSWORD OK:", valid);

        if (!valid) {
            return res.json({ success: false });
        }

        return res.json({ success: true });

    } catch (err) {

        console.log("LOGIN ERROR:", err);

        return res.status(500).json({ success: false });
    }
});


//para registar novo user
app.post("/register", (req, res) => {

    console.log("LOGIN BODY:", req.body);

    try {

        const { username, password } = req.body;

        if (!username || !password) {
            return res.json({ success: false, message: "Campos vazios" });
        }

        const hash = bcrypt.hashSync(password, 10);

        db.prepare(
            "INSERT INTO admins (username, password) VALUES (?, ?)"
        ).run(username, hash);

        return res.json({ success: true });

    } catch (err) {

        if (err.message.includes("UNIQUE")) {
            return res.json({ success: false, message: "User já existe" });
        }

        return res.status(500).json({ success: false });
    }
});

app.get("/reset-admins", (req, res) => {
    db.prepare("DELETE FROM admins").run();
    res.json({ success: true });
});