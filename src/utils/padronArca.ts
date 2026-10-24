import { Personeria } from '../types';

export type PadronDetalle = Record<string, unknown>;

export interface PadronImpuestoResumen {
  id: unknown;
  descripcion: string | null;
  estado: unknown;
}

export interface PadronClienteMapeado {
  cuit: string | null;
  tipoPersona: string | null;
  estadoClave: string | null;
  razonSocial: string | null;
  inicioActividades: string | null;
  actividadPrincipal: string | null;
  impuestos: PadronImpuestoResumen[];
  esMonotributo: boolean;
}

function readString(v: unknown): string | null {
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : null;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === 'object';
}

/** Extrae campos de UI desde TaxpayerDetailsDto (un alcance). */
export function mapDetallePadronACliente(detalle: PadronDetalle): PadronClienteMapeado {
  const dg = isRecord(detalle.datosGenerales) ? detalle.datosGenerales : {};
  const drg = isRecord(detalle.datosRegimenGeneral) ? detalle.datosRegimenGeneral : {};
  const nombre = [readString(dg.nombre), readString(dg.apellido)].filter(Boolean).join(' ');
  const razonSocial = readString(dg.razonSocial) ?? (nombre.length > 0 ? nombre : null);

  const impuestos = Array.isArray(drg.impuesto)
    ? drg.impuesto.filter(isRecord).slice(0, 6).map((i) => ({
        id: i.idImpuesto ?? i.id ?? null,
        descripcion: readString(i.descripcionImpuesto) ?? readString(i.descripcion),
        estado: i.estadoImpuesto ?? i.estado ?? null
      }))
    : [];

  const cuitRaw = detalle.idPersona;
  const cuit =
    cuitRaw != null && String(cuitRaw).replace(/\D/g, '').length === 11
      ? String(cuitRaw).replace(/\D/g, '')
      : cuitRaw != null
        ? String(cuitRaw)
        : null;

  return {
    cuit,
    tipoPersona: readString(detalle.tipoPersona),
    estadoClave: readString(detalle.estadoClave),
    razonSocial,
    inicioActividades:
      readString(dg.fechaInicioActividad) ?? readString(dg.fechaInicioActividades) ?? null,
    actividadPrincipal: readString(dg.descripcionActividadPrincipal),
    impuestos,
    esMonotributo: detalle.datosMonotributo != null
  };
}

/** Tras GET padron-completo: elige el mejor detalle entre consultas. */
export function mejorDetalleDesdePadronCompleto(data: {
  consultas: Array<{
    alcancePadron: string;
    ok: boolean;
    reason: string;
    detalle?: PadronDetalle | null;
  }>;
}): PadronDetalle | null {
  const orden = ['thirteen', 'inscription_proof', 'five', 'ten', 'four'];
  for (const alcance of orden) {
    const c = data.consultas.find(
      (x) => x.alcancePadron === alcance && x.ok && x.reason === 'success' && x.detalle
    );
    if (c?.detalle) return c.detalle;
  }
  return null;
}

/** Mapea tipoPersona ARCA al enum personeria del ERP. */
export function inferPersoneriaDesdePadron(tipoPersona: string | null | undefined): Personeria | null {
  const t = (tipoPersona || '').trim().toUpperCase();
  if (t === 'FISICA') return Personeria.PERSONA_FISICA;
  if (t === 'JURIDICA') return Personeria.PERSONA_JURIDICA;
  return null;
}
