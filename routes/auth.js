    import express from 'express';
    import passport from 'passport';
    import bcrypt from 'bcryptjs';
    import User from '../models/User.js';
    import jwt from 'jsonwebtoken';

    const router = express.Router();

    const getClientRedirectUrl = () => {
        return (
            process.env.CLIENT_URL_PROD ||
            process.env.CLIENT_URL_LOCAL ||
            process.env.CLIENT_URL ||
            'http://localhost:5173'
        ).replace(/\/+$/, '');
    };

    // Google OAuth routes
    router.get('/google/login', passport.authenticate('google', { 
    scope: ['profile', 'email'] 
    }));

    router.get('/google/callback', 
    passport.authenticate('google', { 
        failureRedirect: '/login',
        session: true
    }),
    (req, res) => {
        const token = req.user.generateAuthToken ? req.user.generateAuthToken() : '';
        const userObj = JSON.stringify({
        id: req.user._id,
        email: req.user.email,
        nombre: req.user.nombre
        });

                const clientUrl = getClientRedirectUrl();
                res.redirect(`${clientUrl}/login?token=${token}&user=${encodeURIComponent(userObj)}`);
    }
    );

        // Verificar sesión actual
        router.get('/me', (req, res) => {
            if (typeof req.isAuthenticated === 'function' && req.isAuthenticated() && req.user) {
                return res.json({
                    id: req.user._id,
                    email: req.user.email,
                    nombre: req.user.nombre,
                });
            }

            // Fallback por Bearer token
            const authHeader = req.headers.authorization;
            if (authHeader && authHeader.startsWith('Bearer ')) {
                try {
                    const token = authHeader.split(' ')[1];
                    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'tu_jwt_secret');
                    const userId = decoded?.id || decoded?._id;
                    if (!userId) return res.status(401).json({ message: 'No autenticado' });

                    return User.findById(userId)
                        .then((u) => {
                            if (!u) return res.status(401).json({ message: 'No autenticado' });
                            return res.json({ id: u._id, email: u.email, nombre: u.nombre });
                        })
                        .catch(() => res.status(401).json({ message: 'No autenticado' }));
                } catch {
                    return res.status(401).json({ message: 'No autenticado' });
                }
            }

            return res.status(401).json({ message: 'No autenticado' });
        });

        // Cerrar sesión
        router.post('/logout', (req, res, next) => {
            req.logout((err) => {
                if (err) return next(err);
                req.session?.destroy(() => {
                    res.clearCookie('connect.sid');
                    return res.json({ message: 'Logout exitoso' });
                });
            });
        });

    // Local authentication routes
    router.post('/register', async (req, res) => {
    const { email, password, nombre, direccion } = req.body;
    
    try {
        const userExist = await User.findOne({ email });
        if (userExist) return res.status(400).json({ message: 'El usuario ya existe' });
        
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const newUser = new User({
        email,
        password: hashedPassword,
        nombre,
        direccion
        });
        
        await newUser.save();

        const token = newUser.generateAuthToken ? newUser.generateAuthToken() : '';
        
        res.status(201).json({ 
        message: 'Usuario registrado correctamente',
        token,
        user: {
            id: newUser._id,
            email: newUser.email,
            nombre: newUser.nombre
        }
        });
    } catch (err) {
        res.status(500).json({ message: 'Error en el registro', error: err.message });
    }
    });

    router.post('/login', (req, res, next) => {
    passport.authenticate('local', (err, user, info) => {
        if (err) return next(err);
        if (!user) return res.status(400).json({ message: info.message });
        
        req.logIn(user, (err) => {
        if (err) return next(err);
        const token = user.generateAuthToken ? user.generateAuthToken() : '';
        return res.json({ 
            message: 'Login exitoso', 
            token,
            user: { 
            id: user._id, 
            email: user.email,
            nombre: user.nombre
            }
        });
        });
    })(req, res, next);
    });

    export default router;