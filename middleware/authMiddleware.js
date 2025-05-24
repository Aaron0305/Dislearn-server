    // middleware/authMiddleware.js
    import jwt from 'jsonwebtoken';
    import dotenv from 'dotenv';

    dotenv.config();

    export const protect = (req, res, next) => {
    // Get token from header
    const authHeader = req.headers.authorization;
    
    // Check if no token
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'No token, authorization denied' });
    }

    // Verify token
    try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Add user from payload
        req.user = decoded;
        next();
    } catch (err) {
        res.status(401).json({ message: 'Token is not valid' });
    }
    };

    export const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
        return res.status(403).json({ 
            message: `Access denied: ${roles.join('/')} role required` 
        });
        }
        next();
    };
    };

    export const isAdmin = (req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied: Admin privileges required' });
    }
    next();
    };

    export const isInstructor = (req, res, next) => {
    if (!req.user || (req.user.role !== 'instructor' && req.user.role !== 'admin')) {
        return res.status(403).json({ message: 'Access denied: Instructor privileges required' });
    }
    next();
    };