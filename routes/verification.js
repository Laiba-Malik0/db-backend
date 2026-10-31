
import express from "express";
import db from "../config/db.js";
import { verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();

// VERIFY PRODUCT USING SCRATCH CODE
router.post("/", verifyToken, (req, res) => {
    const { scratch_code } = req.body;
    const user_id = req.user.user_id;

    if (
        !scratch_code ||
        typeof scratch_code !== "string" ||
        !scratch_code.trim()
    ) {
        return res.status(400).json({
            success: false,
            message: "Please provide a valid scratch code"
        });
    }

    const code = scratch_code.trim().toUpperCase();

    // Get a dedicated connection from the pool for this transaction
    db.getConnection((connectionErr, connection) => {
        if (connectionErr) {
            console.error("Database connection error:", connectionErr.message);

            return res.status(503).json({
                success: false,
                message: "Database temporarily unavailable"
            });
        }

        connection.beginTransaction((transactionErr) => {
            if (transactionErr) {
                console.error("Start transaction error:", transactionErr.message);
                connection.release();

                return res.status(500).json({
                    success: false,
                    message: "Could not start verification"
                });
            }

            const finish = (statusCode, response) => {
                connection.commit((commitErr) => {
                    if (commitErr) {
                        console.error("Commit error:", commitErr.message);

                        return connection.rollback(() => {
                            connection.release();

                            if (!res.headersSent) {
                                res.status(500).json({
                                    success: false,
                                    message: "Could not complete verification"
                                });
                            }
                        });
                    }

                    connection.release();

                    if (!res.headersSent) {
                        res.status(statusCode).json(response);
                    }
                });
            };

            const fail = (message, statusCode = 500) => {
                connection.rollback(() => {
                    connection.release();

                    if (!res.headersSent) {
                        res.status(statusCode).json({
                            success: false,
                            message
                        });
                    }
                });
            };

            const findSql = `
                SELECT
                    sc.scratch_id,
                    sc.batch_id,
                    sc.scratch_code,
                    sc.verification_status,
                    b.batch_number,
                    b.product_id,
                    p.product_name,
                    p.product_code,
                    p.category,
                    p.status AS product_status,
                    br.brand_name
                FROM \`SCRATCH_CODE\` sc
                JOIN \`BATCH\` b
                    ON sc.batch_id = b.batch_id
                JOIN \`PRODUCT\` p
                    ON b.product_id = p.product_id
                JOIN \`BRAND\` br
                    ON p.brand_id = br.brand_id
                WHERE sc.scratch_code = ?
                FOR UPDATE
            `;

            connection.query(findSql, [code], (err, results) => {
                if (err) {
                    console.error("Find scratch code error:", err.message);
                    return fail("Verification failed");
                }

                const scratch = results.length > 0 ? results[0] : null;

                const saveHistory = (result, responseData) => {
                    const historySql = `
                        INSERT INTO \`VERIFI_HISTORY\`
                        (user_id, scratch_id, entered_code, verification_result)
                        VALUES (?, ?, ?, ?)
                    `;

                    connection.query(
                        historySql,
                        [
                            user_id,
                            scratch ? scratch.scratch_id : null,
                            code,
                            result
                        ],
                        (historyErr) => {
                            if (historyErr) {
                                console.error(
                                    "Save history error:",
                                    historyErr.message
                                );

                                return fail("Could not save verification history");
                            }

                            finish(200, {
                                success: true,
                                ...responseData
                            });
                        }
                    );
                };

                // CASE 1: Code not registered
                if (!scratch) {
                    return saveHistory("not_registered", {
                        result: "not_registered",
                        message: "This code is not registered in VerifyChain"
                    });
                }

                const product = {
                    brand_name: scratch.brand_name,
                    product_name: scratch.product_name,
                    product_code: scratch.product_code,
                    category: scratch.category,
                    batch_number: scratch.batch_number
                };

                // CASE 2: Product inactive
                if (scratch.product_status === "inactive") {
                    return saveHistory("inactive", {
                        result: "inactive",
                        message: "This product is inactive and cannot be verified.",
                        product
                    });
                }

                // CASE 3: Code already used
                if (scratch.verification_status === "verified") {
                    return saveHistory("already_verified", {
                        result: "already_verified",
                        message: "This code has already been used. A copied code may be involved.",
                        product
                    });
                }

                // CASE 4: First successful verification
                const updateSql = `
                    UPDATE \`SCRATCH_CODE\`
                    SET verification_status = 'verified'
                    WHERE scratch_id = ?
                      AND verification_status = 'unused'
                `;

                connection.query(
                    updateSql,
                    [scratch.scratch_id],
                    (updateErr, updateResult) => {
                        if (updateErr) {
                            console.error(
                                "Update scratch status error:",
                                updateErr.message
                            );

                            return fail("Could not update code status");
                        }

                        if (updateResult.affectedRows !== 1) {
                            return fail("Could not complete code verification");
                        }

                        return saveHistory("registered", {
                            result: "registered",
                            message: "First verification successful",
                            product
                        });
                    }
                );
            });
        });
    });
});

export default router;
