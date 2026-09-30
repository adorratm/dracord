import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createId } from '@paralleldrive/cuid2';
import type { PresignUploadResponse } from '@dracord/types';

@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);
  private readonly client: S3Client | null;
  private readonly bucket: string;
  private readonly publicUrl: string;
  private bucketReady: Promise<void> | null = null;

  constructor(private readonly config: ConfigService) {
    const endpointRaw = this.config.get<string>('S3_ENDPOINT')?.trim();
    const endpoint = endpointRaw || undefined;
    const region = this.config.get<string>('S3_REGION') ?? 'us-east-1';
    const accessKey = this.config.get<string>('S3_ACCESS_KEY');
    const secretKey = this.config.get<string>('S3_SECRET_KEY');
    this.bucket = this.config.get<string>('S3_BUCKET') ?? 'dracord';
    const endpointUrl = endpoint?.replace(/\/$/, '');
    this.publicUrl =
      this.config.get<string>('S3_PUBLIC_URL') ??
      (endpointUrl ? `${endpointUrl}/${this.bucket}` : '');

    if (accessKey && secretKey) {
      this.client = new S3Client({
        region,
        endpoint,
        forcePathStyle: Boolean(endpoint),
        credentials: {
          accessKeyId: accessKey,
          secretAccessKey: secretKey,
        },
      });
    } else {
      this.client = null;
      this.logger.warn('S3 credentials missing — uploads disabled');
    }
  }

  private async ensureBucket() {
    if (!this.client) return;
    if (!this.bucketReady) {
      this.bucketReady = (async () => {
        try {
          await this.client!.send(new HeadBucketCommand({ Bucket: this.bucket }));
        } catch {
          try {
            await this.client!.send(new CreateBucketCommand({ Bucket: this.bucket }));
            this.logger.log(`Created S3 bucket ${this.bucket}`);
          } catch (err) {
            this.logger.warn(`Could not ensure bucket: ${(err as Error).message}`);
          }
        }
      })();
    }
    await this.bucketReady;
  }

  async createPresignedUpload(
    userId: string,
    input: { filename: string; contentType: string; folder?: string },
  ): Promise<PresignUploadResponse> {
    if (!this.client) {
      throw new BadRequestException('Dosya yükleme yapılandırılmamış (S3)');
    }
    await this.ensureBucket();
    const safeName = input.filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
    const folder = input.folder?.replace(/[^a-z0-9/-]/gi, '') || 'uploads';
    const key = `${folder}/${userId}/${createId()}-${safeName}`;
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: input.contentType,
    });
    const expiresIn = 900;
    const uploadUrl = await getSignedUrl(this.client, command, { expiresIn });
    const publicUrl = `${this.publicUrl.replace(/\/$/, '')}/${key}`;
    return { uploadUrl, publicUrl, key, expiresIn };
  }
}
