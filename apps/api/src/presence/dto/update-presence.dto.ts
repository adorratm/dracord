import { IsEnum } from 'class-validator';
import { UserStatus } from '../../database/enums';

export class UpdatePresenceDto {
  @IsEnum(UserStatus)
  status!: UserStatus;
}
