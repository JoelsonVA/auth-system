require("dotenv").config();
const mysql = require("mysql2");

const connection = mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "auth_user",
    password: process.env.DB_PASSWORD || "SuaSenha",
    database: process.env.DB_NAME || "auth_db"
});

connection.connect((err) => {
    if (err) {
        console.log("Erro ao conectar ao MySQL:", err);
    } else {
        console.log("Conectado ao MySQL!");
        runSchemaSetup();
    }
});

function runSchemaSetup() {
    const createUsersTableSql = `
        CREATE TABLE IF NOT EXISTS users (
            id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(150) NOT NULL,
            email VARCHAR(150) NOT NULL UNIQUE,
            password VARCHAR(255) NOT NULL,
            is_admin TINYINT(1) NOT NULL DEFAULT 0,
            account_type ENUM('client', 'freelancer') NOT NULL DEFAULT 'client',
            professional_email VARCHAR(255) NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `;

    connection.query(createUsersTableSql, (usersErr) => {
        if (usersErr) {
            console.log("Erro ao criar tabela users:", usersErr);
            return;
        }

        ensureColumnExists(
            "users",
            "is_admin",
            "TINYINT(1) NOT NULL DEFAULT 0",
            "Erro ao criar coluna is_admin"
        );

        ensureColumnExists(
            "users",
            "account_type",
            "ENUM('client', 'freelancer') NOT NULL DEFAULT 'client'",
            "Erro ao criar coluna account_type"
        );

        ensureColumnExists(
            "users",
            "is_active",
            "TINYINT(1) NOT NULL DEFAULT 1",
            "Erro ao criar coluna is_active"
        );

        ensureColumnExists(
            "users",
            "deactivated_until",
            "DATETIME NULL",
            "Erro ao criar coluna deactivated_until"
        );

        ensureColumnExists(
            "users",
            "profile_photo",
            "MEDIUMTEXT NULL",
            "Erro ao criar coluna profile_photo"
        );

        ensureColumnExists(
            "users",
            "professional_email",
            "VARCHAR(255) NULL",
            "Erro ao criar coluna professional_email"
        );

        // Criar usuário admin padrão se não existir
        createDefaultAdmin();
    });

    const createLoginEventsSql = `
        CREATE TABLE IF NOT EXISTS login_events (
            id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            name VARCHAR(100) NULL,
            email VARCHAR(150) NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'success',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_login_events_user (user_id),
            INDEX idx_login_events_created_at (created_at),
            CONSTRAINT fk_login_events_user
                FOREIGN KEY (user_id)
                REFERENCES users(id)
                ON DELETE CASCADE
        )
    `;

    connection.query(createLoginEventsSql, (eventsErr) => {
        if (eventsErr) {
            console.log("Erro ao criar tabela login_events:", eventsErr);
        }
    });

    const createFreelancerProfilesSql = `
        CREATE TABLE IF NOT EXISTS freelancer_profiles (
            id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL UNIQUE,
            professional_title VARCHAR(120) NULL,
            bio TEXT NULL,
            skills VARCHAR(255) NULL,
            hourly_rate DECIMAL(10,2) NULL,
            location VARCHAR(120) NULL,
            portfolio_url VARCHAR(255) NULL,
            payout_method VARCHAR(32) NULL,
            payout_details TEXT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            CONSTRAINT fk_freelancer_profiles_user
                FOREIGN KEY (user_id)
                REFERENCES users(id)
                ON DELETE CASCADE
        )
    `;

    connection.query(createFreelancerProfilesSql, (freelancerProfilesErr) => {
        if (freelancerProfilesErr) {
            console.log("Erro ao criar tabela freelancer_profiles:", freelancerProfilesErr);
        }
    });

    ensureColumnExists(
        "freelancer_profiles",
        "payout_method",
        "VARCHAR(32) NULL",
        "Erro ao criar coluna payout_method em freelancer_profiles"
    );

    ensureColumnExists(
        "freelancer_profiles",
        "payout_details",
        "TEXT NULL",
        "Erro ao criar coluna payout_details em freelancer_profiles"
    );

    const createMessagesSql = `
        CREATE TABLE IF NOT EXISTS messages (
            id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
            sender_id INT NOT NULL,
            receiver_id INT NOT NULL,
            message TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_messages_sender (sender_id),
            INDEX idx_messages_receiver (receiver_id),
            INDEX idx_messages_created_at (created_at),
            CONSTRAINT fk_messages_sender
                FOREIGN KEY (sender_id)
                REFERENCES users(id)
                ON DELETE CASCADE,
            CONSTRAINT fk_messages_receiver
                FOREIGN KEY (receiver_id)
                REFERENCES users(id)
                ON DELETE CASCADE
        )
    `;

    connection.query(createMessagesSql, (messagesErr) => {
        if (messagesErr) {
            console.log("Erro ao criar tabela messages:", messagesErr);
        }
    });

        const createJobsSql = `
            CREATE TABLE IF NOT EXISTS jobs (
                id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
                client_id INT NOT NULL,
                assigned_freelancer_id INT NULL,
                title VARCHAR(255) NOT NULL,
                description TEXT NOT NULL,
                budget DECIMAL(10,2) NULL,
                skills_required VARCHAR(500) NULL,
                deadline DATE NULL,
                status ENUM('open', 'in_progress', 'completed', 'cancelled') NOT NULL DEFAULT 'open',
                completed_at DATETIME NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_jobs_client (client_id),
                INDEX idx_jobs_status (status),
                INDEX idx_jobs_created_at (created_at),
                CONSTRAINT fk_jobs_client
                    FOREIGN KEY (client_id)
                    REFERENCES users(id)
                    ON DELETE CASCADE
            )
        `;

    connection.query(createJobsSql, (jobsErr) => {
        if (jobsErr) {
            console.log("Erro ao criar tabela jobs:", jobsErr);
        }
    });

    ensureColumnExists(
        "jobs",
        "assigned_freelancer_id",
        "INT NULL",
        "Erro ao criar coluna assigned_freelancer_id em jobs"
    );

    ensureColumnExists(
        "jobs",
        "completed_at",
        "DATETIME NULL",
        "Erro ao criar coluna completed_at em jobs"
    );

    const createJobApplicationsSql = `
        CREATE TABLE IF NOT EXISTS job_applications (
            id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
            job_id INT NOT NULL,
            freelancer_id INT NOT NULL,
            message TEXT NULL,
            status ENUM('pending', 'accepted', 'rejected') NOT NULL DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_job_applications_job (job_id),
            INDEX idx_job_applications_freelancer (freelancer_id),
            INDEX idx_job_applications_status (status),
            CONSTRAINT fk_job_applications_job
                FOREIGN KEY (job_id)
                REFERENCES jobs(id)
                ON DELETE CASCADE,
            CONSTRAINT fk_job_applications_freelancer
                FOREIGN KEY (freelancer_id)
                REFERENCES users(id)
                ON DELETE CASCADE,
            UNIQUE KEY unique_job_freelancer (job_id, freelancer_id)
        )
    `;

    connection.query(createJobApplicationsSql, (applicationsErr) => {
        if (applicationsErr) {
            console.log("Erro ao criar tabela job_applications:", applicationsErr);
        }
    });

    const createNotificationsSql = `
        CREATE TABLE IF NOT EXISTS notifications (
            id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            type ENUM('message', 'proposal', 'job') NOT NULL,
            title VARCHAR(255) NOT NULL,
            content TEXT NULL,
            related_id INT NULL,
            related_user_id INT NULL,
            is_read TINYINT(1) NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_notifications_user (user_id),
            INDEX idx_notifications_type (type),
            INDEX idx_notifications_is_read (is_read),
            INDEX idx_notifications_created_at (created_at),
            CONSTRAINT fk_notifications_user
                FOREIGN KEY (user_id)
                REFERENCES users(id)
                ON DELETE CASCADE
        )
    `;

    connection.query(createNotificationsSql, (notificationsErr) => {
        if (notificationsErr) {
            console.log("Erro ao criar tabela notifications:", notificationsErr);
        }
    });

    ensureColumnExists(
        "notifications",
        "available_at",
        "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP",
        "Erro ao criar coluna available_at em notifications"
    );

    const createBillingCustomersSql = `
        CREATE TABLE IF NOT EXISTS billing_customers (
            id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL UNIQUE,
            stripe_customer_id VARCHAR(64) NOT NULL UNIQUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT fk_billing_customers_user
                FOREIGN KEY (user_id)
                REFERENCES users(id)
                ON DELETE CASCADE
        )
    `;

    connection.query(createBillingCustomersSql, (billingCustomersErr) => {
        if (billingCustomersErr) {
            console.log("Erro ao criar tabela billing_customers:", billingCustomersErr);
        }
    });

    const createBillingSubscriptionsSql = `
        CREATE TABLE IF NOT EXISTS billing_subscriptions (
            id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            stripe_subscription_id VARCHAR(64) NOT NULL UNIQUE,
            status VARCHAR(32) NOT NULL,
            current_period_end DATETIME NULL,
            price_id VARCHAR(64) NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_billing_subscriptions_user (user_id),
            INDEX idx_billing_subscriptions_status (status),
            INDEX idx_billing_subscriptions_period_end (current_period_end),
            CONSTRAINT fk_billing_subscriptions_user
                FOREIGN KEY (user_id)
                REFERENCES users(id)
                ON DELETE CASCADE
        )
    `;

    connection.query(createBillingSubscriptionsSql, (billingSubscriptionsErr) => {
        if (billingSubscriptionsErr) {
            console.log(
                "Erro ao criar tabela billing_subscriptions:",
                billingSubscriptionsErr
            );
        }
    });

    const createFailedLoginAttemptsSql = `
        CREATE TABLE IF NOT EXISTS failed_login_attempts (
            id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            email VARCHAR(150) NOT NULL,
            attempt_count INT NOT NULL DEFAULT 1,
            locked_until DATETIME NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_failed_attempts_email (email),
            INDEX idx_failed_attempts_locked_until (locked_until),
            CONSTRAINT fk_failed_attempts_user
                FOREIGN KEY (user_id)
                REFERENCES users(id)
                ON DELETE CASCADE
        )
    `;

    connection.query(createFailedLoginAttemptsSql, (failedLoginAttemptsErr) => {
        if (failedLoginAttemptsErr) {
            console.log("Erro ao criar tabela failed_login_attempts:", failedLoginAttemptsErr);
        }
    });

    const createJobPaymentsSql = `
        CREATE TABLE IF NOT EXISTS job_payments (
            id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
            job_id INT NOT NULL UNIQUE,
            client_id INT NOT NULL,
            freelancer_id INT NOT NULL,
            amount DECIMAL(10,2) NOT NULL DEFAULT 0,
            currency VARCHAR(10) NOT NULL DEFAULT 'brl',
            status ENUM('pending', 'paid') NOT NULL DEFAULT 'pending',
            stripe_checkout_session_id VARCHAR(128) NULL UNIQUE,
            stripe_payment_intent_id VARCHAR(128) NULL UNIQUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            paid_at DATETIME NULL,
            INDEX idx_job_payments_client (client_id),
            INDEX idx_job_payments_freelancer (freelancer_id),
            INDEX idx_job_payments_status (status),
            CONSTRAINT fk_job_payments_job
                FOREIGN KEY (job_id)
                REFERENCES jobs(id)
                ON DELETE CASCADE,
            CONSTRAINT fk_job_payments_client
                FOREIGN KEY (client_id)
                REFERENCES users(id)
                ON DELETE CASCADE,
            CONSTRAINT fk_job_payments_freelancer
                FOREIGN KEY (freelancer_id)
                REFERENCES users(id)
                ON DELETE CASCADE
        )
    `;

    connection.query(createJobPaymentsSql, (jobPaymentsErr) => {
        if (jobPaymentsErr) {
            console.log("Erro ao criar tabela job_payments:", jobPaymentsErr);
        }
    });
}

