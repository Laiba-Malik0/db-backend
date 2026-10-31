
import express from "express";
import db from "../config/db.js";

const router = express.Router();

// GET ALL DISTRIBUTORS
router.get("/", (req, res) => {
    const sql = `
        SELECT *
        FROM \`DISTRIBUTOR\`
        ORDER BY distributor_id DESC
    `;

    db.query(sql, (err, results) => {
        if (err) {
            console.error("Fetch distributors error:", err.message);

            return res.status(500).json({
                success: false,
                message: "Failed to fetch distributors"
            });
        }

        return res.json({
            success: true,
            distributors: results
        });
    });
});

// ADD DISTRIBUTOR
router.post("/", (req, res) => {
    const {
        distributor_name,
        contact_person,
        email,
        phone,
        address
    } = req.body;

    if (!distributor_name?.trim()) {
        return res.status(400).json({
            success: false,
            message: "Distributor name is required"
        });
    }

    const sql = `
        INSERT INTO \`DISTRIBUTOR\`
        (distributor_name, contact_person, email, phone, address)
        VALUES (?, ?, ?, ?, ?)
    `;

    db.query(
        sql,
        [
            distributor_name.trim(),
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

                console.error("Add distributor error:", err.message);

                return res.status(500).json({
                    success: false,
                    message: "Failed to add distributor"
                });
            }

            return res.status(201).json({
                success: true,
                message: "Distributor added successfully",
                distributor_id: result.insertId
            });
        }
    );
});

// UPDATE DISTRIBUTOR
router.put("/:id", (req, res) => {
    const { id } = req.params;

    const {
        distributor_name,
        contact_person,
        email,
        phone,
        address
    } = req.body;

    if (!distributor_name?.trim()) {
        return res.status(400).json({
            success: false,
            message: "Distributor name is required"
        });
    }

    const sql = `
        UPDATE \`DISTRIBUTOR\`
        SET distributor_name = ?,
            contact_person = ?,
            email = ?,
            phone = ?,
            address = ?
        WHERE distributor_id = ?
    `;

    db.query(
        sql,
        [
            distributor_name.trim(),
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

                console.error("Update distributor error:", err.message);

                return res.status(500).json({
                    success: false,
                    message: "Failed to update distributor"
                });
            }

            if (!result.affectedRows) {
                return res.status(404).json({
                    success: false,
                    message: "Distributor not found"
                });
            }

            return res.json({
                success: true,
                message: "Distributor updated successfully"
            });
        }
    );
});

// DELETE DISTRIBUTOR
router.delete("/:id", (req, res) => {
    db.query(
        "DELETE FROM `DISTRIBUTOR` WHERE distributor_id = ?",
        [req.params.id],
        (err, result) => {
            if (err) {
                if (err.code === "ER_ROW_IS_REFERENCED_2") {
                    return res.status(409).json({
                        success: false,
                        message: "Distributor is linked to transfers"
                    });
                }

                console.error("Delete distributor error:", err.message);

                return res.status(500).json({
                    success: false,
                    message: "Failed to delete distributor"
                });
            }

            if (!result.affectedRows) {
                return res.status(404).json({
                    success: false,
                    message: "Distributor not found"
                });
            }

            return res.json({
                success: true,
                message: "Distributor deleted successfully"
            });
        }
    );
});

export default router;
