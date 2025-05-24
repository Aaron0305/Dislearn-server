    import express from 'express';
    import mongoose from 'mongoose';
    import cors from 'cors';
    import passport from 'passport';
    import session from 'express-session';
    import dotenv from 'dotenv';
    import authRoutes from './routes/auth.js';
    import estadosRoutes from './routes/estados.js';
    import { seedEstadosYMunicipios } from './config/seedEstados.js';
    import './config/passport.js';

    // Cargar variables de entorno
    dotenv.config();

    const app = express();
    const PORT = process.env.PORT || 3001;

    // Middleware
    app.use(express.json());

    // ✅ CORS corregido para producción
    app.use(cors({
    origin: [
        'https://dislearn-client-92ur.vercel.app',
        'http://localhost:5173'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
    }));

    // Configuración de sesión
    app.use(session({
    secret: process.env.SESSION_SECRET || 'TU_SECRET_DE_SESION',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000,
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
    }
    }));

    // Inicializar Passport
    app.use(passport.initialize());
    app.use(passport.session());

    // ✅ Conectar a MongoDB con mejor manejo de errores
    mongoose.connect(process.env.MONGO_URI)
    .then(async () => {
        console.log('Conectado a MongoDB');
        try {
        await seedEstadosYMunicipios();
        } catch (error) {
        console.log('Error al cargar estados:', error.message);
        }
    })
    .catch(err => console.error('Error de conexión a MongoDB:', err));

    // Configuración de rutas
    app.use('/auth', authRoutes);
    app.use('/api/estados', estadosRoutes);

    // ✅ Ruta de prueba mejorada
    app.get('/', (req, res) => {
    res.json({
        message: 'Servidor de DislexiaKids funcionando correctamente',
        environment: process.env.NODE_ENV,
        timestamp: new Date().toISOString()
    });
    });

    // ✅ Ruta de health check
    app.get('/health', (req, res) => {
    res.json({ status: 'OK', uptime: process.uptime() });
    });

    // ✅ Manejo de errores global
    app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ 
        message: 'Algo salió mal!',
        error: process.env.NODE_ENV === 'development' ? err.message : {}
    });
    });

    // ✅ Exportar ANTES de listen (importante para Vercel)
    export default app;

    // Solo iniciar servidor si no estamos en Vercel
    if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`Servidor corriendo en puerto ${PORT}`);
        console.log(`URL de callback OAuth: ${process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3001/auth/google/callback'}`); http://localhost:3001/auth/google/callback
    }); 
    }