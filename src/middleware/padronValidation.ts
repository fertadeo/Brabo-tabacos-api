import { param, query } from 'express-validator';

export const padronCuitParam = [
  param('cuit')
    .custom((value) => {
      const digits = String(value).replace(/\D/g, '');
      if (digits.length !== 11) {
        throw new Error('CUIT debe tener 11 dígitos');
      }
      return true;
    })
    .withMessage('CUIT inválido'),
  query('cuitEmisor')
    .optional()
    .custom((value) => {
      if (value === undefined || value === null || value === '') return true;
      const digits = String(value).replace(/\D/g, '');
      if (digits.length !== 11) {
        throw new Error('cuitEmisor debe tener 11 dígitos');
      }
      return true;
    }),
  query('incluirCondicionIva').optional().isIn(['true', 'false', '1', '0']),
  query('skipCache').optional().isIn(['true', 'false', '1', '0']),
];
