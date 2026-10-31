
import express from "express";
import db from "../config/db.js";
import { verifyToken, allowRoles } from "../middleware/authMiddleware.js";

const router = express.Router();

// GET ALL BATCHES
router.get("/", verifyToken, allowRoles("admin"), (req, res) => {
    const sql = `
        SELECT
            b.batch_id,
            b.product_id,
            p.product_name,
            b.batch_number,
            b.manufactured_qty,
            b.manufacture_date,
            b.created_at
        FROM \`BATCH\` b
        JOIN \`PRODUCT\` p ON b.product_id = p.product_id
        ORDER BY b.batch_id DESC
    `;

    db.query(sql, (err, results) => {
        if (err) {
            console.error("Fetch batches error:", err.message);

            return res.status(500).json({
                success: false,
                message: "Failed to fetch batches"
            });
        }

        return res.json({
            success: true,
            count: results.length,
            batches: results
        });
    });
});

// CREATE NEW BATCH
router.post("/", verifyToken, allowRoles("admin"), (req, res) => {
    const {
        product_id,
        batch_number,
        manufactured_qty,
        manufacture_date
    } = req.body;

    if (
        !product_id ||
        !batch_number ||
        !Number.isInteger(manufactured_qty) ||
        manufactured_qty <= 0 ||
        !manufacture_date
    ) {
        return res.status(400).json({
            success: false,
            message: "Please provide valid product_id, batch_number, manufactured_qty and manufacture_date"
        });
    }

    const sql = `
        INSERT INTO \`BATCH\`
        (product_id, batch_number, manufactured_qty, manufacture_date)
        VALUES (?, ?, ?, ?)
    `;

    db.query(
        sql,
        [product_id, batch_number, manufactured_qty, manufacture_date],
        (err, result) => {
            if (err) {
                if (err.code === "ER_DUP_ENTRY") {
                    return res.status(409).json({
                        success: false,
                        message: "This batch number already exists for this product"
                    });
                }

                if (err.code === "ER_NO_REFERENCED_ROW_2") {
                    return res.status(404).json({
                        success: false,
                        message: "Product not found"
                    });
                }

                console.error("Batch creation error:", err.message);

                return res.status(500).json({
                    success: false,
                    message: "Failed to create batch"
                });
            }

            return res.status(201).json({
                success: true,
                message: "Batch created successfully",
                batch_id: result.insertId
            });
        }
    );
});

export default router;
