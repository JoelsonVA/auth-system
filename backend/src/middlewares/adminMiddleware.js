const connection = require("../config/db");

function adminMiddleware(req, res, next) {
    const userId = req.user?.id;

    if (!userId) {
        return res.status(401).json({
            message: "Usuário não autenticado"
        });
    }

    const sql = "SELECT id, is_admin FROM users WHERE id = ?";

    connection.query(sql, [userId], (err, results) => {
        if (err) {
            return res.status(500).json({
                message: "Erro ao validar status de admin",
                error: err.message
            });
        }

        if (results.length === 0) {
            return res.status(404).json({
                message: "Usuário não encontrado"
            });
        }

        const isAdmin = Boolean(results[0].is_admin);

        if (!isAdmin) {
            return res.status(403).json({
                message: "Acesso restrito a administradores"
            });
        }

        req.user.isAdmin = true;
        next();
    });
}

module.exports = adminMiddleware;
