export interface AuthResponseDto {
  token: string;
  username: string;
  isInitialSetup: boolean;
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

