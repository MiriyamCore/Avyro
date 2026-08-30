import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import type { ObjectStorage, PutObjectInput, SignedUrlInput } from './object-storage.js';

export function isS3Configured(): boolean {
  return Boolean(
    process.env.S3_BUCKET &&
      process.env.AWS_ACCESS_KEY_ID &&
      process.env.AWS_SECRET_ACCESS_KEY,
  );
}

function createS3Client() {
  const region = process.env.S3_REGION ?? 'us-east-1';
  const endpoint = process.env.S3_ENDPOINT;
  return new S3Client({
    region,
    ...(endpoint
      ? {
          endpoint,
          forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
        }
      : {}),
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });
}

export class S3ObjectStorage implements ObjectStorage {
  private readonly client = createS3Client();
  private readonly bucket = process.env.S3_BUCKET!;

  async putObject(input: PutObjectInput) {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: input.key,
        Body: input.body,
        ContentType: input.contentType,
      }),
    );
    return { key: input.key };
  }

  async getObject(key: string) {
    const response = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    const bytes = await response.Body?.transformToByteArray();
    if (!bytes) {
      throw new Error(`S3 object empty or missing: ${key}`);
    }
    return Buffer.from(bytes);
  }

  async getSignedDownloadUrl(input: SignedUrlInput) {
    return `s3://${this.bucket}/${input.key}`;
  }
}
