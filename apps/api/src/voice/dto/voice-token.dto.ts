import { IsOptional, IsString } from 'class-validator';

export class VoiceTokenDto {
  @IsString()
  channelId!: string;

  @IsOptional()
  @IsString()
  password?: string;

  /** İstemci örneği — tek aktif LiveKit oturumu için */
  @IsOptional()
  @IsString()
  clientId?: string;

  @IsOptional()
  @IsString()
  platform?: string;
}
