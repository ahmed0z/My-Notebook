export interface AuthResponseDto {
  token: string;
  username: string;
  email?: string | null;
  avatarUrl?: string | null;
  isInitialSetup?: boolean;
}

export interface SetupRequestDto {
  username: string;
  passwordHash: string;
}

export interface LoginRequestDto {
  username: string;
  passwordHash: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

export interface UserProfileDto {
  id: string;
  username: string;
  email?: string | null;
  avatarUrl?: string | null;
  createdAt: string;
}

export interface UpdateProfileRequestDto {
  username?: string;
  avatarUrl?: string | null;
  email?: string | null;
}
