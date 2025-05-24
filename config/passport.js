    import passport from 'passport';
    import { Strategy as LocalStrategy } from 'passport-local';
    import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
    import bcrypt from 'bcryptjs';
    import dotenv from 'dotenv';
    import User from '../models/User.js';

    dotenv.config();

    // Estrategia Local
    passport.use(new LocalStrategy(
    { usernameField: 'email' },
    async (email, password, done) => {
        try {
        const user = await User.findOne({ email });
        
        if (!user) {
            return done(null, false, { message: 'Email no registrado' });
        }
        
        if (!user.password) {
            return done(null, false, { message: 'Esta cuenta utiliza autenticación con Google' });
        }
        
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return done(null, false, { message: 'Contraseña incorrecta' });
        }
        
        return done(null, user);
        } catch (err) {
        return done(err);
        }
    }
    ));

    // Estrategia Google OAuth
    if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(new GoogleStrategy(
        {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3001/auth/google/callback',
        scope: ['profile', 'email']
        },
        async (accessToken, refreshToken, profile, done) => {
        try {
            // Buscar si el usuario ya existe
            let user = await User.findOne({ googleId: profile.id });
            
            // Si no existe, crear un nuevo usuario
            if (!user) {
            user = new User({
                googleId: profile.id,
                email: profile.emails[0].value,
                nombre: profile.displayName,
                // No necesita contraseña al ser autenticación con Google
            });
            await user.save();
            }
            
            return done(null, user);
        } catch (err) {
            return done(err);
        }
        }
    ));
    } else {
    console.warn('Google OAuth no configurada. Variables de entorno faltantes.');
    }

    // Serializar y deserializar usuario
    passport.serializeUser((user, done) => {
    done(null, user.id);
    });

    passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (err) {
        done(err);
    }
    });

    export default passport;