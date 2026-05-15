const jwt = require("jsonwebtoken");
const connection = require("../config/db");

const SECRET = process.env.JWT_SECRET;
if (!SECRET) {
    throw new Error("JWT_SECRET environment variable is required");
}

function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
            message: "Token não fornecido ou formato inválido"
        });
    }

    const token = authHeader.split(" ")[1];

    try {
        const decoded = jwt.verify(token, SECRET);

        const sql = "SELECT id, email, is_admin, account_type, is_active, deactivated_until FROM users WHERE id = ?";
        connection.query(sql, [decoded.id], (err, results) => {
            if (err) {
                console.error("Erro ao verificar usuário autenticado:", err);
                return res.status(500).json({
                    message: "Erro interno ao validar autenticação"
                });
            }

            if (results.length === 0) {
                return res.status(404).json({
                    message: "Usuário não encontrado"
                });
            }

            const user = results[0];
            const isActive = Boolean(user.is_active);
            const deactivatedUntil = user.deactivated_until;
            const now = new Date();

            if (!isActive && deactivatedUntil) {
                const reactivationDate = new Date(deactivatedUntil);
                if (now < reactivationDate) {
                    return res.status(403).json({
                        message: `Conta desativada temporariamente. Será reativada em ${reactivationDate.toLocaleDateString('pt-BR')}`
                    });
                }

                reactivateAccount(user.id);
            }

            req.user = {
                id: user.id,
                email: user.email || decoded.email,
                isAdmin: Boolean(user.is_admin),
                accountType: user.account_type,
                isActive: isActive
            };
            next();
        });
    } catch (error) {
        return res.status(401).json({
            message: "Token inválido"
        });
    }
}

function reactivateAccount(userId) {
    const sql = "UPDATE users SET is_active = 1, deactivated_until = NULL WHERE id = ?";
    connection.query(sql, [userId], (err) => {
        if (err) {
            console.error("Erro ao reativar conta automaticamente:", err);
        }
    });
}

module.exports = authMiddleware;
