const express = require("express");
const cors = require("cors");
const db = require("./db.js");
const app = express();
const path = require("path");
const bcrypt = require("bcryptjs");

const PORT = process.env.PORT || 3000;

// middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// servidor
app.listen(PORT, "0.0.0.0", () => {
    console.log("Server running on " + PORT);
});

// ROOT
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// SINONIMOS (IMPORTANTE: tem de existir!)
const synonyms = {
    inscricao: ["matricula", "registo", "entrar"],
    notas: ["classificacao", "resultado", "pontuacao"],
    mensalidade: ["propina", "pagamento"]
};

// EXPAND WORDS
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

// NORMALIZE
function normalize(text) {
    return text
        .toLowerCase()
        .replace(/[^a-zà-ú0-9\s]/gi, "")
        .trim();
}

/* ---------------- CHATBOT (VERSÃO ESTÁVEL FINAL) ---------------- */
app.post("/chat", async (req, res) => {

    const message = req.body.message;

    console.log("Mensagem recebida:", message);

    let faqs;

    try {
        // SELECT (PostgreSQL)
        const result = await db.query("SELECT * FROM faq");
        faqs = result.rows;

    } catch (err) {
        console.log(err);
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

    try {
        // INSERT (PostgreSQL)
        await db.query(
            "INSERT INTO logs (message, response) VALUES ($1, $2)",
            [message, response]
        );

    } catch (err) {
        console.log(err);
    }

    res.json({ response });
});

//faqs
app.get("/faqs", async (req, res) => {

    try {
        const result = await db.query("SELECT * FROM faq");
        res.json(result.rows);

    } catch (err) {
        res.status(500).json({ error: err.message });
    }

});

//adicionar novas faqs
app.post("/add-faq", async (req, res) => {

    const { question, answer } = req.body;

    console.log("FAQ RECEBIDA:", question, answer);
    console.log("DB CONNECTION OK");

    try {

        // INSERT FAQ (PostgreSQL)
        const result = await db.query(
            "INSERT INTO faq (question, answer, variations, answers) VALUES ($1, $2, '', '') RETURNING *",
            [question, answer]
        );

        console.log("INSERT OK:", result.rows[0]);

        // UPDATE logs (PostgreSQL)
        await db.query(
            "UPDATE logs SET response = 'ANSWERED' WHERE message = $1",
            [question]
        );

        res.json({ success: true });

    } catch (err) {

        console.log("ERRO ADD FAQ:", err);

        res.status(500).json({ error: err.message });
    }
});

//apagar faq
app.delete("/faq/:id", async (req, res) => {

    const id = req.params.id;

    try {

        await db.query(
            "DELETE FROM faq WHERE id = $1",
            [id]
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

//update faq
app.put("/faq/:id", async (req, res) => {

    const id = req.params.id;
    const { question, answer, variations, answers } = req.body;

    try {

        await db.query(
            `
            UPDATE faq
            SET question = $1,
                answer = $2,
                variations = $3,
                answers = $4
            WHERE id = $5
            `,
            [
                question,
                answer,
                variations || "",
                answers || "",
                id
            ]
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
//unanswered (pergunta nao respondida)
app.get("/unanswered", async (req, res) => {

    try {

        const result = await db.query(`
            SELECT *
            FROM logs
            WHERE response = $1
            ORDER BY id DESC
        `, ["Não percebi a tua pergunta."]);

        res.json(result.rows);

    } catch (err) {

        console.log(err);

        res.status(500).json({ error: err.message });
    }

});

//answered
app.post("/mark-answered", async (req, res) => {

    const { message } = req.body;

    try {

        await db.query(`
            UPDATE logs
            SET response = 'ANSWERED'
            WHERE message = $1
            AND response = 'Não percebi a tua pergunta.'
        `, [message]);

        res.json({ success: true });

    } catch (err) {

        console.log(err);

        res.status(500).json({
            success: false,
            error: err.message
        });
    }

});

//STATS
app.get("/stats", async (req, res) => {

    try {

        // TOP perguntas
        const topResult = await db.query(`
            SELECT message, COUNT(*) as total
            FROM logs
            GROUP BY message
            ORDER BY total DESC
            LIMIT 5
        `);

        // total de logs
        const countResult = await db.query(`
            SELECT COUNT(*) as total
            FROM logs
        `);

        // não respondidas
        const unansweredResult = await db.query(`
            SELECT COUNT(*) as unanswered
            FROM logs
            WHERE response = $1
        `, ["Não percebi a tua pergunta."]);

        res.json({
            total: countResult.rows[0].total,
            unanswered: unansweredResult.rows[0].unanswered,
            topQuestions: topResult.rows
        });

    } catch (err) {

        console.log("STATS ERROR:", err);

        res.status(500).json({
            error: err.message
        });
    }

});



//logs
app.get("/logs", async (req, res) => {

    try {

        const result = await db.query(`
            SELECT * FROM logs
        `);

        res.json(result.rows);

    } catch (err) {

        console.log(err);

        res.status(500).json({ error: err.message });
    }

});

//root
app.get("/", (req, res) => {
    res.redirect("/login.html");
});

//para login
app.post("/login", async (req, res) => {

    try {

        const { username, password } = req.body;

        const result = await db.query(
            "SELECT * FROM admins WHERE username = $1",
            [username]
        );

        const user = result.rows[0];

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
app.post("/register", async (req, res) => {

    console.log("REGISTER BODY:", req.body);

    try {

        const { username, password } = req.body;

        if (!username || !password) {
            return res.json({ success: false, message: "Campos vazios" });
        }

        const hash = bcrypt.hashSync(password, 10);

        await db.query(
            "INSERT INTO admins (username, password) VALUES ($1, $2)",
            [username, hash]
        );

        return res.json({ success: true });

    } catch (err) {

        console.log("REGISTER ERROR:", err);

        if (err.message.includes("unique")) {
            return res.json({ success: false, message: "User já existe" });
        }

        return res.status(500).json({ success: false });
    }
});

//para resetar os admins no dashboard
app.get("/reset-admins", async (req, res) => {

    try {

        await db.query("DELETE FROM admins");

        res.json({ success: true });

    } catch (err) {

        console.log(err);

        res.status(500).json({
            success: false,
            error: err.message
        });
    }

});