// services/friend.service.ts

import { Friendship_States } from '@prisma/client';

import { prisma } from '../infrastructure/prisma';

export const FriendService = {
  getConfirmedFriends: async (u_id: string) => {
    const id_user = parseInt(u_id.replace('u_', ''));

    const friendships = await prisma.friendships.findMany({
      where: {
        state: Friendship_States.FRIEND,
        OR: [{ id_user_1: id_user }, { id_user_2: id_user }],
      },
      include: {
        user_1: true,
        user_2: true,
      },
    });

    return friendships.map((friendship) => {
      const friend =
        friendship.id_user_1 === id_user
          ? friendship.user_2
          : friendship.user_1;

      return {
        id: `u_${friend.id_user}`,
        username: friend.username,
        status: friend.state,
      };
    });
  },

  // Obtener solicitudes enviadas hacia el usuario (pendientes de aceptar)
  getPendingRequests: async (u_id: string) => {
    const id_user = parseInt(u_id.replace('u_', ''));

    const pending = await prisma.friendships.findMany({
      where: {
        id_user_2: id_user,
        state: Friendship_States.PENDING,
      },
    });

    return pending.map((friendship) => ({
      id: `req_${friendship.id_user_1}_${friendship.id_user_2}`,
      fromUserId: `u_${friendship.id_user_1}`,
      toUserId: `u_${friendship.id_user_2}`,
      createdAt: friendship.beggining_date,
    }));
  },

  checkRelationshipStatus: async (u_id: string, target_u_id: string) => {
    const id_user_1 = parseInt(u_id.replace('u_', ''));
    const id_user_2 = parseInt(target_u_id.replace('u_', ''));

    const friendship = await prisma.friendships.findFirst({
      where: {
        OR: [
          { id_user_1: id_user_1, id_user_2: id_user_2 },
          { id_user_2: id_user_2, id_user_1: id_user_1 },
        ],
      },
    });

    if (!friendship) return null;

    return friendship.state;
  },

  createFriendRequest: async (from_u_id: string, to_u_id: string) => {
    const id_from_u = parseInt(from_u_id.replace('u_', ''));
    const id_to_u = parseInt(to_u_id.replace('u_', ''));

    const newFriendship = await prisma.friendships.create({
      data: {
        id_user_1: id_from_u,
        id_user_2: id_to_u,
        state: Friendship_States.PENDING,
      },
    });

    return {
      id: `req_${newFriendship.id_user_1}_${newFriendship.id_user_2}`,
      fromUserId: `u_${newFriendship.id_user_1}`,
      toUserId: `u_${newFriendship.id_user_2}`,
    };
  },

  findRequestById: async (req_id: string) => {
    // Limpiamos el prefijo y dividimos por el guion bajo
    const parts = req_id.replace('r_', '').split('_');

    if (parts.length !== 2) return null;

    const id_user_1 = parseInt(parts[0]);
    const id_user_2 = parseInt(parts[1]);

    const request = await prisma.friendships.findUnique({
      where: {
        id_user_1_id_user_2: {
          id_user_1: id_user_1,
          id_user_2: id_user_2,
        },
      },
      include: {
        user_1: true,
        user_2: true,
      },
    });

    if (!request) return null;

    return {
      id: `req_${request.id_user_1}_${request.id_user_2}`,
      fromUserId: `u_${request.id_user_1}`,
      toUserId: `u_${request.id_user_2}`,
      status: request.state,
      createdAt: request.beggining_date,
    };
  },

  acceptFriendRequest: async (req_id: string) => {
    const parts = req_id.replace('r_', '').split('_');

    if (parts.length !== 2) return null;

    const id_user_1 = parseInt(parts[0]);
    const id_user_2 = parseInt(parts[1]);

    await prisma.friendships.update({
      where: {
        id_user_1_id_user_2: {
          id_user_1: id_user_1,
          id_user_2: id_user_2,
        },
      },
      data: { state: Friendship_States.FRIEND },
    });

    return;
  },

  removeFriend: async (u_id: string, f_id: string) => {
    const id_user = parseInt(u_id.replace('u_', ''));
    const id_user_friend = parseInt(f_id.replace('u_', ''));

    const result = await prisma.friendships.deleteMany({
      where: {
        OR: [
          { id_user_1: id_user, id_user_2: id_user_friend },
          { id_user_1: id_user_friend, id_user_2: id_user },
        ],
      },
    });

    return result.count > 0;
  },

  rejectFriendRequest: async (req_id: string) => {
    const parts = req_id.replace('r_', '').split('_');

    if (parts.length !== 2) return null;

    const id_user_1 = parseInt(parts[0]);
    const id_user_2 = parseInt(parts[1]);

    const result = await prisma.friendships.delete({
      where: {
        id_user_1_id_user_2: {
          id_user_1: id_user_1,
          id_user_2: id_user_2,
        },
      },
    });

    if (!result) return false;

    return true;
  },
};
