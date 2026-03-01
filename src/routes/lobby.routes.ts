// routes/lobby.routes.ts
import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { createLobby, getPublicLobbies, getLobbyByCode } from '../controllers/lobby.controller';

const router = Router();

router.use(authMiddleware);

router.post('/', createLobby);
router.get('/', getPublicLobbies); 
router.get('/:lobbyCode', getLobbyByCode); // Búsqueda exacta por código

export default router;