const connection = require("../config/db");

function query(sql, params = []) {
    return new Promise((resolve, reject) => {
        connection.query(sql, params, (err, rows) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(rows);
        });
    });
}

async function hasActiveSubscriptionForPrice(userId, priceId) {
    if (!priceId) {
        return false;
    }

    const rows = await query(
        `
        SELECT 1
        FROM billing_subscriptions
        WHERE user_id = ?
          AND price_id = ?
          AND status IN ('active', 'trialing')
          AND (current_period_end IS NULL OR current_period_end >= NOW())
        LIMIT 1
        `,
        [userId, priceId]
    );

    return rows.length > 0;
}

module.exports = {
    hasActiveSubscriptionForPrice
};

