    import mongoose from 'mongoose';
    import jwt from 'jsonwebtoken';

    const DireccionSchema = new mongoose.Schema({
    estado: {
        type: String,
        required: true
    },
    municipio: {
        type: String,
        required: true
    },
    colonia: {
        type: String,
        required: true
    },
    calle: {
        type: String,
        required: true
    },
    numero: {
        type: String,
        required: true
    }
    });

    const UserSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: function() {
        // Password es requerido solo si no es un usuario de Google
        return this.googleId === undefined;
        }
    },
    nombre: {
        type: String,
        required: true
    },
    googleId: {
        type: String,
        unique: true,
        sparse: true
    },
    direccion: {
        type: DireccionSchema,
        required: function() {
        // Dirección es requerida solo si no es un usuario de Google
        return this.googleId === undefined;
        }
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
    });

    // Generar un token JWT para autenticación
    UserSchema.methods.generateAuthToken = function() {
    const token = jwt.sign(
        { 
        id: this._id,
        email: this.email
        },
        process.env.JWT_SECRET || 'tu_jwt_secret',
        { expiresIn: '7d' }
    );
    return token;
    };

    const User = mongoose.model('User', UserSchema);
    export default User;