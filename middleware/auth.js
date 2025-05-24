    import jwt from 'jsonwebtoken';
    import asyncHandler from 'express-async-handler';
    import User from '../models/User.js';
    import passport from 'passport';

    // Middleware para proteger rutas con JWT
    export const protect = asyncHandler(async (req, res, next) => {
    let token;

    // Verificar token en headers
    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer')
    ) {
        try {
        // Obtener token del header
        token = req.headers.authorization.split(' ')[1];

        // Verificar token
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'mi_secreto_muy_seguro');

        // Obtener usuario del token
        req.user = await User.findById(decoded.id).select('-password');

        next();
        } catch (error) {
        console.error(error);
        res.status(401);
        throw new Error('No autorizado, token fallido');
        }
    }

    if (!token) {
        res.status(401);
        throw new Error('No autorizado, no hay token');
    }
    });

    // Middleware para verificar roles
    export const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
        res.status(401);
        throw new Error('No autorizado, por favor inicie sesión');
        }
        
        if (!roles.includes(req.user.role)) {
        res.status(403);
        throw new Error('No tiene permiso para acceder a este recurso');
        }
        
        next();
    };
    };