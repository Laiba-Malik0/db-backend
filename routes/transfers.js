
import express from "express";
import db from "../config/db.js";

const router = express.Router();

// GET ALL TRANSFERS
router.get("/", (req, res) => {
    const sql = `
        SELECT
            t.transfer_id,
            t.batch_id,
            t.distributor_id,
            t.retailer_id,
            t.quantity,
            t.transfer_date,
            b.batch_number,
            b.product_id,
            p.product_name,
            d.distributor_name,
            r.retailer_name
        FROM \`TRANSFER\` t
        LEFT JOIN \`BATCH\` b
            ON t.batch_id = b.batch_id
        LEFT JOIN \`PRODUCT\` p
            ON b.product_id = p.product_id
        LEFT JOIN \`DISTRIBUTOR\` d
            ON t.distributor_id = d.distributor_id
        LEFT JOIN \`RETAILER\` r
            ON t.retailer_id = r.retailer_id
        ORDER BY t.transfer_id DESC
    `;

    db.query(sql, (err, results) => {
        if (err) {
            console.error("Fetch transfers error:", err.message);

            return res.status(500).json({
                success: false,
                message: "Failed to fetch transfers"
            });
        }

        return res.json({
            success: true,
            transfers: results
        });
    });
});

// CREATE TRANSFER
router.post("/", (req, res) => {
    const batchId = Number(req.body.batch_id);
    const distributorId = Number(req.body.distributor_id);
    const retailerId = Number(req.body.retailer_id);
    const quantity = Number(req.body.quantity);

    if (
        !Number.isInteger(batchId) || batchId <= 0 ||
        !Number.isInteger(distributorId) || distributorId <= 0 ||
        !Number.isInteger(retailerId) || retailerId <= 0 ||
        !Number.isInteger(quantity) || quantity <= 0
    ) {
        return res.status(400).json({
            success: false,
            message: "Batch, distributor, retailer IDs and quantity must be positive integers"
        });
    }

    const sql = `
        INSERT INTO \`TRANSFER\`
        (batch_id, distributor_id, retailer_id, quantity)
        SELECT ?, ?, ?, ?
        WHERE EXISTS (
            SELECT 1 FROM \`BATCH\` WHERE batch_id = ?
        )
        AND EXISTS (
            SELECT 1 FROM \`DISTRIBUTOR\` WHERE distributor_id = ?
        )
        AND EXISTS (
            SELECT 1 FROM \`RETAILER\` WHERE retailer_id = ?
        )
    `;

    const values = [
        batchId,
        distributorId,
        retailerId,
        quantity,
        batchId,
        distributorId,
        retailerId
    ];

    db.query(sql, values, (err, result) => {
        if (err) {
            console.error("Create transfer error:", err.message);

            return res.status(500).json({
                success: false,
                message: "Failed to create transfer"
            });
        }

        if (result.affectedRows === 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid batch, distributor, or retailer ID. Please select existing records."
            });
        }

        return res.status(201).json({
            success: true,
            message: "Transfer created successfully",
            transfer_id: result.insertId
        });
    });
});

// UPDATE TRANSFER
router.put("/:id", (req, res) => {
    const transferId = Number(req.params.id);
    const batchId = Number(req.body.batch_id);
    const distributorId = Number(req.body.distributor_id);
    const retailerId = Number(req.body.retailer_id);
    const quantity = Number(req.body.quantity);

    if (
        !Number.isInteger(transferId) || transferId <= 0 ||
        !Number.isInteger(batchId) || batchId <= 0 ||
        !Number.isInteger(distributorId) || distributorId <= 0 ||
        !Number.isInteger(retailerId) || retailerId <= 0 ||
        !Number.isInteger(quantity) || quantity <= 0
    ) {
        return res.status(400).json({
            success: false,
            message: "Transfer, batch, distributor, retailer IDs and quantity must be positive integers"
        });
    }

    const sql = `
        UPDATE \`TRANSFER\`
        SET
            batch_id = ?,
            distributor_id = ?,
            retailer_id = ?,
            quantity = ?
        WHERE transfer_id = ?
        AND EXISTS (
            SELECT 1 FROM \`BATCH\` WHERE batch_id = ?
        )
        AND EXISTS (
            SELECT 1 FROM \`DISTRIBUTOR\` WHERE distributor_id = ?
        )
        AND EXISTS (
            SELECT 1 FROM \`RETAILER\` WHERE retailer_id = ?
        )
    `;

    const values = [
        batchId,
        distributorId,
        retailerId,
        quantity,
        transferId,
        batchId,
        distributorId,
        retailerId
    ];

    db.query(sql, values, (err, result) => {
        if (err) {
            console.error("Update transfer error:", err.message);

            return res.status(500).json({
                success: false,
                message: "Failed to update transfer"
            });
        }

        if (result.affectedRows === 0) {
            db.query(
                "SELECT transfer_id FROM `TRANSFER` WHERE transfer_id = ?",
                [transferId],
                (checkErr, rows) => {
                    if (checkErr) {
                        console.error("Check transfer error:", checkErr.message);

                        return res.status(500).json({
                            success: false,
                            message: "Failed to check transfer"
                        });
                    }

                    if (rows.length === 0) {
                        return res.status(404).json({
                            success: false,
                            message: "Transfer not found"
                        });
                    }

                    return res.status(400).json({
                        success: false,
                        message: "Invalid batch, distributor, or retailer ID. Please select existing records."
                    });
                }
            );

            return;
        }

        return res.json({
            success: true,
            message: "Transfer updated successfully"
        });
    });
});

// DELETE TRANSFER
router.delete("/:id", (req, res) => {
    const transferId = Number(req.params.id);

    if (!Number.isInteger(transferId) || transferId <= 0) {
        return res.status(400).json({
            success: false,
            message: "Invalid transfer ID"
        });
    }

    db.query(
        "DELETE FROM `TRANSFER` WHERE transfer_id = ?",
        [transferId],
        (err, result) => {
            if (err) {
                console.error("Delete transfer error:", err.message);

                return res.status(500).json({
                    success: false,
                    message: "Failed to delete transfer"
                });
            }

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Transfer not found"
                });
            }

            return res.json({
                success: true,
                message: "Transfer deleted successfully"
            });
        }
    );
});

export default router;
