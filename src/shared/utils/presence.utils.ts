import { User_States } from '@prisma/client';

export const EDITABLE_USER_STATUSES = [
  User_States.DISCONNECTED,
  User_States.CONNECTED,
] as const;

export type EditableUserStatus = (typeof EDITABLE_USER_STATUSES)[number];

export const isEditableUserStatus = (
  status: unknown,
): status is EditableUserStatus =>
  typeof status === 'string' &&
  EDITABLE_USER_STATUSES.includes(status as EditableUserStatus);

export const normalizePresenceForClient = (
  status: User_States | null | undefined,
): EditableUserStatus => {
  if (status === User_States.CONNECTED) {
    return User_States.CONNECTED;
  }

  return User_States.DISCONNECTED;
};
