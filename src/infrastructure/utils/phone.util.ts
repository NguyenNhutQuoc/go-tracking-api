// ========================================
// 1. PHONE VALIDATION UTILITY
// ========================================
// File: src/infrastructure/utils/phone.util.ts

export class PhoneUtil {
  /**
   * Validate Vietnamese phone number
   */
  static isValid(phone: string): boolean {
    if (!phone) return false;

    // Remove all spaces and special chars except +
    const clean = phone.replace(/[^\d+]/g, '');

    // Vietnamese phone patterns
    const patterns = [
      /^(\+84|84|0)(3|5|7|8|9)[0-9]{8}$/, // Mobile: 03x, 05x, 07x, 08x, 09x
    ];

    return patterns.some((pattern) => pattern.test(clean));
  }

  /**
   * Normalize to +84 format
   */
  static normalize(phone: string): string {
    if (!phone) return phone;

    const clean = phone.replace(/[^\d+]/g, '');

    if (clean.startsWith('0')) {
      return '+84' + clean.substring(1);
    }
    if (clean.startsWith('84') && !clean.startsWith('+84')) {
      return '+' + clean;
    }
    if (!clean.startsWith('+84')) {
      return '+84' + clean;
    }

    return clean;
  }

  /**
   * Format for display: +84 901 234 567
   */
  static format(phone: string): string {
    const normalized = this.normalize(phone);
    if (normalized.startsWith('+84') && normalized.length === 12) {
      return `+84 ${normalized.substring(3, 6)} ${normalized.substring(6, 9)} ${normalized.substring(9)}`;
    }
    return phone;
  }

  /**
   * Mask for security: +84 901 ***567
   */
  static mask(phone: string): string {
    const formatted = this.format(phone);
    if (formatted.length > 10) {
      return (
        formatted.substring(0, 8) +
        '***' +
        formatted.substring(formatted.length - 3)
      );
    }
    return phone;
  }
}
