const connection = require("../config/db");
const notificationController = require("./notificationController");

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

function normalizeSkills(skills) {
    if (typeof skills !== "string") {
        return "";
    }

    return skills
        .split(",")
        .map((skill) => skill.trim())
        .filter(Boolean)
        .slice(0, 12)
        .join(", ");
}

async function requireFreelancer(req, res) {
    const rows = await query(
        "SELECT id, account_type FROM users WHERE id = ?",
        [req.user.id]
    );

    if (!rows.length) {
        res.status(404).json({
            message: "Usuário não encontrado"
        });
        return null;
    }

    if (rows[0].account_type !== "freelancer") {
        res.status(403).json({
            message: "Apenas contas freelancer podem acessar esta função"
        });
        return null;
    }

    return rows[0];
}

exports.listFreelancers = async (req, res) => {
    const search = String(req.query.search || "").trim();
    const searchLike = `%${search}%`;

    const sql = `
        SELECT
            u.id,
            u.name,
            fp.professional_title,
            fp.professional_email,
            fp.bio,
            fp.skills,
            fp.hourly_rate,
            fp.location,
            fp.portfolio_url
        FROM users u
        LEFT JOIN freelancer_profiles fp ON fp.user_id = u.id
        WHERE u.account_type = 'freelancer'
        AND (
            ? = ''
            OR u.name LIKE ?
            OR COALESCE(fp.professional_email, '') LIKE ?
            OR COALESCE(fp.professional_title, '') LIKE ?
            OR COALESCE(fp.skills, '') LIKE ?
            OR COALESCE(fp.location, '') LIKE ?
        )
        ORDER BY u.created_at DESC
        LIMIT 100
    `;

    try {
        const rows = await query(sql, [
            search,
            searchLike,
            searchLike,
            searchLike,
            searchLike,
            searchLike
        ]);

        const freelancers = rows.map((row) => ({
            id: row.id,
            name: row.name,
            email: row.professional_email || "",
            professionalTitle: row.professional_title || "",
            bio: row.bio || "",
            skills: row.skills || "",
            hourlyRate: row.hourly_rate !== null ? Number(row.hourly_rate) : null,
            location: row.location || "",
            portfolioUrl: row.portfolio_url || ""
        }));

        return res.json({
            message: "Freelancers carregados com sucesso",
            total: freelancers.length,
            freelancers
        });
    } catch (error) {
        return res.status(500).json({
            message: "Erro ao buscar freelancers",
            error: error.message
        });
    }
};

exports.getMyFreelancerProfile = async (req, res) => {
    try {
        const freelancerUser = await requireFreelancer(req, res);
        if (!freelancerUser) {
            return;
        }

        const sql = `
            SELECT professional_title, bio, skills, hourly_rate, location, portfolio_url, professional_email
            FROM freelancer_profiles
            WHERE user_id = ?
            LIMIT 1
        `;

        const rows = await query(sql, [freelancerUser.id]);
        const profile = rows[0] || {};

        return res.json({
            message: "Perfil freelancer carregado",
            profile: {
                professionalTitle: profile.professional_title || "",
                professionalEmail: profile.professional_email || "",
                bio: profile.bio || "",
                skills: profile.skills || "",
                hourlyRate: profile.hourly_rate !== null && profile.hourly_rate !== undefined
                    ? Number(profile.hourly_rate)
                    : "",
                location: profile.location || "",
                portfolioUrl: profile.portfolio_url || ""
            }
        });
    } catch (error) {
        return res.status(500).json({
            message: "Erro ao carregar perfil freelancer",
            error: error.message
        });
    }
};

exports.upsertMyFreelancerProfile = async (req, res) => {
    const {
        professionalTitle = "",
        professionalEmail = "",
        bio = "",
        skills = "",
        hourlyRate = "",
        location = "",
        portfolioUrl = ""
    } = req.body;

    try {
        const freelancerUser = await requireFreelancer(req, res);
        if (!freelancerUser) {
            return;
        }

        const cleanedTitle = String(professionalTitle).trim().slice(0, 120);
        const cleanedProfessionalEmail = String(professionalEmail).trim().slice(0, 255);
        const cleanedBio = String(bio).trim().slice(0, 4000);
        const cleanedSkills = normalizeSkills(skills);
        const cleanedLocation = String(location).trim().slice(0, 120);
        const cleanedPortfolioUrl = String(portfolioUrl).trim().slice(0, 255);

        let numericHourlyRate = null;
        if (hourlyRate !== "" && hourlyRate !== null && hourlyRate !== undefined) {
            const parsed = Number(hourlyRate);
            if (Number.isNaN(parsed) || parsed < 0) {
                return res.status(400).json({
                    message: "Valor de hora inválido"
                });
            }
            numericHourlyRate = parsed;
        }

        const sql = `
            INSERT INTO freelancer_profiles (
                user_id,
                professional_title,
                professional_email,
                bio,
                skills,
                hourly_rate,
                location,
                portfolio_url
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                professional_title = VALUES(professional_title),
                professional_email = VALUES(professional_email),
                bio = VALUES(bio),
                skills = VALUES(skills),
                hourly_rate = VALUES(hourly_rate),
                location = VALUES(location),
                portfolio_url = VALUES(portfolio_url)
        `;

        await query(sql, [
            freelancerUser.id,
            cleanedTitle,
            cleanedProfessionalEmail,
            cleanedBio,
            cleanedSkills,
            numericHourlyRate,
            cleanedLocation,
            cleanedPortfolioUrl
        ]);

        return res.json({
            message: "Perfil freelancer atualizado com sucesso"
        });
    } catch (error) {
        return res.status(500).json({
            message: "Erro ao atualizar perfil freelancer",
            error: error.message
        });
    }
};

