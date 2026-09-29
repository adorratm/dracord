import { IsOptional, IsString } from 'class-validator';

export class VoiceTokenDto {
  @IsString()
  channelId!: string;

  @IsOptional()
  @IsString()
  password?: string;
}
