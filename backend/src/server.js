require("dotenv").config();
const cors = require("cors");
const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");
const app = express();
const authMiddleware = require("./middlewares/authMiddleware");
const authRoutes = require("./routes/authRoutes");
const marketplaceRoutes = require("./routes/marketplaceRoutes");
const billingRoutes = require("./routes/billingRoutes");
const billingController = require("./controllers/billingController");
const connection = require("./config/db");

const PORT = Number(process.env.PORT) || 3000;

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
const FRONTEND_URLS = (process.env.FRONTEND_URLS || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
const allowedOrigins = new Set([FRONTEND_URL, ...FRONTEND_URLS]);

const corsOptions = {
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.has(origin)) {
            callback(null, true);
            return;
        }
        callback(new Error("CORS policy: origin not allowed"));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
};

app.set("trust proxy", 1);
app.use(helmet());
app.use(
    rateLimit({
        windowMs: 15 * 60 * 1000,
        limit: 300,
        standardHeaders: "draft-7",
        legacyHeaders: false
    })
);

// Stripe webhook precisa do corpo bruto para validação da assinatura.
app.post(
    "/billing/webhook",
    express.raw({ type: "application/json" }),
    billingController.webhook
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cors(corsOptions));

app.get("/health", (req, res) => {
    res.json({ ok: true });
});

// Servir o frontend estático junto com a API (1 domínio).
const WEB_ROOT = path.resolve(__dirname, "..", "..");

app.use("/styles", express.static(path.join(WEB_ROOT, "styles")));
app.use("/scripts", express.static(path.join(WEB_ROOT, "scripts")));
app.use("/favicon.ico", express.static(path.join(WEB_ROOT, "favicon.ico")));
app.use("/img.jpg", express.static(path.join(WEB_ROOT, "img.jpg")));
app.use("/Demo.png", express.static(path.join(WEB_ROOT, "Demo.png")));

app.get("/", (req, res) => {
    res.sendFile(path.join(WEB_ROOT, "index.html"));
});

app.get("/app", (req, res) => {
    res.sendFile(path.join(WEB_ROOT, "app.html"));
});

app.get("/profile", (req, res) => {
    res.sendFile(path.join(WEB_ROOT, "profile.html"));
});

app.get("/login-freelancer", (req, res) => {
    res.sendFile(path.join(WEB_ROOT, "login-freelancer.html"));
});



app.get("/dashboard", authMiddleware,(req, res)=>{

  const sql = "SELECT id, name, email, professional_email, is_admin, account_type, profile_photo FROM users WHERE id = ?";

  connection.query(sql, [req.user.id], (err, results) => {
    if (err) {
      return res.status(500).json({
        message: "Erro ao carregar sessão",
        error: err.message
      });
    }

    if (results.length === 0) {
      return res.status(404).json({
        message: "Usuário não encontrado"
      });
    }

    const user = results[0];

    return res.json({
      message: "Bem vindos ao dashboard",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        professionalEmail: user.professional_email || null,
        isAdmin: Boolean(user.is_admin),
        accountType: user.account_type,
        profilePhoto: user.profile_photo || null
      }
    });
  });

});

app.use("/auth", authRoutes);
app.use("/marketplace", marketplaceRoutes);
app.use("/billing", billingRoutes);

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
