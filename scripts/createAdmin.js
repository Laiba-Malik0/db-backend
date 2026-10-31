
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import readline from "readline/promises";
import { stdin, stdout } from "process";
import db from "../config/db.js";

dotenv.config();

const rl = readline.createInterface({
    input: stdin,
    output: stdout
});

async function createAdmin() {
    try {
        console.log("\n=== VerifyChain Admin Setup ===\n");

        const fullName = (await rl.question("Admin full name: ")).trim();
        const email = (await rl.question("Admin email: "))
            .trim()
            .toLowerCase();

        const password = await rl.question("Admin password: ");

        if (!fullName || !email || password.length < 8) {
            throw new Error(
                "Name and email are required. Password must be at least 8 characters."
            );
        }

        const [existing] = await db.promise().query(
            "SELECT user_id, role FROM `USER` WHERE email = ? LIMIT 1",
            [email]
        );

        if (existing.length > 0) {
            throw new Error(
                `This email already exists with role: ${existing[0].role}`
            );
        }

        const passwordHash = await bcrypt.hash(password, 12);

        const [result] = await db.promise().query(
            `INSERT INTO \`USER\`
             (full_name, email, password_hash, role)
             VALUES (?, ?, ?, 'admin')`,
            [fullName, email, passwordHash]
        );

        console.log("\nAdmin account created successfully!");
        console.log("Admin ID:", result.insertId);
        console.log("Email:", email);

    } catch (error) {
        console.error("\nAdmin setup failed:", error.message);
    } finally {
        rl.close();
        db.end();
    }
}

createAdmin();
