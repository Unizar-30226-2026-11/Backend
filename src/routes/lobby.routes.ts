// routes/lobby.routes.ts
import { Router } from 'express';

import { createLobby, getLobbyByCode, getPublicLobbies } from '../controllers';
import { validateCreateLobbyBody, validateIdParam } from '../middlewares';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);

router.post('/', validateCreateLobbyBody, createLobby);
router.get('/', getPublicLobbies);
router.get('/:lobbyCode', validateIdParam('lobbyCode'), getLobbyByCode); // Búsqueda exacta por código

export default router;
