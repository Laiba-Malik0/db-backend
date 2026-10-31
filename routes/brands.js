
import express from "express";
import db from "../config/db.js";
import { verifyToken, allowRoles } from "../middleware/authMiddleware.js";

const router = express.Router();

// GET ALL BRANDS
router.get("/", (req, res) => {
    const sql = `
        SELECT
            brand_id,
            brand_name,
            contact_email,
            contact_phone,
            created_at
        FROM \`BRAND\`
        ORDER BY brand_id DESC
    `;

    db.query(sql, (err, results) => {
        if (err) {
            console.error("Fetch brands error:", err.message);

            return res.status(500).json({
                success: false,
                message: "Could not fetch brands"
            });
        }

        return res.json({
            success: true,
            count: results.length,
            brands: results
        });
    });
});

// ADD BRAND - ADMIN ONLY
router.post("/", verifyToken, allowRoles("admin"), (req, res) => {
    const { brand_name, contact_email, contact_phone } = req.body;

    if (!brand_name || !brand_name.trim()) {
        return res.status(400).json({
            success: false,
            message: "Brand name is required"
        });
    }

    const sql = `
        INSERT INTO \`BRAND\`
        (brand_name, contact_email, contact_phone)
        VALUES (?, ?, ?)
    `;

    db.query(
        sql,
        [
            brand_name.trim(),
            contact_email?.trim() || null,
            contact_phone?.trim() || null
        ],
        (err, result) => {
            if (err) {
                if (err.code === "ER_DUP_ENTRY") {
                    return res.status(409).json({
                        success: false,
                        message: "Brand email already exists"
                    });
                }

                console.error("Add brand error:", err.message);

                return res.status(500).json({
                    success: false,
                    message: "Could not add brand"
                });
            }

            return res.status(201).json({
                success: true,
                message: "Brand added successfully",
                brand_id: result.insertId
            });
        }
    );
});

export default router;
