    import jwt from 'jsonwebtoken';
    import User from '../models/User.js';
    import asyncHandler from 'express-async-handler';
    import passport from 'passport';

    // Generar Token JWT
    const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET || 'mi_secreto_muy_seguro', {
        expiresIn: '30d',
    });
    };

    // @desc    Registrar nuevo usuario
    // @route   POST /api/auth/register
    // @access  Public
    export const registerUser = asyncHandler(async (req, res) => {
    const { email, password, nombre, direccion } = req.body;

    // Verificar que se proporcionen los campos necesarios
    if (!email || !password || !nombre) {
        res.status(400);
        throw new Error('Por favor complete todos los campos requeridos');
    }

    // Verificar si el usuario ya existe
    const userExists = await User.findOne({ email });

    if (userExists) {
        res.status(400);
        throw new Error('El usuario ya existe');
    }

    // Crear el usuario
    const user = await User.create({
        nombre,
        email,
        password,
        direccion,
    });

    if (user) {
        // Generar token
        const token = generateToken(user._id);

        res.status(201).json({
        _id: user._id,
        nombre: user.nombre,
        email: user.email,
        role: user.role,
        token,
        });
    } else {
        res.status(400);
        throw new Error('Datos de usuario inválidos');
    }
    });

    // @desc    Autenticar usuario y obtener token
    // @route   POST /api/auth/login
    // @access  Public
    export const loginUser = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    // Verificar que se proporcionen email y password
    if (!email || !password) {
        res.status(400);
        throw new Error('Por favor proporcione email y contraseña');
    }

    // Buscar usuario
    const user = await User.findOne({ email }).select('+password');

    // Verificar si el usuario existe y la contraseña es correcta
    if (user && (await user.matchPassword(password))) {
        // Generar token
        const token = generateToken(user._id);

        res.json({
        _id: user._id,
        nombre: user.nombre,
        email: user.email,
        role: user.role,
        token,
        });
    } else {
        res.status(401);
        throw new Error('Email o contraseña incorrectos');
    }
    });

    // @desc    Ruta para iniciar el flujo de autenticación con Google
    // @route   GET /api/auth/google
    // @access  Public
    export const googleAuth = (req, res, next) => {
    passport.authenticate('google', { 
        scope: ['profile', 'email'] 
    })(req, res, next);
    };

    // @desc    Callback para Google OAuth
    // @route   GET /api/auth/google/callback
    // @access  Public
    export const googleCallback = (req, res, next) => {
    passport.authenticate('google', { session: false }, (err, user) => {
        if (err) {
        return res.redirect('/login?error=google_auth_failed');
        }
        
        if (!user) {
        return res.redirect('/login?error=no_user_found');
        }

        // Generar token
        const token = generateToken(user._id);

        // Redirigir al frontend con el token
        return res.redirect(`/auth/success?token=${token}`);
    })(req, res, next);
    };

    // @desc    Obtener datos del usuario actual
    // @route   GET /api/auth/me
    // @access  Private
    export const getMe = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);

    if (user) {
        res.json({
        _id: user._id,
        nombre: user.nombre,
        email: user.email,
        direccion: user.direccion,
        role: user.role,
        });
    } else {
        res.status(404);
        throw new Error('Usuario no encontrado');
    }
    });