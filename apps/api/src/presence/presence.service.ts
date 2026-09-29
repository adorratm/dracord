import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import type { PublicUser } from '@dracord/types';
import { toPublicUser } from '../common/user.mapper';
import { User } from '../database/entities/user.entity';
import { UserStatus } from '../database/enums';

@Injectable()
export class PresenceService {
  constructor(private readonly em: EntityManager) {}

  async updateStatus(userId: string, status: UserStatus): Promise<PublicUser> {
    const user = await this.em.findOneOrFail(User, { where: { id: userId } });
    user.status = status;
    const updated = await this.em.save(User, user);
    return toPublicUser(updated);
  }

  async getStatus(userId: string): Promise<PublicUser> {
    const user = await this.em.findOneOrFail(User, { where: { id: userId } });
    return toPublicUser(user);
  }
}
