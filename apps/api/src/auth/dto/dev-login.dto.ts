import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class DevLoginDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  username?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  displayName?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;
}

