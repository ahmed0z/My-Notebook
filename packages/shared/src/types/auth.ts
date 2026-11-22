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
