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

exports.deactivateAccount = async (req, res) => {
    const userId = req.user.id;
    const { days = 180 } = req.body; // Padrão 180 dias

    try {
        // Calcular data de reativação
        const reactivationDate = new Date();
        reactivationDate.setDate(reactivationDate.getDate() + days);

        const sql = `
            UPDATE users
            SET is_active = 0, deactivated_until = ?
            WHERE id = ?
        `;

        await query(sql, [reactivationDate, userId]);

        return res.json({
            message: `Conta desativada com sucesso. Será reativada em ${days} dias.`,
            reactivationDate: reactivationDate.toISOString()
        });
    } catch (error) {
        console.error("Erro ao desativar conta:", error);
        return res.status(500).json({
            message: "Erro interno do servidor"
        });
    }
};

exports.reactivateAccount = async (req, res) => {
    const userId = req.user.id;

    try {
        const sql = `
            UPDATE users
            SET is_active = 1, deactivated_until = NULL
            WHERE id = ? AND is_active = 0
        `;

        const result = await query(sql, [userId]);

        if (result.affectedRows === 0) {
            return res.status(400).json({
                message: "Conta já está ativa ou não foi encontrada"
            });
        }

        return res.json({
            message: "Conta reativada com sucesso"
        });
    } catch (error) {
        console.error("Erro ao reativar conta:", error);
        return res.status(500).json({
            message: "Erro interno do servidor"
        });
    }
};

exports.deleteAccount = async (req, res) => {
    const userId = req.user.id;

    try {
        // Verificar se é admin (admins não podem excluir conta própria)
        const userSql = "SELECT is_admin FROM users WHERE id = ?";
        const users = await query(userSql, [userId]);

        if (users.length === 0) {
            return res.status(404).json({
                message: "Usuário não encontrado"
            });
        }

        if (users[0].is_admin) {
            return res.status(400).json({
                message: "Administradores não podem excluir a própria conta"
            });
        }

        // Exclusão em cascata será feita pelas constraints FK
        const deleteSql = "DELETE FROM users WHERE id = ?";
        await query(deleteSql, [userId]);

        return res.json({
            message: "Conta excluída com sucesso"
        });
    } catch (error) {
        console.error("Erro ao excluir conta:", error);
        return res.status(500).json({
            message: "Erro interno do servidor"
        });
    }
};

exports.getAccountStatus = async (req, res) => {
    const userId = req.user.id;

    try {
        const sql = "SELECT is_active, deactivated_until FROM users WHERE id = ?";
        const users = await query(sql, [userId]);

        if (users.length === 0) {
            return res.status(404).json({
                message: "Usuário não encontrado"
            });
        }

        const user = users[0];

        return res.json({
            isActive: Boolean(user.is_active),
            deactivatedUntil: user.deactivated_until,
            canReactivate: user.deactivated_until && new Date(user.deactivated_until) <= new Date()
        });
    } catch (error) {
        console.error("Erro ao verificar status da conta:", error);
        return res.status(500).json({
            message: "Erro interno do servidor"
        });
    }
};

exports.updateProfile = async (req, res) => {
    const userId = req.user.id;
    const { name, email, professionalEmail, currentPassword, password, photo } = req.body;
    const bcrypt = require("bcrypt");

    if (!name || !email) {
        return res.status(400).json({
            message: "Nome e email são obrigatórios"
        });
    }

    try {
        // Se está tentando alterar email ou senha, validar senha atual
        const isChangingEmail = email !== req.user.email;
        const isChangingPassword = !!password;

        if ((isChangingEmail || isChangingPassword) && !currentPassword) {
            return res.status(400).json({
                message: "Senha atual é obrigatória para alterar email ou senha"
            });
        }

        // Se está tentando alterar email ou senha, validar senha atual
        if (isChangingEmail || isChangingPassword) {
            const userSql = "SELECT password FROM users WHERE id = ?";
            const users = await query(userSql, [userId]);

            if (users.length === 0) {
                return res.status(404).json({
                    message: "Usuário não encontrado"
                });
            }

            const isMatch = await bcrypt.compare(currentPassword, users[0].password);
            if (!isMatch) {
                return res.status(401).json({
                    message: "Senha atual incorreta"
                });
            }
        }

        // Preparar UPDATE
        let updateSql = "UPDATE users SET name = ?, email = ?";
        const params = [name, email];

        if (professionalEmail !== undefined) {
            updateSql += ", professional_email = ?";
            params.push(professionalEmail);
        }

        if (password) {
            const hashedPassword = await bcrypt.hash(password, 10);
            updateSql += ", password = ?";
            params.push(hashedPassword);
        }

        if (photo) {
            updateSql += ", profile_photo = ?";
            params.push(photo);
        }

        updateSql += " WHERE id = ?";
        params.push(userId);

        await query(updateSql, params);

        return res.json({
            message: "Perfil atualizado com sucesso",
            user: {
                id: userId,
                name,
                email,
                profilePhoto: photo || null
            }
        });
    } catch (error) {
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(400).json({
                message: "Email já está em uso"
            });
        }

        console.error("Erro ao atualizar perfil:", error);
        return res.status(500).json({
            message: "Erro interno do servidor"
        });
    }
};