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

exports.getNotifications = async (req, res) => {
    const userId = req.user.id;
    const { limit = 20, offset = 0 } = req.query;

    try {
        const sql = `
            SELECT id, type, title, content, related_id, related_user_id, is_read, created_at
            FROM notifications
            WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
        `;

        const notifications = await query(sql, [userId, parseInt(limit), parseInt(offset)]);

        // Contar não lidas
        const countSql = "SELECT COUNT(*) as unread FROM notifications WHERE user_id = ? AND is_read = 0";
        const countResult = await query(countSql, [userId]);

        return res.json({
            notifications,
            unread: countResult[0]?.unread || 0,
            total: notifications.length
        });
    } catch (error) {
        console.error("Erro ao buscar notificações:", error);
        return res.status(500).json({
            message: "Erro ao buscar notificações"
        });
    }
};

exports.markAsRead = async (req, res) => {
    const userId = req.user.id;
    const { notificationId } = req.params;

    try {
        const sql = "UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?";
        const result = await query(sql, [notificationId, userId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                message: "Notificação não encontrada"
            });
        }

        return res.json({
            message: "Notificação marcada como lida"
        });
    } catch (error) {
        console.error("Erro ao marcar notificação como lida:", error);
        return res.status(500).json({
            message: "Erro ao marcar notificação como lida"
        });
    }
};

exports.markAllAsRead = async (req, res) => {
    const userId = req.user.id;

    try {
        const sql = "UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0";
        await query(sql, [userId]);

        return res.json({
            message: "Todas as notificações foram marcadas como lidas"
        });
    } catch (error) {
        console.error("Erro ao marcar todas as notificações como lidas:", error);
        return res.status(500).json({
            message: "Erro ao marcar notificações como lidas"
        });
    }
};

exports.deleteNotification = async (req, res) => {
    const userId = req.user.id;
    const { notificationId } = req.params;

    try {
        const sql = "DELETE FROM notifications WHERE id = ? AND user_id = ?";
        const result = await query(sql, [notificationId, userId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                message: "Notificação não encontrada"
            });
        }

        return res.json({
            message: "Notificação deletada"
        });
    } catch (error) {
        console.error("Erro ao deletar notificação:", error);
        return res.status(500).json({
            message: "Erro ao deletar notificação"
        });
    }
};

// Função auxiliar para criar notificação (usada por outros controllers)
exports.createNotification = async (userId, type, title, content, relatedId = null, relatedUserId = null) => {
    try {
        const sql = `
            INSERT INTO notifications (user_id, type, title, content, related_id, related_user_id)
            VALUES (?, ?, ?, ?, ?, ?)
        `;
        await query(sql, [userId, type, title, content, relatedId, relatedUserId]);
    } catch (error) {
        console.error("Erro ao criar notificação:", error);
    }
};

// Função para notificar todos os usuários (para trabalhos novos)
exports.notifyAllUsers = async (type, title, content, relatedId = null) => {
    try {
        const usersSql = "SELECT id FROM users WHERE account_type = 'freelancer'";
        const users = await query(usersSql, []);

        for (const user of users) {
            await exports.createNotification(
                user.id,
                type,
                title,
                content,
                relatedId,
                null
            );
        }
    } catch (error) {
        console.error("Erro ao notificar todos os usuários:", error);
    }
};

exports.getUnreadCount = async (req, res) => {
    const userId = req.user.id;

    try {
        const sql = `
            SELECT COUNT(*) as count
            FROM notifications
            WHERE user_id = ? AND is_read = FALSE
        `;

        const result = await query(sql, [userId]);

        return res.json({
            count: Number(result[0].count) || 0
        });
    } catch (error) {
        console.error("Erro ao contar notificações não lidas:", error);
        return res.status(500).json({
            message: "Erro interno do servidor"
        });
    }
};
