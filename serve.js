const express = require("express");
const path = require("path");
const http = require("http");
const socketIo = require("socket.io");
const nodemailer = require("nodemailer");
const fs = require("fs");
const multer = require("multer");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// === Middleware ===
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use('/images', express.static(path.join(__dirname, 'images')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));

// === Default Route ===
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "login.html"));
});

// === Socket.io Real-time Chatroom Logic ===
io.on("connection", (socket) => {
  // Join subject room (subject is used as roomId)
  socket.on("newuser", ({ subject, username }) => {
    const roomId = subject.trim();
    socket.join(roomId);
    socket.roomId = roomId;
    socket.username = username || "User";
    console.log(`${socket.username} joined subject room: ${roomId}`);
    io.to(roomId).emit("update", `${socket.username} joined the chat`);
  });

  socket.on("chat", ({ username, text }) => {
    const roomId = socket.roomId;
    if (roomId) {
      io.to(roomId).emit("chat", { username: username || "User", text });
    }
  });

  socket.on("exituser", () => {
    const roomId = socket.roomId;
    if (roomId) {
      socket.leave(roomId);
      io.to(roomId).emit("update", `${socket.username || "User"} left the chat`);
    }
  });
});

// === Email Contact Form API ===
app.post("/send-email", async (req, res) => {
  const { name, email, message } = req.body;
  if (!name || !email || !message) return res.status(400).send("Missing fields");

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER || "your_email@gmail.com",
      pass: process.env.EMAIL_PASS || "your_app_password"
    }
  });

  const mailOptions = {
    from: email,
    to: "prikpra@gmail.com",
    subject: `New message from ${name}`,
    text: `Email: ${email}\n\nMessage:\n${message}`
  };

  try {
    await transporter.sendMail(mailOptions);
    res.status(200).send("Email sent successfully!");
  } catch (error) {
    console.error(error);
    res.status(500).send("Failed to send email");
  }
});

// === Feedback API ===
app.post("/submit-feedback", (req, res) => {
  const { username, rating, suggestion } = req.body;
  if (!username || !rating || !suggestion) return res.status(400).send("Missing fields");

  const now = new Date();
  const date = now.toISOString().split("T")[0];
  const time = now.toTimeString().split(" ")[0];

  const feedbackDir = path.join(__dirname, "feedback");
  if (!fs.existsSync(feedbackDir)) fs.mkdirSync(feedbackDir);

  const filePath = path.join(feedbackDir, `${date}.csv`);
  const row = `"${username}","${rating}","${suggestion.replace(/"/g, '""')}","${date}","${time}"\n`;

  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, `"Username","Rating","Suggestion","Date","Time"\n`);
  }

  fs.appendFile(filePath, row, (err) => {
    if (err) return res.status(500).send("Failed to save feedback");
    res.status(200).send("Feedback saved");
  });
});

// === Timetable Upload API ===
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, "uploads");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const username = req.body.username;
    cb(null, `${username}.jpg`);
  }
});

const upload = multer({ storage });

app.post("/upload-timetable", upload.single("timetable"), (req, res) => {
  const username = req.body.username;
  if (!username) return res.status(400).send("Username missing");

  res.json({
    success: true,
    imageUrl: `/uploads/${username}.jpg`
  });
});

// === Start Server ===
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
