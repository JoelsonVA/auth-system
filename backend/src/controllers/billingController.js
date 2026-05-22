const Stripe = require("stripe");
const connection = require("../config/db");
const { hasActiveSubscriptionForPrice } = require("../utils/premium");

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

async function getOrCreateCustomerId(userId, email) {
    const rows = await query(
        "SELECT stripe_customer_id FROM billing_customers WHERE user_id = ?",
        [userId]
    );

    if (rows.length && rows[0].stripe_customer_id) {
        return rows[0].stripe_customer_id;
    }

    const stripe = getStripe();
    const customer = await stripe.customers.create({
        email,
        metadata: { userId: String(userId) }
    });

    await query(
        "INSERT INTO billing_customers (user_id, stripe_customer_id) VALUES (?, ?)",
        [userId, customer.id]
    );

    return customer.id;
}

exports.createCheckoutSession = async (req, res) => {
    const planType = String(req.body.planType || "").trim().toLowerCase();
    const priceId =
        planType === "freelancer"
            ? process.env.STRIPE_PRICE_ID_FREELANCER
            : planType === "client"
                ? process.env.STRIPE_PRICE_ID_CLIENT
                : null;
    const successUrl = process.env.STRIPE_SUCCESS_URL;
    const cancelUrl = process.env.STRIPE_CANCEL_URL;

    if (!priceId || !successUrl || !cancelUrl) {
        return res.status(500).json({
            message:
                "Billing não configurado (STRIPE_PRICE_ID_FREELANCER/STRIPE_PRICE_ID_CLIENT/STRIPE_SUCCESS_URL/STRIPE_CANCEL_URL)"
        });
    }

    try {
        const stripe = getStripe();
        const customerId = await getOrCreateCustomerId(req.user.id, req.user.email);

        const session = await stripe.checkout.sessions.create({
            mode: "subscription",
            customer: customerId,
            line_items: [{ price: priceId, quantity: 1 }],
            success_url: successUrl,
            cancel_url: cancelUrl,
            allow_promotion_codes: true,
            subscription_data: {
                metadata: { userId: String(req.user.id), planType }
            },
            metadata: { userId: String(req.user.id), planType }
        });

        return res.json({
            url: session.url
        });
    } catch (error) {
        console.error("Erro ao criar checkout session:", error);
        return res.status(500).json({
            message: "Erro ao iniciar pagamento",
            error: error.message
        });
    }
};

exports.createPortalSession = async (req, res) => {
    const returnUrl =
        process.env.STRIPE_PORTAL_RETURN_URL ||
        process.env.STRIPE_SUCCESS_URL ||
        process.env.FRONTEND_URL ||
        "http://localhost:3000";

    try {
        const stripe = getStripe();
        const customerId = await getOrCreateCustomerId(req.user.id, req.user.email);

        const session = await stripe.billingPortal.sessions.create({
            customer: customerId,
            return_url: returnUrl
        });

        return res.json({ url: session.url });
    } catch (error) {
        console.error("Erro ao criar portal session:", error);
        return res.status(500).json({
            message: "Erro ao abrir portal de assinatura",
            error: error.message
        });
    }
};

exports.getStatus = async (req, res) => {
    try {
        const freelancerPriceId = process.env.STRIPE_PRICE_ID_FREELANCER;
        const clientPriceId = process.env.STRIPE_PRICE_ID_CLIENT;

        const isFreelancerPremium = await hasActiveSubscriptionForPrice(
            req.user.id,
            freelancerPriceId
        );
        const isClientPremium = await hasActiveSubscriptionForPrice(
            req.user.id,
            clientPriceId
        );

        return res.json({
            freelancer: { isPremium: isFreelancerPremium },
            client: { isPremium: isClientPremium }
        });
    } catch (error) {
        console.error("Erro ao buscar status premium:", error);
        return res.status(500).json({
            message: "Erro ao buscar status premium"
        });
    }
};

async function upsertSubscriptionFromStripe(stripeSubscription) {
    const stripeCustomerId = stripeSubscription.customer;
    const customerRows = await query(
        "SELECT user_id FROM billing_customers WHERE stripe_customer_id = ?",
        [stripeCustomerId]
    );
    if (!customerRows.length) {
        return;
    }

    const userId = customerRows[0].user_id;
    const status = stripeSubscription.status;
    const currentPeriodEnd = stripeSubscription.current_period_end
        ? new Date(stripeSubscription.current_period_end * 1000)
        : null;

    const firstItem = stripeSubscription.items?.data?.[0];
    const priceId = firstItem?.price?.id || null;

    await query(
        `
        INSERT INTO billing_subscriptions
            (user_id, stripe_subscription_id, status, current_period_end, price_id)
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            status = VALUES(status),
            current_period_end = VALUES(current_period_end),
            price_id = VALUES(price_id),
            updated_at = CURRENT_TIMESTAMP
        `,
        [userId, stripeSubscription.id, status, currentPeriodEnd, priceId]
    );
}

async function markJobPaymentPaid(paymentId, stripeSessionId, stripePaymentIntentId) {
    const paymentRows = await query(
        "SELECT id, job_id, freelancer_id FROM job_payments WHERE id = ?",
        [paymentId]
    );
    if (!paymentRows.length) {
        return;
    }

    await query(
        `
        UPDATE job_payments
        SET status = 'paid',
            stripe_checkout_session_id = COALESCE(?, stripe_checkout_session_id),
            stripe_payment_intent_id = COALESCE(?, stripe_payment_intent_id),
            paid_at = NOW()
        WHERE id = ?
        `,
        [stripeSessionId, stripePaymentIntentId, paymentId]
    );

    const notificationController = require("./notificationController");
    await notificationController.createNotification(
        paymentRows[0].freelancer_id,
        "job",
        "Pagamento confirmado",
        "O pagamento do trabalho foi confirmado. Verifique/atualize seu método de recebimento no perfil.",
        paymentRows[0].job_id,
        null
    );
}

exports.webhook = async (req, res) => {
    let stripe;
    try {
        stripe = getStripe();
    } catch (error) {
        return res.status(500).send(error.message);
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
        return res.status(500).send("STRIPE_WEBHOOK_SECRET não configurado");
    }

    const signature = req.headers["stripe-signature"];
    if (!signature) {
        return res.status(400).send("Assinatura do Stripe ausente");
    }

    let event;
    try {
        event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);
    } catch (err) {
        console.error("Falha ao validar webhook:", err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
        switch (event.type) {
            case "checkout.session.completed": {
                const session = event.data.object;
                if (session.mode === "subscription" && session.subscription) {
                    const subscription = await stripe.subscriptions.retrieve(
                        session.subscription
                    );
                    await upsertSubscriptionFromStripe(subscription);
                }

                if (session.mode === "payment") {
                    const paymentId = session.metadata?.paymentId;
                    const paymentIntentId = session.payment_intent || null;

                    if (paymentId) {
                        await markJobPaymentPaid(paymentId, session.id, paymentIntentId);
                    }
                }
                break;
            }
            case "customer.subscription.created":
            case "customer.subscription.updated": {
                const subscription = event.data.object;
                await upsertSubscriptionFromStripe(subscription);
                break;
            }
            case "customer.subscription.deleted": {
                const subscription = event.data.object;
                await upsertSubscriptionFromStripe(subscription);
                break;
            }
            default:
                break;
        }

        return res.json({ received: true });
    } catch (error) {
        console.error("Erro ao processar webhook Stripe:", error);
        return res.status(500).send("Erro ao processar webhook");
    }
};
