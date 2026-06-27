let logoutTimer;

window.addBullet = function () {

    const textarea = document.getElementById("answer");

    if (!textarea) return;

    const start = textarea.selectionStart;

    textarea.value =
        textarea.value.substring(0, start) +
        "• " +
        textarea.value.substring(start);
};

window.wrapText = function(startTag, endTag) {

    const textarea = document.getElementById("answer");

    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    const selected = textarea.value.substring(start, end);

    textarea.value =
        textarea.value.substring(0, start) +
        startTag + selected + endTag +
        textarea.value.substring(end);
};

window.toggleChat = function () {
    const box = document.getElementById("chat-box");
    box.classList.toggle("open");

    if (box.classList.contains("open")) {
        botHello();
    }
};

window.addEventListener("beforeunload", function () {
    localStorage.removeItem("auth");
});

window.addEventListener("pagehide", function () {
    localStorage.removeItem("auth");
});

function resetLogoutTimer() {

    clearTimeout(logoutTimer);

    logoutTimer = setTimeout(() => {

        localStorage.removeItem("auth");

        alert("Sessão expirada por inatividade");

        window.location.href = "login.html";

    }, 5 * 60 * 1000); // 5 minutos
}

async function sendMessage() {

    const input = document.getElementById("chat-input");
    const chat = document.getElementById("chat-messages");

    const message = input.value.trim();
    if (!message) return;

    console.log("ENVIAR:", message);

    // mensagem user
    const userDiv = document.createElement("div");
    userDiv.className = "msg-user";
    userDiv.innerHTML = `
    ${message}
    <div class="msg-time">${getTime()}</div>
`;

const meta = document.createElement("div");
meta.className = "msg-meta";

meta.innerHTML = `
    <span class="msg-time">${getTime()}</span>
    <span class="msg-check">✔✔</span>
`;

userDiv.appendChild(meta);
    chat.appendChild(userDiv);

    input.value = "";

    // typing bubble
    const typingBubble = document.createElement("div");
    typingBubble.className = "typing-bubble";
    typingBubble.innerHTML = `
        a escrever
        <span class="dot"></span>
        <span class="dot"></span>
        <span class="dot"></span>
    `;

    chat.appendChild(typingBubble);
    chat.scrollTop = chat.scrollHeight;

    document.getElementById("chat-status").innerText = "⏳ a escrever...";
    document.getElementById("chat-status").classList.add("status-typing");
     
    try {

        await new Promise(resolve => setTimeout(resolve, 1200));

        const res = await fetch("https://chatbotiisctem.onrender.com/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message })
        });

        const data = await res.json();

        typingBubble.remove();

        const botDiv = document.createElement("div");
        botDiv.className = "msg-bot";
        botDiv.innerHTML = `
    ${data.response}
    <div class="msg-time">${getTime()}</div>
`;

        chat.appendChild(botDiv);
        chat.scrollTop = chat.scrollHeight;

    } catch (err) {
        console.log("ERRO CHAT:", err);
    }

    document.getElementById("chat-status").innerText = "🟢 online";
    document.getElementById("chat-status").classList.remove("status-typing");
}

function botHello() {
    const chat = document.getElementById("chat-messages");

    // evita repetir sempre que abre
    if (chat.children.length > 0) return;

    const hello = document.createElement("div");
    hello.className = "msg-bot";
    hello.innerText = "Olá 👋 Sou o assistente do ISCTEM. Como posso ajudar?";

    chat.appendChild(hello);
}

function getTime() {
    const now = new Date();
    return now.getHours().toString().padStart(2, "0") + ":" +
           now.getMinutes().toString().padStart(2, "0");
}

// AQUI VAI A FUNÇÃO createFaq
async function createFaq(question, id) {

    await fetch("https://chatbotiisctem.onrender.com/add-faq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            question,
            answer: "resposta manual"
        })
    });

    document.getElementById(`btn-${id}`).style.display = "none";
}

//para botoes na area de editar faq
function wrapText(startTag, endTag) {

    const textarea = document.getElementById("answer");

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    const selectedText = textarea.value.substring(start, end);

    const newText =
        textarea.value.substring(0, start) +
        startTag + selectedText + endTag +
        textarea.value.substring(end);

    textarea.value = newText;
}

window.onload = resetLogoutTimer;
document.onmousemove = resetLogoutTimer;
document.onkeydown = resetLogoutTimer;
document.onclick = resetLogoutTimer;
document.onscroll = resetLogoutTimer;