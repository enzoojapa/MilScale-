import { auditoriaRepositorio } from '../../infra/repositorios/auditoriaRepositorio';
import { agoraISO } from '../dominio/periodo';
import type { AcaoAuditoria } from '../dominio/tipos';

/** RF22 / RNF07 — trilha de auditoria gravada por todos os serviços que alteram dado relevante. */
export const auditoriaService = {
  registrar(parametros: {
    idUsuario: number | null;
    entidade: string;
    idRegistro: number;
    acao: AcaoAuditoria;
    valorAnterior?: unknown;
    valorNovo?: unknown;
  }): void {
    auditoriaRepositorio.inserir({
      id_usuario: parametros.idUsuario,
      entidade: parametros.entidade,
      id_registro: parametros.idRegistro,
      acao: parametros.acao,
      valor_anterior: serializar(parametros.valorAnterior),
      valor_novo: serializar(parametros.valorNovo),
      data_hora: agoraISO()
    });
  },

  consultar: auditoriaRepositorio.listar,
  entidades: auditoriaRepositorio.entidadesRegistradas
};

function serializar(valor: unknown): string | null {
  if (valor === undefined || valor === null) return null;
  return typeof valor === 'string' ? valor : JSON.stringify(valor);
}
