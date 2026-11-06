import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { createReadStream } from 'node:fs';
import { access, mkdir, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { ulid } from 'ulid';

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const JPEG_MIME_TYPE = 'image/jpeg';
const PNG_MIME_TYPE = 'image/png';

export type AttendancePhotoKind = 'check-in' | 'check-out';

export interface StoredAttendancePhoto {
  fileName: string;
  mimeType: typeof JPEG_MIME_TYPE | typeof PNG_MIME_TYPE;
}

@Injectable()
export class AttendancePhotoStore {
  private readonly uploadDirectory = resolve(process.env.UPLOAD_DIR ?? 'uploads');

  async store(file: Express.Multer.File): Promise<StoredAttendancePhoto> {
    const mimeType = validatePhoto(file);
    const extension = mimeType === JPEG_MIME_TYPE ? 'jpg' : 'png';
    const fileName = `${ulid()}.${extension}`;

    await mkdir(this.uploadDirectory, { recursive: true });
    await writeFile(this.getPath(fileName), file.buffer, { flag: 'wx' });
    return { fileName, mimeType };
  }

  async remove(fileName: string): Promise<void> {
    await rm(this.getPath(fileName), { force: true });
  }

  async open(fileName: string): Promise<{
    stream: ReturnType<typeof createReadStream>;
    mimeType: typeof JPEG_MIME_TYPE | typeof PNG_MIME_TYPE;
  }> {
    const mimeType = this.getMimeType(fileName);
    const filePath = this.getPath(fileName);

    try {
      await access(filePath);
    } catch (error) {
      if (isMissingFile(error)) {
        throw new NotFoundException('Attendance photo was not found.');
      }
      throw error;
    }

    return { stream: createReadStream(filePath), mimeType };
  }

  private getPath(fileName: string): string {
    if (!/^[0-9A-HJKMNP-TV-Z]{26}\.(jpg|png)$/.test(fileName)) {
      throw new NotFoundException('Attendance photo was not found.');
    }

    return join(this.uploadDirectory, fileName);
  }

  private getMimeType(fileName: string): typeof JPEG_MIME_TYPE | typeof PNG_MIME_TYPE {
    if (fileName.endsWith('.jpg')) {
      return JPEG_MIME_TYPE;
    }
    if (fileName.endsWith('.png')) {
      return PNG_MIME_TYPE;
    }

    throw new NotFoundException('Attendance photo was not found.');
  }
}

export function validatePhoto(file: Express.Multer.File):
  | typeof JPEG_MIME_TYPE
  | typeof PNG_MIME_TYPE {
  if (!file?.buffer?.length || file.buffer.length > MAX_PHOTO_BYTES) {
    throw new UnprocessableEntityException('Photo is required and must be no larger than 5 MB.');
  }

  const isJpeg = file.buffer[0] === 0xff && file.buffer[1] === 0xd8 && file.buffer[2] === 0xff;
  const isPng =
    file.buffer.length >= 8 &&
    file.buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));

  if (file.mimetype === JPEG_MIME_TYPE && isJpeg) {
    return JPEG_MIME_TYPE;
  }
  if (file.mimetype === PNG_MIME_TYPE && isPng) {
    return PNG_MIME_TYPE;
  }

  throw new UnprocessableEntityException('Photo must be a valid JPEG or PNG image.');
}

function isMissingFile(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'ENOENT'
  );
}
