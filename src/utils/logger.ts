import chalk from 'chalk';

/**
 * Logger con colores por tipo de acción para facilitar la visualización en consola.
 * Uso: logger.product.info(), logger.barcode.search(), etc.
 */
const product = {
  /** Acciones de actualización (ej. reemplazo de imágenes, guardado) */
  update: (msg: string, ...args: unknown[]) =>
    console.log(chalk.cyan('[ProductService]'), chalk.blue('UPDATE:'), msg, ...args),
  /** Imágenes: cambios en galería, reemplazo, limpieza */
  images: (msg: string, ...args: unknown[]) =>
    console.log(chalk.cyan('[ProductService]'), chalk.magenta('IMAGES:'), msg, ...args),
  /** Sync con WooCommerce */
  sync: (msg: string, ...args: unknown[]) =>
    console.log(chalk.cyan('[ProductService]'), chalk.green('SYNC:'), msg, ...args),
  /** Errores */
  error: (msg: string, ...args: unknown[]) =>
    console.error(chalk.cyan('[ProductService]'), chalk.red('ERROR:'), msg, ...args),
  /** Info general */
  info: (msg: string, ...args: unknown[]) =>
    console.log(chalk.cyan('[ProductService]'), chalk.gray('INFO:'), msg, ...args),
};

/** Logger para búsqueda por código de barras (flujo completo y providers) */
const barcode = {
  /** Inicio de búsqueda, paso actual */
  search: (msg: string, ...args: unknown[]) =>
    console.log(chalk.yellow('[BarcodeLookup]'), chalk.cyan('SEARCH:'), msg, ...args),
  /** Provider externo (Google, UPC, etc.) */
  provider: (msg: string, ...args: unknown[]) =>
    console.log(chalk.yellow('[BarcodeLookup]'), chalk.magenta('PROVIDER:'), msg, ...args),
  /** Resultado encontrado */
  found: (msg: string, ...args: unknown[]) =>
    console.log(chalk.yellow('[BarcodeLookup]'), chalk.green('FOUND:'), msg, ...args),
  /** No encontrado / skip */
  skip: (msg: string, ...args: unknown[]) =>
    console.log(chalk.yellow('[BarcodeLookup]'), chalk.gray('SKIP:'), msg, ...args),
  /** Errores en el flujo de barcode */
  error: (msg: string, ...args: unknown[]) =>
    console.error(chalk.yellow('[BarcodeLookup]'), chalk.red('ERROR:'), msg, ...args),
};

export const logger = {
  product,
  barcode,
};
