// routes/friend.routes.ts
import { Router } from 'express';

import {
  getFriends,
  getPendingRequests,
  removeFriend,
  respondToRequest,
  sendRequest,
} from '../controllers';
import {
  authenticate,
  validateIdParam,
  validateRespondRequestBody,
  validateSendRequestBody,
} from '../middlewares';

const router = Router();

router.use(authenticate);

router.get('/', getFriends);
router.get('/requests', getPendingRequests);
router.post('/requests', validateSendRequestBody, sendRequest);
router.put(
  '/requests/:requestId',
  validateIdParam('requestId'),
  validateRespondRequestBody,
  respondToRequest,
); // accept o reject
router.delete('/:friendId', validateIdParam('friendId'), removeFriend);

export default router;
