import { GAME_CHANNEL_KINDS, type GameChannelKind } from '@dracord/types';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

const CHANNEL_TYPES = ['TEXT', 'VOICE', 'FORUM', 'GAME', 'WATCH_PARTY'] as const;

export class CreateChannelDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsIn(CHANNEL_TYPES)
  type!: (typeof CHANNEL_TYPES)[number];

  @IsOptional()
  @ValidateIf((_, v) => v != null && v !== '')
  @IsString()
  categoryId?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v != null)
  @IsString()
  @MaxLength(1024)
  topic?: string | null;

  /** GAME için zorunlu — servis katmanında da doğrulanır (trivia/words dahil) */
  @IsOptional()
  @Transform(({ value }) => {
    if (value == null || value === '') return value ?? null;
    return typeof value === 'string' ? value.trim().toLowerCase() : value;
  })
  @ValidateIf((_, v) => v != null && v !== '')
  @IsIn([...GAME_CHANNEL_KINDS])
  gameKind?: GameChannelKind | null;
}
