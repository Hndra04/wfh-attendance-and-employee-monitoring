import { Request } from 'express';

import { UserRole } from '../database/entities/user.entity';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
  mustChangePassword: boolean;
  employee: {
    id: string;
    fullName: string;
    department: string;
    position: string;
  } | null;
}

export interface AuthRequestUser extends Request {
  user: AuthenticatedUser;
}

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: AuthenticatedUser;
}
