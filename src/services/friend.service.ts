// services/friend.service.ts

// Mantenemos aquí la simulación de la base de datos, totalmente oculta al controlador
const mockDb = {
  Friends: {
    getConfirmedFriends: async (userId: string) => [
      { id: 'u_456', username: 'PlayerDos', status: 'online' },
      { id: 'u_789', username: 'GamerX', status: 'offline' },
    ],
    getPendingRequests: async (userId: string) => [
      {
        id: 'req_001',
        fromUserId: 'u_999',
        fromUsername: 'Ninja',
        createdAt: '2026-03-01T10:00:00Z',
      },
    ],
    checkRelationshipStatus: async (userA: string, userB: string) => {
      return 'none';
    },
    createRequest: async (fromUserId: string, toUserId: string) => ({
      id: `req_${Date.now()}`,
      fromUserId,
      toUserId,
      status: 'pending',
    }),
    findRequestById: async (requestId: string) => {
      if (requestId === 'req_001') {
        return {
          id: 'req_001',
          fromUserId: 'u_999',
          toUserId: 'u_123',
          status: 'pending',
        };
      }
      return null;
    },
    updateRequestStatus: async (
      requestId: string,
      status: 'accepted' | 'rejected',
    ) => true,
    createBidirectionalFriendship: async (userA: string, userB: string) => true,
    removeBidirectionalFriendship: async (userA: string, userB: string) => true,
  },
};

// Exportamos un servicio que encapsula las llamadas al mockDb
export const FriendService = {
  getConfirmedFriends: async (userId: string) => {
    return await mockDb.Friends.getConfirmedFriends(userId);
  },

  getPendingRequests: async (userId: string) => {
    return await mockDb.Friends.getPendingRequests(userId);
  },

  checkRelationshipStatus: async (userId: string, targetUserId: string) => {
    return await mockDb.Friends.checkRelationshipStatus(userId, targetUserId);
  },

  createFriendRequest: async (fromUserId: string, toUserId: string) => {
    return await mockDb.Friends.createRequest(fromUserId, toUserId);
  },

  findRequestById: async (requestId: string) => {
    return await mockDb.Friends.findRequestById(requestId);
  },

  acceptFriendRequest: async (
    requestId: string,
    fromUserId: string,
    toUserId: string,
  ) => {
    await mockDb.Friends.updateRequestStatus(requestId, 'accepted');
    await mockDb.Friends.createBidirectionalFriendship(fromUserId, toUserId);
  },

  rejectFriendRequest: async (requestId: string) => {
    await mockDb.Friends.updateRequestStatus(requestId, 'rejected');
  },

  removeFriend: async (userId: string, friendId: string) => {
    return await mockDb.Friends.removeBidirectionalFriendship(userId, friendId);
  },
};
