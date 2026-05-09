const connectedUserIds = new Set<string>();

export const socketPresenceRegistry = {
  markConnected(userId: string): void {
    connectedUserIds.add(userId);
  },

  markDisconnected(userId: string): void {
    connectedUserIds.delete(userId);
  },

  isConnected(userId: string): boolean {
    return connectedUserIds.has(userId);
  },

  hasAnyConnectedUser(userIds: string[]): boolean {
    return userIds.some((userId) => connectedUserIds.has(userId));
  },

  reset(): void {
    connectedUserIds.clear();
  },
};
