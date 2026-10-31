
import dotenv from "dotenv";
import express from "express";
import cors from "cors";

import db from "./config/db.js";

import authRoutes from "./routes/auth.js";
import productRoutes from "./routes/products.js";
import brandRoutes from "./routes/brands.js";
import batchRoutes from "./routes/batches.js";
import scratchCodeRoutes from "./routes/scratchCodes.js";
import verificationRoutes from "./routes/verification.js";
import distributorRoutes from "./routes/distributors.js";
import retailerRoutes from "./routes/retailers.js";
import transferRoutes from "./routes/transfers.js";
import reportsRoutes from "./routes/reports.js";
import customerRoutes from "./routes/customer.js";

dotenv.config();

const app = express();

// Middleware
app.use(cors({
    origin: process.env.FRONTEND_URL
        ? process.env.FRONTEND_URL.split(",").map(url => url.trim())
        : true,
    credentials: true
}));

app.use(express.json({ limit: "1mb" }));

// API Routes — existing endpoints preserved
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/brands", brandRoutes);
app.use("/api/batches", batchRoutes);
app.use("/api/scratch-codes", scratchCodeRoutes);
app.use("/api/verification", verificationRoutes);
app.use("/api/distributors", distributorRoutes);
app.use("/api/retailers", retailerRoutes);
app.use("/api/transfers", transferRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/customer", customerRoutes);

// Root route
app.get("/", (req, res) => {
    res.status(200).send("VerifyChain Backend is Running!");
});

// Database health check
app.get("/test-db", (req, res) => {
    db.query("SELECT 1 AS test", (err, results) => {
        if (err) {
            console.error("Database health check failed:", err.message);

            return res.status(500).json({
                success: false,
                message: "Database query failed"
            });
        }

        return res.status(200).json({
            success: true,
            message: "MySQL database connected successfully!",
            result: results
        });
    });
});

// Handle unknown API routes
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: "API route not found"
    });
});

// General error handler
app.use((err, req, res, next) => {
    console.error("Backend error:", err);

    if (res.headersSent) {
        return next(err);
    }

    return res.status(500).json({
        success: false,
        message: "Internal server error"
    });
});

// Local development server only.
// Vercel will import and handle the exported Express app.
if (!process.env.VERCEL) {
    const PORT = process.env.PORT || 5000;

    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}

export default app;
