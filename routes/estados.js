    import express from 'express';
    import EstadosYMunicipios from '../models/EstadosYmunicipios.js';

    const router = express.Router();

    router.get('/', async (req, res) => {
    try {
        const estados = await EstadosYMunicipios.find();
        res.json(estados);
    } catch (error) {
        console.error('Error en GET /api/estados:', error.message);
        res.status(500).json({ message: 'Error al obtener estados y municipios', error: error.message });
    }
    });

    export default router;
