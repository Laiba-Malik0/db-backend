
import express from "express";
import db from "../config/db.js";
import {
    verifyToken,
    allowRoles
} from "../middleware/authMiddleware.js";

const router = express.Router();

// GET verification history, complaints and supply-chain details
router.get("/", verifyToken, allowRoles("admin"), (req, res) => {

    const sql = `
        SELECT
            vh.verification_id,
            vh.user_id,
            u.full_name AS customer_name,
            u.email AS customer_email,
            vh.entered_code,
            vh.verification_result,
            vh.verification_date,

            sc.scratch_id,
            sc.verification_status,

            b.batch_id,
            b.batch_number,
            b.manufacture_date,

            p.product_id,
            p.product_name,
            p.product_code,
            p.category,

            fr.report_id,
            fr.report_description,
            fr.report_status,
            fr.report_date,

            (
                SELECT GROUP_CONCAT(
                    DISTINCT CONCAT(
                        'Distributor: ', d.distributor_name,
                        ' | Retailer: ', r.retailer_name,
                        ' | Quantity: ', t.quantity,
                        ' | Transfer date: ',
                        DATE_FORMAT(t.transfer_date, '%Y-%m-%d %H:%i')
                    )
                    ORDER BY t.transfer_date DESC
                    SEPARATOR ' || '
                )
                FROM \`TRANSFER\` t
                JOIN \`DISTRIBUTOR\` d
                    ON t.distributor_id = d.distributor_id
                JOIN \`RETAILER\` r
                    ON t.retailer_id = r.retailer_id
                WHERE t.batch_id = b.batch_id
            ) AS supply_chain_details

        FROM \`VERIFI_HISTORY\` vh

        JOIN \`USER\` u
            ON vh.user_id = u.user_id

        LEFT JOIN \`SCRATCH_CODE\` sc
            ON vh.scratch_id = sc.scratch_id

        LEFT JOIN \`BATCH\` b
            ON sc.batch_id = b.batch_id

        LEFT JOIN \`PRODUCT\` p
            ON b.product_id = p.product_id

        LEFT JOIN \`FREPORT\` fr
            ON fr.user_id = vh.user_id
            AND UPPER(TRIM(fr.scratch_code)) =
                UPPER(TRIM(vh.entered_code))

        ORDER BY
            vh.verification_date DESC,
            vh.verification_id DESC
    `;

    db.query(sql, (err, results) => {

        if (err) {
            console.error("Fetch admin reports error:", err.message);

            return res.status(500).json({
                success: false,
                message: "Failed to fetch verification reports"
            });
        }

        const records = results.map((row) => {

            let verification_status;

            if (row.verification_result === "not_registered") {
                verification_status = "Not Registered";
            } else if (
                row.verification_result === "already_verified"
            ) {
                verification_status = "Already Verified";
            } else {
                verification_status = "Verified";
            }

            return {
                ...row,
                verification_status,
                report_status: row.report_status || null,
                report_description: row.report_description || null,
                supply_chain_details: row.supply_chain_details
                    ? row.supply_chain_details.split(" || ")
                    : []
            };
        });

        const summary = {
            total_attempts: records.length,

            first_verified: records.filter(
                (r) => r.verification_status === "Verified"
            ).length,

            already_verified: records.filter(
                (r) => r.verification_status === "Already Verified"
            ).length,

            not_registered: records.filter(
                (r) => r.verification_status === "Not Registered"
            ).length,

            total_reports: records.filter(
                (r) => r.report_status !== null
            ).length,

            pending_reports: records.filter(
                (r) => r.report_status === "pending"
            ).length
        };

        return res.json({
            success: true,
            summary,
            records
        });
    });
});


// UPDATE complaint status
router.patch(
    "/:reportId/status",
    verifyToken,
    allowRoles("admin"),
    (req, res) => {

        const reportId = Number(req.params.reportId);
        const { report_status } = req.body;

        if (!Number.isInteger(reportId) || reportId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid report ID"
            });
        }

        if (!["pending", "resolved"].includes(report_status)) {
            return res.status(400).json({
                success: false,
                message: "Status must be pending or resolved"
            });
        }

        db.query(
            `UPDATE \`FREPORT\`
             SET report_status = ?
             WHERE report_id = ?`,
            [report_status, reportId],
            (err, result) => {

                if (err) {
                    console.error("Update report status error:", err.message);

                    return res.status(500).json({
                        success: false,
                        message: "Failed to update report status"
                    });
                }

                if (result.affectedRows === 0) {
                    return res.status(404).json({
                        success: false,
                        message: "Report not found"
                    });
                }

                return res.json({
                    success: true,
                    message: "Report status updated successfully"
                });
            }
        );
    }
);

export default router;
