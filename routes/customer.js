
import express from "express";
import db from "../config/db.js";
import {
  verifyToken,
  allowRoles,
} from "../middleware/authMiddleware.js";

const router = express.Router();

// Build report details without changing database structure
function buildDescription({
  product_name = "",
  description = "",
  seller = "",
  location = "",
}) {
  return [
    product_name.trim()
      ? `Product name: ${product_name.trim()}`
      : "",
    description.trim(),
    seller.trim()
      ? `Seller/shop: ${seller.trim()}`
      : "",
    location.trim()
      ? `Purchase location: ${location.trim()}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

// Find product linked with scratch code.
// Unknown codes are allowed and product_id remains NULL.
function findProductId(code, callback) {
  if (!code) {
    return callback(null, null);
  }

  const sql = `
    SELECT b.product_id
    FROM SCRATCH_CODE sc
    JOIN BATCH b ON sc.batch_id = b.batch_id
    WHERE sc.scratch_code = ?
    LIMIT 1
  `;

  db.query(sql, [code], (err, rows) => {
    if (err) return callback(err, null);

    callback(
      null,
      rows.length ? rows[0].product_id : null
    );
  });
}

// GET CUSTOMER VERIFICATION HISTORY
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
      FROM VERIFI_HISTORY vh
      LEFT JOIN SCRATCH_CODE sc
        ON vh.scratch_id = sc.scratch_id
      LEFT JOIN BATCH b
        ON sc.batch_id = b.batch_id
      LEFT JOIN PRODUCT p
        ON b.product_id = p.product_id
      LEFT JOIN BRAND br
        ON p.brand_id = br.brand_id
      WHERE vh.user_id = ?
      ORDER BY
        vh.verification_date DESC,
        vh.verification_id DESC
      LIMIT 50
    `;

    db.query(sql, [userId], (err, rows) => {
      if (err) {
        console.error("Customer history:", err.message);

        return res.status(500).json({
          success: false,
          message: "Could not fetch verification history.",
        });
      }

      res.json({
        success: true,
        history: rows,
      });
    });
  }
);

// GET ONLY LOGGED-IN CUSTOMER'S REPORTS
router.get(
  "/reports",
  verifyToken,
  allowRoles("customer"),
  (req, res) => {
    const userId = req.user.user_id;

    const sql = `
      SELECT
        r.report_id,
        r.user_id,
        r.product_id,
        r.scratch_code,
        r.report_description,
        r.report_status,
        r.report_date,
        p.product_name
      FROM FREPORT r
      LEFT JOIN PRODUCT p
        ON r.product_id = p.product_id
      WHERE r.user_id = ?
      ORDER BY r.report_date DESC, r.report_id DESC
    `;

    db.query(sql, [userId], (err, rows) => {
      if (err) {
        console.error("Customer reports:", err.message);

        return res.status(500).json({
          success: false,
          message: "Could not fetch your reports.",
        });
      }

      res.json({
        success: true,
        reports: rows,
      });
    });
  }
);

// SUBMIT NEW REPORT
router.post(
  "/reports",
  verifyToken,
  allowRoles("customer"),
  (req, res) => {
    const userId = req.user.user_id;

    const {
      product_name,
      scratch_code,
      seller,
      location,
      description,
    } = req.body;

    const code =
      typeof scratch_code === "string"
        ? scratch_code.trim().toUpperCase()
        : "";

    const details = buildDescription({
      product_name:
        typeof product_name === "string" ? product_name : "",
      description:
        typeof description === "string" ? description : "",
      seller:
        typeof seller === "string" ? seller : "",
      location:
        typeof location === "string" ? location : "",
    });

    if (!details.trim()) {
      return res.status(400).json({
        success: false,
        message: "Please provide complaint details.",
      });
    }

    findProductId(code, (findErr, productId) => {
      if (findErr) {
        console.error("Find product:", findErr.message);

        return res.status(500).json({
          success: false,
          message: "Could not process your report.",
        });
      }

      const sql = `
        INSERT INTO FREPORT
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
        sql,
        [userId, productId, code || null, details],
        (err, result) => {
          if (err) {
            console.error("Insert report:", err.message);

            return res.status(500).json({
              success: false,
              message: "Could not save your report.",
            });
          }

          res.status(201).json({
            success: true,
            message: "Your report was submitted successfully.",
            report_id: result.insertId,
            report_status: "pending",
          });
        }
      );
    });
  }
);

// EDIT ONLY OWN PENDING REPORT
router.put(
  "/reports/:id",
  verifyToken,
  allowRoles("customer"),
  (req, res) => {
    const userId = req.user.user_id;
    const reportId = Number(req.params.id);

    if (!Number.isInteger(reportId) || reportId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid report ID.",
      });
    }

    const {
      product_name,
      scratch_code,
      seller,
      location,
      description,
    } = req.body;

    const code =
      typeof scratch_code === "string"
        ? scratch_code.trim().toUpperCase()
        : "";

    const details = buildDescription({
      product_name:
        typeof product_name === "string" ? product_name : "",
      description:
        typeof description === "string" ? description : "",
      seller:
        typeof seller === "string" ? seller : "",
      location:
        typeof location === "string" ? location : "",
    });

    if (!details.trim()) {
      return res.status(400).json({
        success: false,
        message: "Please provide complaint details.",
      });
    }

    findProductId(code, (findErr, productId) => {
      if (findErr) {
        console.error("Find product:", findErr.message);

        return res.status(500).json({
          success: false,
          message: "Could not update your report.",
        });
      }

      const sql = `
        UPDATE FREPORT
        SET
          product_id = ?,
          scratch_code = ?,
          report_description = ?
        WHERE report_id = ?
          AND user_id = ?
          AND report_status = 'pending'
      `;

      db.query(
        sql,
        [productId, code || null, details, reportId, userId],
        (err, result) => {
          if (err) {
            console.error("Update report:", err.message);

            return res.status(500).json({
              success: false,
              message: "Could not update your report.",
            });
          }

          if (result.affectedRows === 0) {
            return res.status(404).json({
              success: false,
              message: "Report not found or no longer editable.",
            });
          }

          res.json({
            success: true,
            message: "Your report was updated successfully.",
          });
        }
      );
    });
  }
);

// DELETE ONLY OWN PENDING REPORT
router.delete(
  "/reports/:id",
  verifyToken,
  allowRoles("customer"),
  (req, res) => {
    const userId = req.user.user_id;
    const reportId = Number(req.params.id);

    if (!Number.isInteger(reportId) || reportId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid report ID.",
      });
    }

    const sql = `
      DELETE FROM FREPORT
      WHERE report_id = ?
        AND user_id = ?
        AND report_status = 'pending'
    `;

    db.query(sql, [reportId, userId], (err, result) => {
      if (err) {
        console.error("Delete report:", err.message);

        return res.status(500).json({
          success: false,
          message: "Could not delete your report.",
        });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          message: "Report not found or no longer deletable.",
        });
      }

      res.json({
        success: true,
        message: "Your report was deleted successfully.",
      });
    });
  }
);

export default router;
