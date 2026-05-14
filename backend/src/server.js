require("dotenv").config();
const cors = require("cors");
const express = require("express");
const app = express();
const authMiddleware = require("./middlewares/authMiddleware");
const authRoutes = require("./routes/authRoutes");
const marketplaceRoutes = require("./routes/marketplaceRoutes");
const connection = require("./config/db");

const corsOptions = {
    origin: "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cors(corsOptions));


app.get("/", (req, res) => {
    res.send("API rodando!");
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

app.listen(3000, () => {
    console.log("Servidor rodando na porta 3000");
});
