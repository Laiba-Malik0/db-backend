
import express from "express";
import db from "../config/db.js";
import { verifyToken, allowRoles } from "../middleware/authMiddleware.js";

const router = express.Router();

// GET ALL PRODUCTS
router.get("/", (req, res) => {
    const sql = `
        SELECT
            p.product_id,
            p.product_name,
            p.product_code,
            p.category,
            p.description,
            p.status,
            p.created_at,
            b.brand_id,
            b.brand_name
        FROM \`PRODUCT\` p
        JOIN \`BRAND\` b ON p.brand_id = b.brand_id
        ORDER BY p.product_id DESC
    `;

    db.query(sql, (err, results) => {
        if (err) {
            console.error("Fetch products error:", err.message);
            return res.status(500).json({
                success: false,
                message: "Could not fetch products"
            });
        }

        return res.json({
            success: true,
            count: results.length,
            products: results
        });
    });
});

// ADD PRODUCT (ADMIN ONLY)
router.post("/", verifyToken, allowRoles("admin"), (req, res) => {
    const {
        brand_id,
        product_name,
        product_code,
        category,
        description
    } = req.body;

    if (!brand_id || !product_name || !product_code) {
        return res.status(400).json({
            success: false,
            message: "Brand ID, product name and product code are required"
        });
    }

    const sql = `
        INSERT INTO \`PRODUCT\`
        (brand_id, product_name, product_code, category, description)
        VALUES (?, ?, ?, ?, ?)
    `;

    db.query(
        sql,
        [
            brand_id,
            product_name.trim(),
            product_code.trim(),
            category || null,
            description || null
        ],
        (err, result) => {
            if (err) {
                if (err.code === "ER_DUP_ENTRY") {
                    return res.status(409).json({
                        success: false,
                        message: "Product code already exists"
                    });
                }

                if (err.code === "ER_NO_REFERENCED_ROW_2") {
                    return res.status(400).json({
                        success: false,
                        message: "Brand does not exist"
                    });
                }

                console.error("Add product error:", err.message);
                return res.status(500).json({
                    success: false,
                    message: "Could not add product"
                });
            }

            return res.status(201).json({
                success: true,
                message: "Product added successfully",
                product_id: result.insertId
            });
        }
    );
});

// UPDATE PRODUCT (ADMIN ONLY)
router.put("/:id", verifyToken, allowRoles("admin"), (req, res) => {
    const {
        brand_id,
        product_name,
        product_code,
        category,
        description
    } = req.body;

    if (!brand_id || !product_name || !product_code) {
        return res.status(400).json({
            success: false,
            message: "Brand ID, product name and product code are required"
        });
    }

    const sql = `
        UPDATE \`PRODUCT\`
        SET brand_id = ?, product_name = ?, product_code = ?,
            category = ?, description = ?
        WHERE product_id = ?
    `;

    db.query(
        sql,
        [
            brand_id,
            product_name.trim(),
            product_code.trim(),
            category || null,
            description || null,
            req.params.id
        ],
        (err, result) => {
            if (err) {
                console.error("Update product error:", err.message);
                return res.status(500).json({
                    success: false,
                    message: "Could not update product"
                });
            }

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Product not found"
                });
            }

            return res.json({
                success: true,
                message: "Product updated successfully"
            });
        }
    );
});

// ARCHIVE / RESTORE PRODUCT (ADMIN ONLY)
router.patch("/:id/status", verifyToken, allowRoles("admin"), (req, res) => {
    const { status } = req.body;
    const productId = req.params.id;

    if (!["active", "inactive"].includes(status)) {
        return res.status(400).json({
            success: false,
            message: "Status must be active or inactive"
        });
    }

    const sql = `
        UPDATE \`PRODUCT\`
        SET status = ?
        WHERE product_id = ?
    `;

    db.query(sql, [status, productId], (err, result) => {
        if (err) {
            console.error("Update product status error:", err.message);
            return res.status(500).json({
                success: false,
                message: "Could not update product status"
            });
        }

        if (result.affectedRows === 0) {
            return db.query(
                "SELECT product_id FROM `PRODUCT` WHERE product_id = ?",
                [productId],
                (checkErr, rows) => {
                    if (checkErr) {
                        return res.status(500).json({
                            success: false,
                            message: "Could not check product"
                        });
                    }

                    if (rows.length === 0) {
                        return res.status(404).json({
                            success: false,
                            message: "Product not found"
                        });
                    }

                    return res.json({
                        success: true,
                        message: `Product is already ${status}`,
                        status
                    });
                }
            );
        }

        return res.json({
            success: true,
            message: status === "inactive"
                ? "Product archived successfully"
                : "Product restored successfully",
            status
        });
    });
});

// DELETE PRODUCT (ADMIN ONLY)
router.delete("/:id", verifyToken, allowRoles("admin"), (req, res) => {
    db.query(
        "DELETE FROM `PRODUCT` WHERE product_id = ?",
        [req.params.id],
        (err, result) => {
            if (err) {
                if (err.code === "ER_ROW_IS_REFERENCED_2") {
                    return res.status(409).json({
                        success: false,
                        message: "This product is linked to existing batches or records"
                    });
                }

                console.error("Delete product error:", err.message);
                return res.status(500).json({
                    success: false,
                    message: "Could not delete product"
                });
            }

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Product not found"
                });
            }

            return res.json({
                success: true,
                message: "Product deleted successfully"
            });
        }
    );
});

export default router;
