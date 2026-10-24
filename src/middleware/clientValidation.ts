import { body } from 'express-validator';
import { ClientType, Personeria, SalesChannel } from '../types';
import {
  CLIENT_TAX_CONDITIONS,
  isTaxConditionAllowedForPersoneria,
  normalizeTaxCondition
} from '../utils/clientTaxCondition';
import { validateClientTaxIdBody } from '../utils/clientTaxId';

const taxConditionValidator = body('tax_condition')
  .optional({ values: 'falsy', nullable: true })
  .custom((value) => {
    if (value === undefined || value === null || value === '') return true;
    if (!normalizeTaxCondition(value)) {
      throw new Error(`tax_condition must be one of: ${CLIENT_TAX_CONDITIONS.join(', ')}`);
    }
    return true;
  });

const taxConditionPersoneriaValidator = body('tax_condition')
  .optional({ values: 'falsy', nullable: true })
  .custom((value, { req }) => {
    const tax = normalizeTaxCondition(value);
    if (!tax) return true;
    const personeria = (req.body.personeria ??
      req.body.person_type ??
      Personeria.CONSUMIDOR_FINAL) as Personeria;
    if (!isTaxConditionAllowedForPersoneria(personeria, tax)) {
      throw new Error(`tax_condition "${tax}" is not valid for personeria "${personeria}"`);
    }
    return true;
  });

const condicionIvaValidator = body('condicion_iva_receptor')
  .optional({ values: 'falsy', nullable: true })
  .isInt({ min: 1, max: 10 })
  .withMessage('condicion_iva_receptor must be an integer between 1 and 10');

export const createClientValidation = [
  body('client_type')
    .optional({ values: 'falsy' })
    .isIn(Object.values(ClientType))
    .withMessage(`Client type must be one of: ${Object.values(ClientType).join(', ')}`),
  
  body('sales_channel')
    .optional({ values: 'falsy' })
    .isIn(Object.values(SalesChannel))
    .withMessage(`Sales channel must be one of: ${Object.values(SalesChannel).join(', ')}`),
    
  body('name')
    .notEmpty()
    .withMessage('Client name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Client name must be between 2 and 100 characters')
    .trim(),
    
  body('email')
    .optional({ values: 'falsy', nullable: true })
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
    
  body('phone')
    .optional({ values: 'falsy', nullable: true })
    .isLength({ max: 20 })
    .withMessage('Phone number must not exceed 20 characters')
    .matches(/^[\d\s\-\+\(\)]+$/)
    .withMessage('Phone number contains invalid characters'),
    
  body('address')
    .optional({ values: 'falsy', nullable: true })
    .isLength({ max: 500 })
    .withMessage('Address must not exceed 500 characters')
    .trim(),
    
  body('city')
    .optional({ values: 'falsy', nullable: true })
    .isLength({ max: 50 })
    .withMessage('City must not exceed 50 characters')
    .trim(),
    
  body('country')
    .optional({ values: 'falsy', nullable: true })
    .isLength({ max: 50 })
    .withMessage('Country must not exceed 50 characters')
    .trim(),

  body('personeria')
    .optional({ values: 'falsy' })
    .isIn(Object.values(Personeria))
    .withMessage(`Personeria must be one of: ${Object.values(Personeria).join(', ')}`),

  body('cuil_cuit')
    .optional({ values: 'falsy', nullable: true })
    .custom(validateClientTaxIdBody),

  taxConditionValidator,
  taxConditionPersoneriaValidator,
  condicionIvaValidator
];

export const updateClientValidation = [
  body('client_type')
    .optional({ values: 'falsy' })
    .isIn(Object.values(ClientType))
    .withMessage(`Client type must be one of: ${Object.values(ClientType).join(', ')}`),
  
  body('sales_channel')
    .optional({ values: 'falsy' })
    .isIn(Object.values(SalesChannel))
    .withMessage(`Sales channel must be one of: ${Object.values(SalesChannel).join(', ')}`),
    
  body('code')
    .optional({ values: 'falsy' })
    .isLength({ min: 3, max: 20 })
    .withMessage('Client code must be between 3 and 20 characters')
    .matches(/^[A-Z0-9]+$/)
    .withMessage('Client code must contain only uppercase letters and numbers'),
    
  body('name')
    .optional({ values: 'falsy' })
    .isLength({ min: 2, max: 100 })
    .withMessage('Client name must be between 2 and 100 characters')
    .trim(),
    
  body('email')
    .optional({ values: 'falsy', nullable: true })
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
    
  body('phone')
    .optional({ values: 'falsy', nullable: true })
    .isLength({ max: 20 })
    .withMessage('Phone number must not exceed 20 characters')
    .matches(/^[\d\s\-\+\(\)]+$/)
    .withMessage('Phone number contains invalid characters'),
    
  body('address')
    .optional({ values: 'falsy', nullable: true })
    .isLength({ max: 500 })
    .withMessage('Address must not exceed 500 characters')
    .trim(),
    
  body('city')
    .optional({ values: 'falsy', nullable: true })
    .isLength({ max: 50 })
    .withMessage('City must not exceed 50 characters')
    .trim(),
    
  body('country')
    .optional({ values: 'falsy', nullable: true })
    .isLength({ max: 50 })
    .withMessage('Country must not exceed 50 characters')
    .trim(),

  body('personeria')
    .optional({ values: 'falsy' })
    .isIn(Object.values(Personeria))
    .withMessage(`Personeria must be one of: ${Object.values(Personeria).join(', ')}`),

  body('cuil_cuit')
    .optional({ values: 'falsy', nullable: true })
    .custom(validateClientTaxIdBody),

  taxConditionValidator,
  taxConditionPersoneriaValidator,
  condicionIvaValidator,

  body('is_active')
    .optional({ values: 'falsy' })
    .isBoolean({ loose: true })
    .withMessage('is_active must be a boolean value')
];
