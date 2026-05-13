const connection = require("../config/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const SECRET = "change_this_secret";

// ================= REGISTER =================

exports.register = async (req, res) => {

    const { name, email, password } = req.body;

    try {

        const hashedPassword = await bcrypt.hash(password, 10);

        const sql = `
            INSERT INTO users (name, email, password)
            VALUES (?, ?, ?)
        `;

        connection.query(
            sql,
            [name, email, hashedPassword],
            (err, result) => {

                if (err) {

                    console.log("ERRO MYSQL:", err);

                    if (err.code === "ER_DUP_ENTRY") {

                        return res.status(400).json({
                            message: "Email já cadastrado"
                        });

                    }

                    return res.status(500).json({
                        error: err
                    });

                }

                return res.json({
                    message: "Usuário criado com sucesso!"
                });

            }
        );

    } catch (error) {

        console.log(error);

        return res.status(500).json({
            message: "Erro no servidor",
            error: error.message
        });

    }

};

// ================= LOGIN =================

exports.login = async (req, res) => {

    const { email, password } = req.body;

    try {

        const sql = "SELECT * FROM users WHERE email = ?";

        connection.query(sql, [email], async (err, results) => {

            if (err) {

                return res.status(500).json({
                    error: err
                });

            }

            if (results.length === 0) {

                return res.status(404).json({
                    message: "Usuário não encontrado"
                });

            }

            const user = results[0];

            const isMatch = await bcrypt.compare(
                password,
                user.password
            );

            if (!isMatch) {

                return res.status(401).json({
                    message: "Senha incorreta"
                });

            }

            // 🔐 JWT
            const token = jwt.sign(
                {
                    id: user.id,
                    email: user.email
                },
                SECRET,
                {
                    expiresIn: "1h"
                }
            );

            return res.json({
                message: "Login OK",
                token
            });

        });

    } catch (error) {

        console.log(error);

        return res.status(500).json({
            message: "Erro no servidor",
            error: error.message
        });

    }

};