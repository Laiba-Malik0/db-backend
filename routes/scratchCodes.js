
import express from "express";
import crypto from "crypto";
import db from "../config/db.js";
import {
    verifyToken,
    allowRoles
} from "../middleware/authMiddleware.js";

const router = express.Router();

// GET: Fetch all scratch codes for admin
router.get("/", verifyToken, allowRoles("admin"), (req, res) => {
    const sql = `
        SELECT
            sc.scratch_id,
            sc.batch_id,
            sc.scratch_code,
            sc.verification_status,
            sc.created_at,
            b.batch_number,
            b.product_id,
            p.product_name,
            p.product_code
        FROM \`SCRATCH_CODE\` sc
        INNER JOIN \`BATCH\` b
            ON sc.batch_id = b.batch_id
        INNER JOIN \`PRODUCT\` p
            ON b.product_id = p.product_id
        ORDER BY sc.batch_id, sc.scratch_id
    `;

    db.query(sql, (err, rows) => {
        if (err) {
            console.error("Fetch scratch codes error:", err.message);

            return res.status(500).json({
                success: false,
                message: "Failed to fetch scratch codes"
            });
        }

        return res.json({
            success: true,
            count: rows.length,
            scratchCodes: rows
        });
    });
});

// POST: Generate scratch codes for a batch
router.post("/generate", verifyToken, allowRoles("admin"), (req, res) => {
    const { batch_id, quantity } = req.body;

    if (
        !Number.isInteger(batch_id) ||
        batch_id <= 0 ||
        !Number.isInteger(quantity) ||
        quantity <= 0 ||
        quantity > 100
    ) {
        return res.status(400).json({
            success: false,
            message: "Provide a valid batch_id and quantity between 1 and 100"
        });
    }

    db.query(
        `SELECT batch_id, manufactured_qty
         FROM \`BATCH\`
         WHERE batch_id = ?`,
        [batch_id],
        (err, batches) => {
            if (err) {
                console.error("Batch check error:", err.message);

                return res.status(500).json({
                    success: false,
                    message: "Failed to check batch"
                });
            }

            if (batches.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Batch not found"
                });
            }

            db.query(
                `SELECT COUNT(*) AS total
                 FROM \`SCRATCH_CODE\`
                 WHERE batch_id = ?`,
                [batch_id],
                (countErr, counts) => {
                    if (countErr) {
                        console.error("Scratch code count error:", countErr.message);

                        return res.status(500).json({
                            success: false,
                            message: "Failed to count existing codes"
                        });
                    }

                    const existing = Number(counts[0].total);
                    const manufacturedQty = Number(batches[0].manufactured_qty);
                    const available = manufacturedQty - existing;

                    if (quantity > available) {
                        return res.status(400).json({
                            success: false,
                            message: `Only ${available} codes can be generated for this batch`
                        });
                    }

                    const codes = Array.from(
                        { length: quantity },
                        () => crypto.randomBytes(8).toString("hex").toUpperCase()
                    );

                    const values = codes.map(code => [batch_id, code]);

                    db.query(
                        `INSERT INTO \`SCRATCH_CODE\`
                         (batch_id, scratch_code)
                         VALUES ?`,
                        [values],
                        (insertErr, result) => {
                            if (insertErr) {
                                console.error("Scratch code generation error:", insertErr.message);

                                return res.status(500).json({
                                    success: false,
                                    message: "Failed to generate scratch codes"
                                });
                            }

                            return res.status(201).json({
                                success: true,
                                message: "Scratch codes generated successfully",
                                batch_id,
                                count: result.affectedRows,
                                codes
                            });
                        }
                    );
                }
            );
        }
    );
});

export default router;
