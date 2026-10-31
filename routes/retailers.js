
import express from "express";
import db from "../config/db.js";

const router = express.Router();

// GET ALL RETAILERS
router.get("/", (req, res) => {
    db.query(
        "SELECT * FROM `RETAILER` ORDER BY retailer_id DESC",
        (err, results) => {
            if (err) {
                console.error("Fetch retailers error:", err.message);

                return res.status(500).json({
                    success: false,
                    message: "Failed to fetch retailers"
                });
            }

            return res.json({
                success: true,
                retailers: results
            });
        }
    );
});

// ADD RETAILER
router.post("/", (req, res) => {
    const {
        retailer_name,
        contact_person,
        email,
        phone,
        address
    } = req.body;

    if (!retailer_name?.trim()) {
        return res.status(400).json({
            success: false,
            message: "Retailer name is required"
        });
    }

    const sql = `
        INSERT INTO \`RETAILER\`
        (retailer_name, contact_person, email, phone, address)
        VALUES (?, ?, ?, ?, ?)
    `;

    db.query(
        sql,
        [
            retailer_name.trim(),
            contact_person || null,
            email || null,
            phone || null,
            address || null
        ],
        (err, result) => {
            if (err) {
                if (err.code === "ER_DUP_ENTRY") {
                    return res.status(409).json({
                        success: false,
                        message: "This email is already registered"
                    });
                }

                console.error("Add retailer error:", err.message);

                return res.status(500).json({
                    success: false,
                    message: "Failed to add retailer"
                });
            }

            return res.status(201).json({
                success: true,
                message: "Retailer added successfully",
                retailer_id: result.insertId
            });
        }
    );
});

// UPDATE RETAILER
router.put("/:id", (req, res) => {
    const { id } = req.params;

    const {
        retailer_name,
        contact_person,
        email,
        phone,
        address
    } = req.body;

    if (!retailer_name?.trim()) {
        return res.status(400).json({
            success: false,
            message: "Retailer name is required"
        });
    }

    const sql = `
        UPDATE \`RETAILER\`
        SET retailer_name = ?,
            contact_person = ?,
            email = ?,
            phone = ?,
            address = ?
        WHERE retailer_id = ?
    `;

    db.query(
        sql,
        [
            retailer_name.trim(),
            contact_person || null,
            email || null,
            phone || null,
            address || null,
            id
        ],
        (err, result) => {
            if (err) {
                if (err.code === "ER_DUP_ENTRY") {
                    return res.status(409).json({
                        success: false,
                        message: "This email is already registered"
                    });
                }

                console.error("Update retailer error:", err.message);

                return res.status(500).json({
                    success: false,
                    message: "Failed to update retailer"
                });
            }

            if (!result.affectedRows) {
                return res.status(404).json({
                    success: false,
                    message: "Retailer not found"
                });
            }

            return res.json({
                success: true,
                message: "Retailer updated successfully"
            });
        }
    );
});

// DELETE RETAILER
router.delete("/:id", (req, res) => {
    db.query(
        "DELETE FROM `RETAILER` WHERE retailer_id = ?",
        [req.params.id],
        (err, result) => {
            if (err) {
                if (err.code === "ER_ROW_IS_REFERENCED_2") {
                    return res.status(409).json({
                        success: false,
                        message: "Retailer is linked to transfers"
                    });
                }

                console.error("Delete retailer error:", err.message);

                return res.status(500).json({
                    success: false,
                    message: "Failed to delete retailer"
                });
            }

            if (!result.affectedRows) {
                return res.status(404).json({
                    success: false,
                    message: "Retailer not found"
                });
            }

            return res.json({
                success: true,
                message: "Retailer deleted successfully"
            });
        }
    );
});

export default router;
