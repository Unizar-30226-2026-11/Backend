// routes/friend.routes.ts
import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { 
    getFriends, 
    getPendingRequests, 
    sendRequest, 
    respondToRequest, 
    removeFriend 
} from '../controllers/friend.controller';

const router = Router();

router.use(authMiddleware);

router.get('/', getFriends);
router.get('/requests', getPendingRequests);
router.post('/requests', sendRequest);
router.put('/requests/:requestId', respondToRequest); // accept o reject
router.delete('/:friendId', removeFriend);

export default router;