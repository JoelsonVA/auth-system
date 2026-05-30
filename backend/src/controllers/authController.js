const { z } = require("zod");
const connection = require("../config/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const SECRET = process.env.JWT_SECRET;
if (!SECRET) {
    throw new Error("JWT_SECRET environment variable is required");
}
const ACCOUNT_TYPES = ["client", "freelancer"];

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function parseBoolean(value) {
    if (value === true || value === false) {
        return value;
    }

    if (value === 1 || value === 0) {
        return value === 1;
    }

    if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        if (normalized === "true" || normalized === "1") {
            return true;
        }
        if (normalized === "false" || normalized === "0") {
            return false;
        }
    }

    return null;
}

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

function normalizeAccountType(value) {
    if (typeof value !== "string") {
        return null;
    }

    const normalized = value.trim().toLowerCase();

    if (!ACCOUNT_TYPES.includes(normalized)) {
        return null;
    }

    return normalized;
}

// ================= SCHEMAS =================

const registerSchema = z.object({
    name: z.string().min(1, "Nome é obrigatório").max(150),
    email: z.string().email("Email inválido"),
    password: z.string().min(8, "Senha deve ter pelo menos 8 caracteres"),
    accountType: z.enum(["client", "freelancer"], { message: "Tipo de conta inválido" })
});

const loginSchema = z.object({
    email: z.string().email("Email inválido"),
    password: z.string().min(8, "Senha deve ter pelo menos 8 caracteres"),
    accountType: z.enum(["client", "freelancer"], { message: "Tipo de conta inválido" })
});

// ================= REGISTER =================

exports.register = async (req, res) => {
    let validated;
    try {
        validated = registerSchema.parse(req.body);
    } catch (error) {
        return res.status(400).json({
            message: error.errors[0]?.message ?? "Dados inválidos"
        });
    }

    const { name, email, password, accountType } = validated;
    const normalizedAccountType = normalizeAccountType(accountType);

    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        const adminCountRows = await query(
            "SELECT COUNT(*) AS total_admins FROM users WHERE is_admin = 1"
        );

        const shouldBeAdmin = Number(adminCountRows[0].total_admins) === 0 ? 1 : 0;

        const insertSql = `
            INSERT INTO users (name, email, password, is_admin, account_type)
            VALUES (?, ?, ?, ?, ?)
        `;

        const result = await query(insertSql, [
            name,
            email,
            hashedPassword,
            shouldBeAdmin,
            normalizedAccountType
        ]);

        return res.json({
            message: shouldBeAdmin
                ? "Usuário criado com sucesso e definido como primeiro administrador!"
                : "Usuário criado com sucesso!",
            user: {
                id: result.insertId,
                name,
                email,
                isAdmin: Boolean(shouldBeAdmin),
                accountType: normalizedAccountType,
                profilePhoto: null
            }
        });
    } catch (error) {
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(400).json({
                message: "Email já cadastrado"
            });
        }

        return res.status(500).json({
            message: "Erro no servidor",
            error: error.message
        });
    }
};

// ================= LOGIN =================

exports.login = async (req, res) => {
    let validated;
    try {
        validated = loginSchema.parse(req.body);
    } catch (error) {
        return res.status(400).json({
            message: error.errors[0]?.message ?? "Dados inválidos"
        });
    }

    const { email, password, accountType } = validated;
    const normalizedAccountType = normalizeAccountType(accountType);

    try {
        const sql = `
            SELECT id, name, email, password, is_admin, account_type, profile_photo
            FROM users
            WHERE email = ?
        `;

        const results = await query(sql, [email]);

        if (results.length === 0) {
            return res.status(404).json({
                message: "Usuário não encontrado"
            });
        }

        const user = results[0];
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(401).json({
                message: "Senha incorreta"
            });
        }

        // Admins podem fazer login independentemente do tipo de conta selecionado
        if (!user.is_admin && user.account_type !== normalizedAccountType) {
            return res.status(403).json({
                message: "Tipo de conta incompatível com este login"
            });
        }

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

        const loginEventSql = `
            INSERT INTO login_events (user_id, name, email, status)
            VALUES (?, ?, ?, 'success')
        `;

        await query(loginEventSql, [user.id, user.name, user.email]);

        return res.json({
            message: "Login OK",
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                isAdmin: Boolean(user.is_admin),
                accountType: user.account_type,
                profilePhoto: user.profile_photo || null
            }
        });
    } catch (error) {
        return res.status(500).json({
            message: "Erro no servidor",
            error: error.message
        });
    }
};

