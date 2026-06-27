const express = require("express");
const cors = require("cors");
const db = require("./db.js");
const app = express();
const path = require("path");

const PORT = process.env.PORT || 3000;
//servidor
app.listen(PORT, "0.0.0.0", () => {
    console.log("Server running on " + PORT);
});

app.use(cors());

app.use(express.json());
app.use(express.static(path.join(__dirname, "Public")));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "Public", "index.html"));
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

    db.all("SELECT * FROM faq", [], (err, faqs) => {

        if (err) {
            return res.json({ response: "Erro no servidor" });
        }

       let userWords = expandWords(
         normalize(message)
        .split(" ")
        .filter(w => w.length > 1));

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

        db.run(
            "INSERT INTO logs (message, response) VALUES (?, ?)",
            [message, response]
        );

        res.json({ response });
    });
});
/* ---------------- FAQS ---------------- */
app.get("/faqs", (req, res) => {

    db.all("SELECT * FROM faq", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

/* ---------------- ADD FAQ ---------------- */
app.post("/add-faq", (req, res) => {

    const { question, answer } = req.body;

    db.run(
        "INSERT INTO faq (question, answer, variations, answers) VALUES (?, ?, '', '')",
        [question, answer],
        function (err) {

            if (err) {
                console.log("ADD FAQ ERROR:", err.message);
                return res.status(500).json({ error: err.message });
            }

            res.json({ success: true });
        }
    );

    db.run(
    `UPDATE logs 
     SET response = 'ANSWERED'
     WHERE message = ?`,
    [question]
);
});

/* ---------------- DELETE FAQ ---------------- */
app.delete("/faq/:id", (req, res) => {

    db.run(
        "DELETE FROM faq WHERE id = ?",
        [req.params.id],
        function (err) {

            if (err) {
                return res.status(500).json({ error: err.message });
            }

            res.json({ success: true });
        }
    );
});

/* ---------------- UPDATE FAQ ---------------- */
app.put("/faq/:id", (req, res) => {

    const id = req.params.id;
    const { question, answer, variations, answers } = req.body;

    db.run(
        `UPDATE faq
         SET question = ?,
             answer = ?,
             variations = ?,
             answers = ?
         WHERE id = ?`,
        [
            question,
            answer,
            variations || "",
            answers || "",
            id
        ],
        function (err) {

            if (err) {
                return res.status(500).json({ error: err.message });
            }

            res.json({ success: true });
        }
    );
});

/* ---------------- UNANSWERED ---------------- */
app.get("/unanswered", (req, res) => {

    db.all(
        `SELECT * FROM logs 
         WHERE response = "Não percebi a tua pergunta."
         ORDER BY id DESC`,
        [],
        (err, rows) => {

            if (err) {
                console.log("UNANSWERED ERROR:", err.message);
                return res.status(500).json({ error: err.message });
            }

            res.json(rows);
        }
    );
});

/* ---------------- MARK ANSWERED ---------------- */
app.post("/mark-answered", (req, res) => {

    const { message } = req.body;

    db.run(
        `UPDATE logs
         SET response = 'ANSWERED'
         WHERE message = ? AND response = 'UNANSWERED'`,
        [message],
        function (err) {

            if (err) {
                return res.status(500).json({ error: err.message });
            }

            res.json({ success: true });
        }
    );
});

/* ---------------- STATS ---------------- */
app.get("/stats", (req, res) => {

    db.all(`
        SELECT message, COUNT(*) as total
        FROM logs
        GROUP BY message
        ORDER BY total DESC
        LIMIT 5
    `, [], (err, top) => {

        db.all(`SELECT COUNT(*) as total FROM logs`, [], (err2, count) => {

            db.all(`
                SELECT COUNT(*) as unanswered
                FROM logs
                WHERE response = "Não percebi a tua pergunta."
            `, [], (err3, unanswered) => {

                res.json({
                    total: count[0].total,
                    unanswered: unanswered[0].unanswered,
                    topQuestions: top
                });

            });

        });

    });

});

/* ---------------- LOGS ---------------- */
app.get("/logs", (req, res) => {

    db.all(
        "SELECT * FROM logs ORDER BY id DESC",
        [],
        (err, rows) => {

            if (err) {
                return res.status(500).json({ error: err.message });
            }

            res.json(rows);
        }
    );
});

/* ---------------- ROOT ---------------- */
app.get("/", (req, res) => {
    res.redirect("/login.html");
});

//para login
app.post("/login", (req, res) => {

    const { username, password } = req.body;

    db.get(
        "SELECT * FROM admins WHERE username = ? AND password = ?",
        [username, password],
        (err, user) => {

            if (err) {
                return res.status(500).json({ success: false });
            }

            if (!user) {
                return res.json({ success: false });
            }

            res.json({ success: true });
        }
    );
});

//para registar novo user
app.post("/register", (req, res) => {

    const { username, password } = req.body;

    if (!username || !password) {
        return res.json({ success: false, message: "Campos vazios" });
    }

    db.run(
        "INSERT INTO admins (username, password) VALUES (?, ?)",
        [username, password],
        function (err) {

            if (err) {

                if (err.message.includes("UNIQUE")) {
                    return res.json({ success: false, message: "User já existe" });
                }

                return res.status(500).json({ success: false });
            }

            res.json({ success: true });
        }
    );
});