function createDefaultAdmin() {
    const adminEmail = 'admin@freelancehub.com';
    const adminPassword = '$2b$10$wo4pj3rO9ILRaa37hzH8T.w8KGZOHLHS7qhxP2eRi4ohf7G9Wlbx2'; // Senha: admin123
    const adminName = 'Administrador';

    const checkAdminSql = 'SELECT id FROM users WHERE email = ?';
    connection.query(checkAdminSql, [adminEmail], (err, results) => {
        if (err) {
            console.log('Erro ao verificar admin:', err);
            return;
        }
        if (results.length === 0) {
            const insertAdminSql = `
                INSERT INTO users (name, email, password, is_admin, account_type)
                VALUES (?, ?, ?, 1, 'client')
            `;
            connection.query(insertAdminSql, [adminName, adminEmail, adminPassword], (insertErr) => {
                if (insertErr) {
                    console.log('Erro ao criar admin padrão:', insertErr);
                } else {
                    console.log('Admin padrão criado: admin@freelancehub.com / admin123');
                }
            });
        }
    });
}

function ensureColumnExists(table, column, definition, errorMessage) {
    const checkColumnSql = `SHOW COLUMNS FROM ${table} LIKE ?`;
    connection.query(checkColumnSql, [column], (checkErr, results) => {
        if (checkErr) {
            console.log(`${errorMessage}:`, checkErr);
            return;
        }

        if (results.length === 0) {
            const alterSql = `ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`;
            connection.query(alterSql, (alterErr) => {
                if (alterErr) {
                    console.log(`${errorMessage}:`, alterErr);
                }
            });
        }
    });
}

module.exports = connection;
