import {
  BadRequestException,
  Injectable,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { prisma } from '@avyro/database';
import {
  checksumOf,
  LocalObjectStorage,
  storageRoot,
} from '../storage/object-storage.js';

@Injectable()
export class DocumentsService {
  private readonly storage = new LocalObjectStorage();

  list(organizationId: string) {
    return prisma.document.findMany({
      where: { organizationId },
      include: { links: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(organizationId: string, documentId: string) {
    const doc = await prisma.document.findFirst({
      where: { id: documentId, organizationId },
      include: { links: true },
    });
    if (!doc) {
      throw new NotFoundException({
        error: { code: 'DOCUMENT_NOT_FOUND', message: 'Document not found.' },
      });
    }
    return doc;
  }

  async uploadReceipt(
    organizationId: string,
    userId: string,
    file: Express.Multer.File,
    body: {
      entityType?: 'Expense' | 'Bill' | string;
      entityId?: string;
      category?:
        | 'RECEIPT'
        | 'GENERAL'
        | 'INVOICE'
        | 'CONTRACT'
        | 'BANK'
        | 'COMPLIANCE'
        | 'OTHER';
      label?: string;
    },
  ) {
    const buffer = file?.buffer;
    if (!buffer?.length) {
      throw new BadRequestException({
        error: { code: 'NO_FILE', message: 'A file is required.' },
      });
    }

    const safeName = (file.originalname || 'upload.bin').replace(/[/\\]/g, '_');
    const storageKey = `${organizationId}/receipts/${Date.now()}-${safeName}`;
    await this.storage.putObject({
      key: storageKey,
      body: buffer,
      contentType: file.mimetype || 'application/octet-stream',
    });

    return prisma.document.create({
      data: {
        organizationId,
        storageKey,
        originalFilename: safeName,
        mimeType: file.mimetype || 'application/octet-stream',
        fileSize: buffer.length,
        checksum: checksumOf(buffer),
        category: body.category ?? 'RECEIPT',
        uploadedById: userId,
        ...(body.entityType && body.entityId
          ? {
              links: {
                create: {
                  organizationId,
                  entityType: body.entityType,
                  entityId: body.entityId,
                  label: body.label ?? 'Receipt',
                },
              },
            }
          : {}),
      },
      include: { links: true },
    });
  }

  async download(organizationId: string, documentId: string) {
    const doc = await this.get(organizationId, documentId);
    const fullPath = path.join(storageRoot(), doc.storageKey);
    const stream = createReadStream(fullPath);
    return {
      document: doc,
      file: new StreamableFile(stream, {
        type: doc.mimeType,
        disposition: `attachment; filename="${doc.originalFilename.replace(/"/g, '')}"`,
      }),
    };
  }
}
