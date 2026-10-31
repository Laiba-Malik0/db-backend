
import mysql from "mysql2";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load Aiven CA certificate
const caPath = path.resolve(__dirname, "../certs/ca.pem");

let sslConfig;

if (process.env.DB_SSL_CA) {
    sslConfig = {
        ca: Buffer.from(process.env.DB_SSL_CA, "base64").toString("utf8"),
        rejectUnauthorized: true
    };
} else if (fs.existsSync(caPath)) {
    sslConfig = {
        ca: fs.readFileSync(caPath, "utf8"),
        rejectUnauthorized: true
    };
} else {
    throw new Error("Aiven SSL certificate is missing.");
}

// Create reusable MySQL connection pool
const db = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,

    ssl: sslConfig,

    waitForConnections: true,
    connectionLimit: 3,
    maxIdle: 2,
    idleTimeout: 30000,
    connectTimeout: 20000,
    queueLimit: 0,

    enableKeepAlive: true,
    keepAliveInitialDelay: 10000
});

// Initial connection check
db.getConnection((err, connection) => {
    if (err) {
        console.error("Aiven MySQL connection failed:", err.message);
        return;
    }

    console.log("Aiven MySQL connected successfully!");
    connection.release();
});

export default db;
