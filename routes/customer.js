
import express from "express";
import db from "../config/db.js";
import {
    verifyToken,
    allowRoles
} from "../middleware/authMiddleware.js";

const router = express.Router();


// GET LOGGED-IN CUSTOMER'S VERIFICATION HISTORY
router.get(
    "/history",
    verifyToken,
    allowRoles("customer"),
    (req, res) => {

        const userId = req.user.user_id;

        const sql = `
            SELECT
                vh.verification_id,
                vh.entered_code,
                vh.verification_result,
                vh.verification_date,
                sc.verification_status,
                b.batch_number,
                p.product_name,
                p.product_code,
                br.brand_name

            FROM \`VERIFI_HISTORY\` vh

            LEFT JOIN \`SCRATCH_CODE\` sc
                ON vh.scratch_id = sc.scratch_id

            LEFT JOIN \`BATCH\` b
                ON sc.batch_id = b.batch_id

            LEFT JOIN \`PRODUCT\` p
                ON b.product_id = p.product_id

            LEFT JOIN \`BRAND\` br
                ON p.brand_id = br.brand_id

            WHERE vh.user_id = ?

            ORDER BY
                vh.verification_date DESC,
                vh.verification_id DESC

            LIMIT 50
        `;

        db.query(sql, [userId], (err, rows) => {

            if (err) {
                console.error("Customer history error:", err.message);

                return res.status(500).json({
                    success: false,
                    message: "Could not fetch verification history"
                });
            }

            return res.json({
                success: true,
                history: rows
            });
        });
    }
);


// SUBMIT PRODUCT COMPLAINT
router.post(
    "/reports",
    verifyToken,
    allowRoles("customer"),
    (req, res) => {

        const userId = req.user.user_id;

        const {
            scratch_code,
            seller,
            location,
            description
        } = req.body;

        const code =
            typeof scratch_code === "string"
                ? scratch_code.trim().toUpperCase()
                : "";

        const details = [
            typeof description === "string" ? description.trim() : "",
            typeof seller === "string" && seller.trim()
                ? `Seller/shop: ${seller.trim()}`
                : "",
            typeof location === "string" && location.trim()
                ? `Purchase location: ${location.trim()}`
                : ""
        ]
            .filter(Boolean)
            .join("\n\n");

        if (!code || !details) {
            return res.status(400).json({
                success: false,
                message: "Product code and complaint details are required"
            });
        }

        // Find product linked with the submitted scratch code
        const findProductSql = `
            SELECT b.product_id
            FROM \`SCRATCH_CODE\` sc

            JOIN \`BATCH\` b
                ON sc.batch_id = b.batch_id

            WHERE sc.scratch_code = ?
            LIMIT 1
        `;

        db.query(findProductSql, [code], (findErr, rows) => {

            if (findErr) {
                console.error("Find complaint product error:", findErr.message);

                return res.status(500).json({
                    success: false,
                    message: "Could not process the complaint"
                });
            }

            const productId = rows.length
                ? rows[0].product_id
                : null;

            const insertSql = `
                INSERT INTO \`FREPORT\`
                    (
                        user_id,
                        product_id,
                        scratch_code,
                        report_description,
                        report_status
                    )
                VALUES (?, ?, ?, ?, 'pending')
            `;

            db.query(
                insertSql,
                [userId, productId, code, details],
                (insertErr, result) => {

                    if (insertErr) {
                        console.error("Insert complaint error:", insertErr.message);

                        return res.status(500).json({
                            success: false,
                            message: "Could not save your complaint"
                        });
                    }

                    return res.status(201).json({
                        success: true,
                        message: "Your complaint was submitted successfully",
                        report_id: result.insertId,
                        report_status: "pending"
                    });
                }
            );
        });
    }
);

export default router;