exports.sendMessage = async (req, res) => {
    const { receiverId, message } = req.body;

    if (!receiverId || !message) {
        return res.status(400).json({
            message: "ID do destinatário e mensagem são obrigatórios"
        });
    }

    if (String(message).trim().length === 0) {
        return res.status(400).json({
            message: "Mensagem não pode estar vazia"
        });
    }

    try {
        // Verificar se o receiver existe e é freelancer
        const receiverRows = await query(
            "SELECT id, account_type, name FROM users WHERE id = ?",
            [receiverId]
        );

        if (!receiverRows.length) {
            return res.status(404).json({
                message: "Destinatário não encontrado"
            });
        }

        if (receiverRows[0].account_type !== "freelancer") {
            return res.status(400).json({
                message: "Apenas freelancers podem receber mensagens"
            });
        }

        // Verificar se o sender é cliente
        const senderRows = await query(
            "SELECT account_type, name FROM users WHERE id = ?",
            [req.user.id]
        );

        if (!senderRows.length || senderRows[0].account_type !== "client") {
            return res.status(403).json({
                message: "Apenas clientes podem enviar mensagens"
            });
        }

        const insertSql = `
            INSERT INTO messages (sender_id, receiver_id, message)
            VALUES (?, ?, ?)
        `;

        const result = await query(insertSql, [req.user.id, receiverId, String(message).trim()]);

        // Criar notificação para o freelancer
        const notificationController = require("./notificationController");
        await notificationController.createNotification(
            receiverId,
            "message",
            `Mensagem de ${senderRows[0].name}`,
            String(message).trim().substring(0, 100),
            result.insertId,
            req.user.id
        );

        return res.json({
            message: "Mensagem enviada com sucesso"
        });
    } catch (error) {
        return res.status(500).json({
            message: "Erro ao enviar mensagem",
            error: error.message
        });
    }
};

exports.getMessages = async (req, res) => {
    try {
        let sql, params;

        if (req.user.accountType === "freelancer") {
            // Freelancers veem mensagens recebidas
            sql = `
                SELECT
                    m.id,
                    m.message,
                    m.created_at,
                    m.sender_id,
                    m.receiver_id,
                    u.name AS sender_name,
                    u.email AS sender_email
                FROM messages m
                INNER JOIN users u ON m.sender_id = u.id
                WHERE m.receiver_id = ?
                ORDER BY m.created_at DESC
                LIMIT 100
            `;
            params = [req.user.id];
        } else {
            // Clientes veem mensagens enviadas
            sql = `
                SELECT
                    m.id,
                    m.message,
                    m.created_at,
                    m.sender_id,
                    m.receiver_id,
                    u.name AS receiver_name,
                    u.email AS receiver_email
                FROM messages m
                INNER JOIN users u ON m.receiver_id = u.id
                WHERE m.sender_id = ?
                ORDER BY m.created_at DESC
                LIMIT 100
            `;
            params = [req.user.id];
        }

        const rows = await query(sql, params);

        const messages = rows.map((row) => ({
            id: row.id,
            message: row.message,
            created_at: row.created_at,
            createdAt: row.created_at,
            sender_id: row.sender_id,
            receiver_id: row.receiver_id,
            ...(req.user.accountType === "freelancer"
                ? {
                    sender_name: row.sender_name,
                    sender_email: row.sender_email
                }
                : {
                    receiver_name: row.receiver_name,
                    receiver_email: row.receiver_email
                }
            )
        }));

        return res.json({
            message: "Mensagens carregadas",
            messages
        });
    } catch (error) {
        return res.status(500).json({
            message: "Erro ao carregar mensagens",
            error: error.message
        });
    }
};