// ================= ADMIN OVERVIEW =================

exports.getAdminSessionOverview = async (req, res) => {
    const summarySql = `
        SELECT
            COUNT(*) AS total_entries,
            COUNT(DISTINCT user_id) AS unique_users
        FROM login_events
        WHERE status = 'success'
    `;

    const usersSql = `
        SELECT
            u.id,
            u.name,
            u.email,
            u.is_admin,
            u.account_type,
            COUNT(le.id) AS total_entries,
            MAX(le.created_at) AS last_entry_at
        FROM users u
        INNER JOIN login_events le ON le.user_id = u.id
        WHERE le.status = 'success'
        GROUP BY u.id, u.name, u.email, u.is_admin, u.account_type
        ORDER BY last_entry_at DESC
    `;

    try {
        const summaryRows = await query(summarySql);
        const usersRows = await query(usersSql);

        const summary = summaryRows[0] || { total_entries: 0, unique_users: 0 };
        const users = usersRows.map((row) => ({
            id: row.id,
            name: row.name,
            email: row.email,
            isAdmin: Boolean(row.is_admin),
            accountType: row.account_type,
            totalEntries: Number(row.total_entries) || 0,
            lastEntryAt: row.last_entry_at
        }));

        return res.json({
            message: "Painel administrativo carregado",
            summary: {
                totalEntries: Number(summary.total_entries) || 0,
                uniqueUsers: Number(summary.unique_users) || 0
            },
            users
        });
    } catch (error) {
        return res.status(500).json({
            message: "Erro ao carregar resumo administrativo",
            error: error.message
        });
    }
};

// ================= ADMIN STATUS =================

exports.updateAdminStatus = async (req, res) => {
    const { email, isAdmin } = req.body;

    if (!email) {
        return res.status(400).json({
            message: "Informe o email do usuário"
        });
    }

    if (!isValidEmail(email)) {
        return res.status(400).json({
            message: "Email inválido"
        });
    }

    const parsedStatus = parseBoolean(isAdmin);

    if (parsedStatus === null) {
        return res.status(400).json({
            message: "O campo isAdmin deve ser true ou false"
        });
    }

    try {
        const findRows = await query(
            "SELECT id, is_admin FROM users WHERE email = ?",
            [email]
        );

        if (findRows.length === 0) {
            return res.status(404).json({
                message: "Usuário não encontrado para atualização"
            });
        }

        const targetUser = findRows[0];
        const isRemovingAdmin = targetUser.is_admin === 1 && parsedStatus === false;

        if (isRemovingAdmin) {
            const countRows = await query(
                "SELECT COUNT(*) AS total_admins FROM users WHERE is_admin = 1"
            );

            const totalAdmins = Number(countRows[0].total_admins) || 0;

            if (totalAdmins <= 1) {
                return res.status(400).json({
                    message: "Não é possível remover o último administrador do sistema"
                });
            }
        }

        await query(
            "UPDATE users SET is_admin = ? WHERE id = ?",
            [parsedStatus ? 1 : 0, targetUser.id]
        );

        return res.json({
            message: parsedStatus
                ? "Status de administrador concedido com sucesso"
                : "Status de administrador removido com sucesso"
        });
    } catch (error) {
        return res.status(500).json({
            message: "Erro ao atualizar status administrativo",
            error: error.message
        });
    }
};
