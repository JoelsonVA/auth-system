const connection = require("../config/db");

function premiumMiddleware(req, res, next) {
    const userId = req.user?.id;

    if (!userId) {
        return res.status(401).json({ message: "Usuário não autenticado" });
    }

    const accountType = req.user?.accountType;
    const priceId =
        accountType === "freelancer"
            ? process.env.STRIPE_PRICE_ID_FREELANCER
            : accountType === "client"
                ? process.env.STRIPE_PRICE_ID_CLIENT
                : null;

    if (!priceId) {
        return res.status(500).json({
            message: "Premium não configurado para este tipo de conta"
        });
    }

    const sql = `
        SELECT status, current_period_end
        FROM billing_subscriptions
        WHERE user_id = ?
          AND price_id = ?
          AND status IN ('active', 'trialing')
          AND (current_period_end IS NULL OR current_period_end >= NOW())
        ORDER BY updated_at DESC
        LIMIT 1
    `;

    connection.query(sql, [userId, priceId], (err, results) => {
        if (err) {
            console.error("Erro ao validar assinatura premium:", err);
            return res.status(500).json({
                message: "Erro ao validar assinatura premium"
            });
        }

        const row = results[0];
        const isPremium = Boolean(row);

        req.user.isPremium = isPremium;

        if (!isPremium) {
            return res.status(402).json({
                message: "Recurso disponível apenas para usuários Premium",
                code: "PREMIUM_REQUIRED"
            });
        }

        return next();
    });
}

module.exports = premiumMiddleware;
