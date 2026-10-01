import {
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  registerDecorator,
  type ValidationOptions,
} from 'class-validator';

export type MessageAttachmentInput = {
  id: string;
  url: string;
  filename: string;
  contentType: string;
  size: number;
};

function IsMessageAttachments(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'isMessageAttachments',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          if (value === undefined || value === null) return true;
          if (!Array.isArray(value)) return false;
          return value.every((item) => {
            if (!item || typeof item !== 'object') return false;
            const a = item as Record<string, unknown>;
            return (
              typeof a.id === 'string' &&
              a.id.length > 0 &&
              typeof a.url === 'string' &&
              a.url.length > 0 &&
              typeof a.filename === 'string' &&
              a.filename.length > 0 &&
              typeof a.contentType === 'string' &&
              a.contentType.length > 0 &&
              typeof a.size === 'number' &&
              Number.isFinite(a.size) &&
              a.size >= 0
            );
          });
        },
        defaultMessage() {
          return 'attachments geçersiz (id, url, filename, contentType, size gerekli)';
        },
      },
    });
  };
}

export class CreateMessageDto {
  @IsString()
  @MinLength(0)
  @MaxLength(4000)
  @IsOptional()
  content?: string;

  @IsOptional()
  @IsArray()
  @IsMessageAttachments()
  attachments?: MessageAttachmentInput[];

  @IsOptional()
  poll?: {
    question: string;
    options: string[];
    multi?: boolean;
  };

  @IsOptional()
  @IsString()
  replyToId?: string;

  @IsOptional()
  @IsString()
  threadRootId?: string;

  @IsOptional()
  @IsIn(['default', 'heading'])
  type?: 'default' | 'heading';
}

export class ForwardMessageDto {
  @IsString()
  @MinLength(1)
  targetChannelId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  content?: string;
}

export class MarkReadDto {
  @IsOptional()
  @IsString()
  messageId?: string;

  /** true ise bu mesajın bir öncesi = imleç (okunmadı işaretle) */
  @IsOptional()
  @IsBoolean()
  unreadFrom?: boolean;
}
