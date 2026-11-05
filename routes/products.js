
import express from "express";
import multer from "multer";
import db from "../config/db.js";
import cloudinary from "../config/cloudinary.js";
import { verifyToken, allowRoles } from "../middleware/authMiddleware.js";

const router = express.Router();

// IMAGE UPLOAD CONFIGURATION
const storage = multer.memoryStorage();

const upload = multer({
    storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5 MB
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/jpg"
        ];

        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error("Only JPG, JPEG, PNG and WEBP images are allowed"));
        }
    }
});

// CLOUDINARY UPLOAD FUNCTION
const uploadImage = (file) => {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            {
                folder: "verifychain/products",
                resource_type: "image"
            },
            (error, result) => {
                if (error) {
                    return reject(error);
                }

                resolve(result.secure_url);
            }
        );

        stream.end(file.buffer);
    });
};

// GET ALL PRODUCTS
router.get("/", (req, res) => {
    const sql = `
        SELECT
            p.product_id,
            p.product_name,
            p.product_code,
            p.category,
            p.description,
            p.image_url,
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
router.post(
    "/",
    verifyToken,
    allowRoles("admin"),
    upload.single("image"),
    async (req, res) => {
        try {
            const {
                brand_id,
                product_name,
                product_code,
                category,
                description
            } = req.body;

            if (!brand_id || !product_name?.trim() || !product_code?.trim()) {
                return res.status(400).json({
                    success: false,
                    message: "Brand ID, product name and product code are required"
                });
            }

            let image_url = null;

            if (req.file) {
                image_url = await uploadImage(req.file);
            }

            const sql = `
                INSERT INTO \`PRODUCT\`
                (brand_id, product_name, product_code, category, description, image_url)
                VALUES (?, ?, ?, ?, ?, ?)
            `;

            db.query(
                sql,
                [
                    brand_id,
                    product_name.trim(),
                    product_code.trim(),
                    category || null,
                    description || null,
                    image_url
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
                        product_id: result.insertId,
                        image_url
                    });
                }
            );
        } catch (error) {
            console.error("Image upload error:", error.message);

            return res.status(500).json({
                success: false,
                message: "Image upload failed"
            });
        }
    }
);

// UPDATE PRODUCT (ADMIN ONLY)
router.put(
    "/:id",
    verifyToken,
    allowRoles("admin"),
    upload.single("image"),
    async (req, res) => {
        try {
            const {
                brand_id,
                product_name,
                product_code,
                category,
                description
            } = req.body;

            if (!brand_id || !product_name?.trim() || !product_code?.trim()) {
                return res.status(400).json({
                    success: false,
                    message: "Brand ID, product name and product code are required"
                });
            }

            let sql;
            let values;

            if (req.file) {
                const image_url = await uploadImage(req.file);

                sql = `
                    UPDATE \`PRODUCT\`
                    SET brand_id = ?,
                        product_name = ?,
                        product_code = ?,
                        category = ?,
                        description = ?,
                        image_url = ?
                    WHERE product_id = ?
                `;

                values = [
                    brand_id,
                    product_name.trim(),
                    product_code.trim(),
                    category || null,
                    description || null,
                    image_url,
                    req.params.id
                ];
            } else {
                sql = `
                    UPDATE \`PRODUCT\`
                    SET brand_id = ?,
                        product_name = ?,
                        product_code = ?,
                        category = ?,
                        description = ?
                    WHERE product_id = ?
                `;

                values = [
                    brand_id,
                    product_name.trim(),
                    product_code.trim(),
                    category || null,
                    description || null,
                    req.params.id
                ];
            }

            db.query(sql, values, (err, result) => {
                if (err) {
                    if (err.code === "ER_DUP_ENTRY") {
                        return res.status(409).json({
                            success: false,
                            message: "Product code already exists"
                        });
                    }

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
            });
        } catch (error) {
            console.error("Image update error:", error.message);

            return res.status(500).json({
                success: false,
                message: "Image upload failed"
            });
        }
    }
);

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
