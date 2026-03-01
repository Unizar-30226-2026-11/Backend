// routes/index.ts
import { Router } from 'express';
import authRoutes from './auth.routes';
import userRoutes from './user.routes';
import friendRoutes from './friend.routes';
import lobbyRoutes from './lobby.routes';
import shopRoutes from './shop.routes';
import collectionRoutes from './collection.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/friends', friendRoutes);
router.use('/lobbies', lobbyRoutes);
router.use('/shop', shopRoutes);
router.use('/collections', collectionRoutes);

export default router;
