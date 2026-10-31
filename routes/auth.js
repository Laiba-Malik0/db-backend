
import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import db from "../config/db.js";
import { verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();

// CUSTOMER REGISTRATION
router.post("/register", async (req, res) => {
    const { full_name, email, password } = req.body;

    if (!full_name || !email || !password) {
        return res.status(400).json({
            success: false,
            message: "Full name, email and password are required"
        });
    }

    if (password.length < 8) {
        return res.status(400).json({
            success: false,
            message: "Password must be at least 8 characters long"
        });
    }

    try {
        const passwordHash = await bcrypt.hash(password, 10);

        const sql = `
            INSERT INTO \`USER\`
            (full_name, email, password_hash, role)
            VALUES (?, ?, ?, 'customer')
        `;

        db.query(
            sql,
            [full_name.trim(), email.trim().toLowerCase(), passwordHash],
            (err, result) => {
                if (err) {
                    if (err.code === "ER_DUP_ENTRY") {
                        return res.status(409).json({
                            success: false,
                            message: "This email is already registered"
                        });
                    }

                    console.error("Registration error:", err.message);

                    return res.status(500).json({
                        success: false,
                        message: "Registration failed"
                    });
                }

                return res.status(201).json({
                    success: true,
                    message: "Customer registered successfully",
                    user_id: result.insertId
                });
            }
        );
    } catch (error) {
        console.error("Password hashing error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Registration failed"
        });
    }
});

// LOGIN
router.post("/login", (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({
            success: false,
            message: "Email and password are required"
        });
    }

    const sql = `
        SELECT user_id, full_name, email, password_hash, role
        FROM \`USER\`
        WHERE email = ?
        LIMIT 1
    `;

    db.query(sql, [email.trim().toLowerCase()], async (err, results) => {
        if (err) {
            console.error("Login database error:", err.message);

            return res.status(500).json({
                success: false,
                message: "Login failed"
            });
        }

        if (results.length === 0) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            });
        }

        const user = results[0];

        try {
            const passwordMatches = await bcrypt.compare(
                password,
                user.password_hash
            );

            if (!passwordMatches) {
                return res.status(401).json({
                    success: false,
                    message: "Invalid email or password"
                });
            }

            if (!process.env.JWT_SECRET) {
                throw new Error("JWT_SECRET is not configured");
            }

            const token = jwt.sign(
                {
                    user_id: user.user_id,
                    role: user.role
                },
                process.env.JWT_SECRET,
                { expiresIn: "90d" }
            );

            return res.json({
                success: true,
                message: "Login successful",
                token,
                user: {
                    user_id: user.user_id,
                    full_name: user.full_name,
                    email: user.email,
                    role: user.role
                }
            });
        } catch (error) {
            console.error("Login error:", error.message);

            return res.status(500).json({
                success: false,
                message: "Login failed"
            });
        }
    });
});

// CHECK CURRENT LOGIN
router.get("/me", verifyToken, (req, res) => {
    const sql = `
        SELECT user_id, full_name, email, role
        FROM \`USER\`
        WHERE user_id = ?
        LIMIT 1
    `;

    db.query(sql, [req.user.user_id], (err, results) => {
        if (err) {
            console.error("Fetch current user error:", err.message);

            return res.status(500).json({
                success: false,
                message: "Could not retrieve user"
            });
        }

        if (results.length === 0) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        return res.json({
            success: true,
            user: results[0]
        });
    });
});

export default router;
