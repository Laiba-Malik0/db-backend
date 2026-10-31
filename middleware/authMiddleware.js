
import jwt from "jsonwebtoken";

// VERIFY JWT TOKEN
export function verifyToken(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
            success: false,
            message: "Authentication token is required"
        });
    }

    const token = authHeader.substring(7).trim();

    if (!token) {
        return res.status(401).json({
            success: false,
            message: "Authentication token is required"
        });
    }

    if (!process.env.JWT_SECRET) {
        console.error("JWT_SECRET is not configured");

        return res.status(500).json({
            success: false,
            message: "Authentication service is not configured"
        });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        req.user = decoded;

        return next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: "Invalid or expired token"
        });
    }
}

// CHECK USER ROLE
export function allowRoles(...roles) {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: "You do not have permission to access this resource"
            });
        }

        return next();
    };
}
