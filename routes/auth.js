    import express from 'express';
    import passport from 'passport';
    import bcrypt from 'bcryptjs';
    import User from '../models/User.js';

    const router = express.Router();

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
        
        res.redirect(`http://localhost:5173/login?token=${token}&user=${encodeURIComponent(userObj)}`);
    }
    );

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
        
        res.status(201).json({ 
        message: 'Usuario registrado correctamente',
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
        return res.json({ 
            message: 'Login exitoso', 
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