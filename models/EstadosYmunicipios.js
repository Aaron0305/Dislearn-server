    import mongoose from 'mongoose';

    const EstadosYMunicipiosSchema = new mongoose.Schema({
    estado: {
        type: String,
        required: true,
        unique: true,
    },
    municipios: {
        type: [String],
        required: true,
    }
    });

    const EstadosYMunicipios = mongoose.model('EstadosYMunicipios', EstadosYMunicipiosSchema);
    export default EstadosYMunicipios;
