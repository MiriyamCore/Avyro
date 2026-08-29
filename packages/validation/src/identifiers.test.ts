import { describe, expect, it } from 'vitest';
import { binSchema, tinSchema } from './index.js';

describe('Bangladesh identifier validation', () => {
  it('accepts 12-digit TIN', () => {
    expect(tinSchema.parse('123456789012')).toBe('123456789012');
  });

  it('rejects short TIN', () => {
    expect(() => tinSchema.parse('123')).toThrow();
  });

  it('accepts 13-digit BIN', () => {
    expect(binSchema.parse('1234567890123')).toBe('1234567890123');
  });

  it('rejects short BIN', () => {
    expect(() => binSchema.parse('123456789')).toThrow();
  });
});
