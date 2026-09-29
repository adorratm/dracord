import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager, IsNull } from 'typeorm';
import type { MessageAttachment, MessageDto } from '@dracord/types';
import { toPublicUser } from '../common/user.mapper';
import { ChannelsService } from '../channels/channels.service';
import { Message } from '../database/entities/message.entity';
import { User } from '../database/entities/user.entity';

@Injectable()
export class MessagesService {
  constructor(
    private readonly em: EntityManager,
    private readonly channels: ChannelsService,
  ) {}

  async listChannelMessages(
    channelId: string,
    userId: string,
    limit = 50,
  ): Promise<MessageDto[]> {
    await this.channels.getChannel(channelId, userId);
    const messages = await this.em.find(Message, {
      where: { channelId, deletedAt: IsNull() },
      relations: { author: true },
      order: { createdAt: 'DESC' },
      take: limit,
    });
    return messages.reverse().map((m) => this.toDto(m));
  }

  async createMessage(
    channelId: string,
    userId: string,
    content: string,
    attachments?: MessageAttachment[],
  ): Promise<MessageDto> {
    await this.channels.getChannel(channelId, userId);
    const trimmed = content.trim();
    if (!trimmed && (!attachments || attachments.length === 0)) {
      throw new BadRequestException('Mesaj boş olamaz');
    }
    const saved = await this.em.save(
      Message,
      this.em.create(Message, {
        channelId,
        authorId: userId,
        content: trimmed || ' ',
        attachments: attachments?.length ? attachments : null,
      }),
    );
    const message = await this.em.findOneOrFail(Message, {
      where: { id: saved.id },
      relations: { author: true },
    });
    return this.toDto(message);
  }

  async getMessage(messageId: string): Promise<MessageDto> {
    const message = await this.em.findOne(Message, {
      where: { id: messageId },
      relations: { author: true },
    });
    if (!message || message.deletedAt) {
      throw new NotFoundException('Message not found');
    }
    return this.toDto(message);
  }

  private toDto(message: {
    id: string;
    channelId: string;
    content: string;
    attachments?: MessageAttachment[] | null;
    createdAt: Date;
    updatedAt: Date | null;
    author: User;
  }): MessageDto {
    return {
      id: message.id,
      channelId: message.channelId,
      author: toPublicUser(message.author),
      content: message.content,
      attachments: message.attachments ?? undefined,
      createdAt: message.createdAt.toISOString(),
      updatedAt: message.updatedAt?.toISOString() ?? null,
    };
  }
}
