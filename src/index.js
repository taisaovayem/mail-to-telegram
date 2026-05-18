import "dotenv/config";
import fs from "fs/promises";
import path from "path";
import express from "express";
import axios from "axios";
import { SMTPServer } from "smtp-server";
import { simpleParser } from "mailparser";

const SMTP_PORT = Number(process.env.SMTP_PORT || 25);
const WEB_PORT = Number(process.env.WEB_PORT || 3000);

const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL;
const ALLOWED_RECIPIENTS = (process.env.ALLOWED_RECIPIENTS || "")
  .split(",")
  .map(v => v.trim().toLowerCase())
  .filter(Boolean);
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

const DATA_DIR = path.resolve("data");
const EMAIL_DIR = path.join(DATA_DIR, "emails");

await fs.mkdir(EMAIL_DIR, { recursive: true });

function safeHtml(mail) {
  if (mail.html) return mail.html;

  const text = mail.text || "(Email không có nội dung)";
  return `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Email</title>
</head>
<body>
  <pre>${escapeHtml(text)}</pre>
</body>
</html>`;
}

function isRecipientAllowed(email) {
  const value = email.toLowerCase();

  if (ALLOWED_RECIPIENTS.length === 0) {
    return true;
  }

  return ALLOWED_RECIPIENTS.some(rule => {
    if (rule.startsWith("@")) {
      return value.endsWith(rule);
    }

    return value === rule;
  });
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function sendTelegram(message) {
  await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    chat_id: CHAT_ID,
    text: message,
    disable_web_page_preview: true
  });
}

const app = express();

app.use("/emails", express.static(EMAIL_DIR));

app.get("/", (req, res) => {
  res.send("Mail to Telegram is running");
});

app.listen(WEB_PORT, () => {
  console.log(`Web server listening on port ${WEB_PORT}`);
});

const smtpServer = new SMTPServer({
  disabledCommands: ["AUTH"],

  onRcptTo(address, session, callback) {
  const recipient = address.address.toLowerCase();

  if (!isRecipientAllowed(recipient)) {
    console.log("Rejected recipient:", recipient);

    return callback(
      new Error(`Recipient ${recipient} is not allowed`)
    );
  }

  callback();
},

  async onData(stream, session, callback) {
    try {
      const mail = await simpleParser(stream);

      const timestamp = Date.now();
      const random = Math.random().toString(36).slice(2, 8);
      const filename = `${timestamp}-${random}.html`;

      const htmlPath = path.join(EMAIL_DIR, filename);

      const html = safeHtml(mail);
      await fs.writeFile(htmlPath, html, "utf8");

      const link = `${PUBLIC_BASE_URL}/emails/${filename}`;

      const from = mail.from?.text || "Không rõ";
      const to = mail.to?.text || "Không rõ";
      const subject = mail.subject || "(Không có tiêu đề)";

      await sendTelegram(
        `📩 Có email mới\n\n` +
        `From: ${from}\n` +
        `To: ${to}\n` +
        `Subject: ${subject}\n\n` +
        `Xem nội dung:\n${link}`
      );

      console.log("Saved email:", filename);
      callback();
    } catch (err) {
      console.error(err);
      callback(err);
    }
  }
});

smtpServer.listen(SMTP_PORT, "0.0.0.0", () => {
  console.log(`SMTP server listening on port ${SMTP_PORT}`);
});