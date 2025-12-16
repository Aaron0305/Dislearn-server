    import express from 'express';
    import mongoose from 'mongoose';
    import cors from 'cors';
    import passport from 'passport';
    import session from 'express-session';
    import MongoStore from 'connect-mongo';
    import dotenv from 'dotenv';
    import authRoutes from './routes/auth.js';
    import estadosRoutes from './routes/estados.js';
    import progressRoutes from './routes/progress.js';
    import { seedEstadosYMunicipios } from './config/seedEstados.js';
    import './config/passport.js';

    // Cargar variables de entorno
    dotenv.config();

    const app = express();
    const PORT = process.env.PORT || 3001;

    const isVercel = Boolean(process.env.VERCEL);
    // Cookies seguras solo cuando el runtime es HTTPS (Vercel) o si el usuario fuerza la opción
    const useSecureCookies = isVercel || process.env.COOKIE_SECURE === 'true';

    // Requerido para que Express detecte HTTPS detrás de proxy (Vercel)
    if (useSecureCookies) {
    app.set('trust proxy', 1);
    }

    const allowedOrigins = [
    process.env.CLIENT_URL_LOCAL || 'http://localhost:5173',
    process.env.CLIENT_URL_PROD,
    process.env.CLIENT_URL,
    'http://localhost:5173'
    ].filter(Boolean);

    // Middleware
    app.use(express.json());

    // ✅ CORS (local + producción por env)
    app.use(cors({
    origin(origin, callback) {
        // Permite llamadas server-to-server / curl (sin Origin)
        if (!origin) return callback(null, true);

        if (allowedOrigins.includes(origin)) return callback(null, true);

        return callback(new Error(`CORS bloqueado para el origen: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
    }));

    // Configuración de sesión
    app.use(session({
    secret: process.env.SESSION_SECRET || 'TU_SECRET_DE_SESION',
    resave: false,
    saveUninitialized: false,
    store: process.env.MONGO_URI
        ? MongoStore.create({
            mongoUrl: process.env.MONGO_URI,
            collectionName: 'sessions',
            ttl: 14 * 24 * 60 * 60,
        })
        : undefined,
    cookie: {
        secure: useSecureCookies,
        maxAge: 24 * 60 * 60 * 1000,
        sameSite: useSecureCookies ? 'none' : 'lax'
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
    app.use('/api/progress', progressRoutes);

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
    if (!isVercel) {
    app.listen(PORT, () => {
        console.log(`Servidor corriendo en puerto ${PORT}`);
        const callbackUrl =
        process.env.NODE_ENV === 'production'
            ? (process.env.GOOGLE_CALLBACK_URL_PROD || process.env.GOOGLE_CALLBACK_URL)
            : process.env.GOOGLE_CALLBACK_URL;

        console.log(
        `URL de callback OAuth: ${callbackUrl || 'http://localhost:3001/auth/google/callback'}`
        );
    }); 
    }