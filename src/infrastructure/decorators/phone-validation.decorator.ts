// ========================================
// 2. PHONE VALIDATION DECORATOR
// ========================================
// File: src/infrastructure/decorators/phone-validation.decorator.ts

import { registerDecorator, ValidationOptions } from 'class-validator';
import { PhoneUtil } from '../utils/phone.util';

export function IsPhoneNumber(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isPhoneNumber',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any) {
          return typeof value === 'string' && PhoneUtil.isValid(value);
        },
        defaultMessage() {
          return 'Phone number must be a valid Vietnamese phone number (starting with 03, 05, 07, 08, 09)';
        },
      },
    });
  };
}
