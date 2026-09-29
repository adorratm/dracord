import { IsOptional, IsString } from 'class-validator';

export class AppleAuthDto {
  @IsString()
  idToken!: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  displayName?: string;
}
