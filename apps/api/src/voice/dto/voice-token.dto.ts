import { IsString } from 'class-validator';

export class VoiceTokenDto {
  @IsString()
  channelId!: string;
}
