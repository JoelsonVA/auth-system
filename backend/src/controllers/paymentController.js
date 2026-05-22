const Stripe = require("stripe");
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

function getStripe() {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
        throw new Error("STRIPE_SECRET_KEY environment variable is required");
    }
    return new Stripe(secretKey);
}

exports.createJobPaymentCheckout = async (req, res) => {
    const clientId = req.user.id;
    const { jobId } = req.params;
    const successUrl =
        process.env.STRIPE_JOB_SUCCESS_URL ||
        process.env.STRIPE_SUCCESS_URL ||
        process.env.FRONTEND_URL;
    const cancelUrl =
        process.env.STRIPE_JOB_CANCEL_URL ||
        process.env.STRIPE_CANCEL_URL ||
        process.env.FRONTEND_URL;

    if (!successUrl || !cancelUrl) {
        return res.status(500).json({
            message: "URLs de pagamento não configuradas"
        });
    }

    try {
        const jobRows = await query(
            `
            SELECT id, client_id, assigned_freelancer_id, title, budget, status
            FROM jobs
            WHERE id = ? AND client_id = ?
            `,
            [jobId, clientId]
        );

        if (!jobRows.length) {
            return res.status(404).json({ message: "Trabalho não encontrado" });
        }

        const job = jobRows[0];

        if (!job.assigned_freelancer_id) {
            return res.status(400).json({
                message: "Trabalho sem freelancer atribuído"
            });
        }

        if (job.status !== "completed") {
            return res.status(400).json({
                message: "Pagamento disponível apenas após concluir o trabalho"
            });
        }

        const amount = Number(job.budget) || 0;
        if (amount <= 0) {
            return res.status(400).json({
                message:
                    "Este trabalho não possui orçamento definido. Defina um orçamento para cobrar."
            });
        }

        const existing = await query(
            "SELECT id, status, stripe_checkout_session_id FROM job_payments WHERE job_id = ?",
            [job.id]
        );

        if (existing.length && existing[0].status === "paid") {
            return res.status(400).json({
                message: "Pagamento já foi confirmado para este trabalho"
            });
        }

        const paymentId = existing.length ? existing[0].id : null;
        if (!paymentId) {
            const insert = await query(
                `
                INSERT INTO job_payments (job_id, client_id, freelancer_id, amount, currency, status)
                VALUES (?, ?, ?, ?, 'brl', 'pending')
                `,
                [job.id, job.client_id, job.assigned_freelancer_id, amount]
            );
            // mysql2 returns OkPacket with insertId
            // eslint-disable-next-line no-unused-vars
            const newId = insert.insertId;
        }

        const paymentRow = await query(
            "SELECT id FROM job_payments WHERE job_id = ?",
            [job.id]
        );
        const resolvedPaymentId = paymentRow[0].id;

        const stripe = getStripe();
        const session = await stripe.checkout.sessions.create({
            mode: "payment",
            line_items: [
                {
                    price_data: {
                        currency: "brl",
                        unit_amount: Math.round(amount * 100),
                        product_data: {
                            name: `Pagamento do trabalho: ${job.title}`
                        }
                    },
                    quantity: 1
                }
            ],
            success_url: `${successUrl}?jobId=${job.id}&payment=success`,
            cancel_url: `${cancelUrl}?jobId=${job.id}&payment=cancel`,
            metadata: {
                jobId: String(job.id),
                paymentId: String(resolvedPaymentId)
            }
        });

        await query(
            `
            UPDATE job_payments
            SET stripe_checkout_session_id = ?
            WHERE id = ?
            `,
            [session.id, resolvedPaymentId]
        );

        return res.json({ url: session.url });
    } catch (error) {
        console.error("Erro ao criar checkout de pagamento:", error);
        return res.status(500).json({
            message: "Erro ao iniciar pagamento",
            error: error.message
        });
    }
};

exports.getMyPayoutInfo = async (req, res) => {
    const userId = req.user.id;

    if (req.user.accountType !== "freelancer") {
        return res.status(403).json({
            message: "Apenas freelancers podem acessar payout"
        });
    }

    try {
        const rows = await query(
            `
            SELECT payout_method, payout_details
            FROM freelancer_profiles
            WHERE user_id = ?
            `,
            [userId]
        );

        const row = rows[0] || {};
        return res.json({
            payoutMethod: row.payout_method || null,
            payoutDetails: row.payout_details || null
        });
    } catch (error) {
        console.error("Erro ao buscar payout:", error);
        return res.status(500).json({ message: "Erro ao buscar payout" });
    }
};

exports.updateMyPayoutInfo = async (req, res) => {
    const userId = req.user.id;
    const { payoutMethod, payoutDetails } = req.body;

    if (req.user.accountType !== "freelancer") {
        return res.status(403).json({
            message: "Apenas freelancers podem configurar payout"
        });
    }

    const method = String(payoutMethod || "").trim().toLowerCase();
    if (!method) {
        return res.status(400).json({ message: "Informe payoutMethod" });
    }

    const allowed = new Set(["pix", "bank", "paypal"]);
    if (!allowed.has(method)) {
        return res.status(400).json({
            message: "payoutMethod inválido (pix|bank|paypal)"
        });
    }

    try {
        // Garantir que exista um profile
        await query(
            `
            INSERT INTO freelancer_profiles (user_id)
            VALUES (?)
            ON DUPLICATE KEY UPDATE user_id = user_id
            `,
            [userId]
        );

        await query(
            `
            UPDATE freelancer_profiles
            SET payout_method = ?, payout_details = ?
            WHERE user_id = ?
            `,
            [method, payoutDetails ? String(payoutDetails) : null, userId]
        );

        return res.json({ message: "Método de recebimento atualizado" });
    } catch (error) {
        console.error("Erro ao atualizar payout:", error);
        return res.status(500).json({ message: "Erro ao atualizar payout" });
    }
};

