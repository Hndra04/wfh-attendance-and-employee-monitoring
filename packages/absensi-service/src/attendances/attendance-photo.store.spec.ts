import { UnprocessableEntityException } from '@nestjs/common';
import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';

import { validatePhoto } from './attendance-photo.store';

describe('attendance photo validation', () => {
  it('accepts a JPEG whose content signature matches its declared MIME type', () => {
    const file = createUpload('image/jpeg', [0xff, 0xd8, 0xff, 0x00]);

    expect(validatePhoto(file)).toBe('image/jpeg');
  });

  it('accepts a PNG whose content signature matches its declared MIME type', () => {
    const file = createUpload('image/png', [
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);

    expect(validatePhoto(file)).toBe('image/png');
  });

  it('rejects a MIME type that does not match the file signature', () => {
    expect(() =>
      validatePhoto(createUpload('image/png', [0xff, 0xd8, 0xff])),
    ).toThrow(UnprocessableEntityException);
  });

  it('rejects empty and oversized files', () => {
    expect(() => validatePhoto(createUpload('image/jpeg', []))).toThrow(
      UnprocessableEntityException,
    );
    expect(
      () => validatePhoto(createUpload('image/jpeg', [0xff, 0xd8, 0xff], 5 * 1024 * 1024 + 1)),
    ).toThrow(UnprocessableEntityException);
  });
});

function createUpload(
  mimetype: string,
  signature: number[],
  size = signature.length,
): Express.Multer.File {
  return {
    fieldname: 'photo',
    originalname: 'photo',
    encoding: '7bit',
    mimetype,
    size,
    destination: '',
    filename: '',
    path: '',
    buffer: createBuffer(signature, size),
    stream: Readable.from([]),
  };
}

function createBuffer(signature: number[], size: number): Buffer {
  const buffer = Buffer.alloc(size);
  Buffer.from(signature).copy(buffer);
  return buffer;
}
