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

exports.createJob = async (req, res) => {
    const { title, description, budget, skillsRequired, deadline } = req.body;
    const clientId = req.user.id;

    if (!title || !description) {
        return res.status(400).json({
            message: "Título e descrição são obrigatórios"
        });
    }

    try {
        // Obter nome do cliente
        const clientRows = await query("SELECT name FROM users WHERE id = ?", [clientId]);
        const clientName = clientRows[0]?.name || "Cliente";

        const sql = `
            INSERT INTO jobs (client_id, title, description, budget, skills_required, deadline)
            VALUES (?, ?, ?, ?, ?, ?)
        `;

        const result = await query(sql, [clientId, title, description, budget, skillsRequired, deadline]);

        // Notificar todos os freelancers sobre novo trabalho
        const notificationController = require("./notificationController");
        await notificationController.notifyAllUsers(
            "job",
            `Novo trabalho: ${title}",
            `${clientName} publicou um novo trabalho: ${description.substring(0, 100)}...`,
            result.insertId
        );

        return res.json({
            message: "Trabalho criado com sucesso",
            jobId: result.insertId
        });
    } catch (error) {
        console.error("Erro ao criar trabalho:", error);
        return res.status(500).json({
            message: "Erro interno do servidor"
        });
    }
};

exports.getJobs = async (req, res) => {
    const userId = req.user.id;
    const userType = req.user.accountType;
    const { status = 'open' } = req.query;

    try {
        let sql;
        let params;

        if (userType === 'client') {
            // Clientes veem apenas seus próprios trabalhos
            sql = `
                SELECT j.*, u.name as client_name, u.email as client_email,
                       COUNT(ja.id) as applications_count
                FROM jobs j
                LEFT JOIN users u ON j.client_id = u.id
                LEFT JOIN job_applications ja ON j.id = ja.job_id
                WHERE j.client_id = ? AND j.status = ?
                GROUP BY j.id
                ORDER BY j.created_at DESC
            `;
            params = [userId, status];
        } else {
            // Freelancers veem trabalhos disponíveis
            sql = `
                SELECT j.*, u.name as client_name, u.email as client_email,
                       COUNT(ja.id) as applications_count,
                       CASE WHEN ja2.id IS NOT NULL THEN 1 ELSE 0 END as has_applied
                FROM jobs j
                LEFT JOIN users u ON j.client_id = u.id
                LEFT JOIN job_applications ja ON j.id = ja.job_id
                LEFT JOIN job_applications ja2 ON j.id = ja2.job_id AND ja2.freelancer_id = ?
                WHERE j.status = ?
                GROUP BY j.id
                ORDER BY j.created_at DESC
            `;
            params = [userId, status];
        }

        const jobs = await query(sql, params);

        return res.json({
            message: "Trabalhos carregados com sucesso",
            jobs: jobs
        });
    } catch (error) {
        console.error("Erro ao carregar trabalhos:", error);
        return res.status(500).json({
            message: "Erro interno do servidor"
        });
    }
};

exports.applyToJob = async (req, res) => {
    const { jobId, message } = req.body;
    const freelancerId = req.user.id;

    if (!jobId) {
        return res.status(400).json({
            message: "ID do trabalho é obrigatório"
        });
    }

    try {
        // Verificar se o trabalho existe e está aberto
        const jobSql = "SELECT id, client_id, status, title FROM jobs WHERE id = ? AND status = 'open'";
        const jobs = await query(jobSql, [jobId]);

        if (jobs.length === 0) {
            return res.status(404).json({
                message: "Trabalho não encontrado ou não está aberto"
            });
        }

        const job = jobs[0];

        // Verificar se já aplicou
        const existingApplicationSql = "SELECT id FROM job_applications WHERE job_id = ? AND freelancer_id = ?";
        const existingApplications = await query(existingApplicationSql, [jobId, freelancerId]);

        if (existingApplications.length > 0) {
            return res.status(400).json({
                message: "Você já aplicou para este trabalho"
            });
        }

        // Obter nome do freelancer
        const freelancerRows = await query("SELECT name FROM users WHERE id = ?", [freelancerId]);
        const freelancerName = freelancerRows[0]?.name || "Freelancer";

        // Criar aplicação
        const applicationSql = `
            INSERT INTO job_applications (job_id, freelancer_id, message)
            VALUES (?, ?, ?)
        `;

        const result = await query(applicationSql, [jobId, freelancerId, message]);

        // Notificar cliente sobre nova proposta
        const notificationController = require("./notificationController");
        await notificationController.createNotification(
            job.client_id,
            "proposal",
            `Nova proposta para: ${job.title}`,
            `${freelancerName} enviou uma proposta para seu trabalho`,
            result.insertId,
            freelancerId
        );

        return res.json({
            message: "Aplicação enviada com sucesso"
        });
    } catch (error) {
        console.error("Erro ao aplicar para trabalho:", error);
        return res.status(500).json({
            message: "Erro interno do servidor"
        });
    }
};

exports.getJobApplications = async (req, res) => {
    const { jobId } = req.params;
    const clientId = req.user.id;

    if (!jobId) {
        return res.status(400).json({
            message: "ID do trabalho é obrigatório"
        });
    }

    try {
        // Verificar se o trabalho pertence ao cliente
        const jobSql = "SELECT id FROM jobs WHERE id = ? AND client_id = ?";
        const jobs = await query(jobSql, [jobId, clientId]);

        if (jobs.length === 0) {
            return res.status(404).json({
                message: "Trabalho não encontrado"
            });
        }

        // Buscar aplicações
        const applicationsSql = `
            SELECT ja.*, u.name as freelancer_name, u.email as freelancer_email,
                   fp.professional_title, fp.skills, fp.hourly_rate
            FROM job_applications ja
            LEFT JOIN users u ON ja.freelancer_id = u.id
            LEFT JOIN freelancer_profiles fp ON ja.freelancer_id = fp.user_id
            WHERE ja.job_id = ?
            ORDER BY ja.created_at DESC
        `;

        const applications = await query(applicationsSql, [jobId]);

        return res.json({
            message: "Aplicações carregadas com sucesso",
            applications: applications
        });
    } catch (error) {
        console.error("Erro ao carregar aplicações:", error);
        return res.status(500).json({
            message: "Erro interno do servidor"
        });
    }
};

exports.updateApplicationStatus = async (req, res) => {
    const { applicationId, status } = req.body;
    const clientId = req.user.id;

    if (!applicationId || !status) {
        return res.status(400).json({
            message: "ID da aplicação e status são obrigatórios"
        });
    }

    if (!['accepted', 'rejected'].includes(status)) {
        return res.status(400).json({
            message: "Status inválido"
        });
    }

    try {
        // Verificar se a aplicação pertence a um trabalho do cliente
        const applicationSql = `
            SELECT ja.id, j.client_id
            FROM job_applications ja
            LEFT JOIN jobs j ON ja.job_id = j.id
            WHERE ja.id = ? AND j.client_id = ?
        `;

        const applications = await query(applicationSql, [applicationId, clientId]);

        if (applications.length === 0) {
            return res.status(404).json({
                message: "Aplicação não encontrada"
            });
        }

        // Atualizar status
        const updateSql = "UPDATE job_applications SET status = ? WHERE id = ?";
        await query(updateSql, [status, applicationId]);

        return res.json({
            message: "Status da aplicação atualizado com sucesso"
        });
    } catch (error) {
        console.error("Erro ao atualizar status da aplicação:", error);
        return res.status(500).json({
            message: "Erro interno do servidor"
        });
    }
};