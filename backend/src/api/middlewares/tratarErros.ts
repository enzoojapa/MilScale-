import type { NextFunction, Request, Response } from 'express';
import { ErroDeNegocio } from '../../nucleo/dominio/erros';

export function tratarErros(erro: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (erro instanceof ErroDeNegocio) {
    return res.status(erro.status).json({ mensagem: erro.message, codigo: erro.codigo });
  }
  if (erro instanceof Error && erro.message.includes('UNIQUE constraint failed')) {
    // RNF08: a restrição de banco impede duplo serviço do mesmo militar na mesma data.
    return res.status(409).json({
      mensagem: 'Operação recusada pelo banco: o militar já está escalado nesta data.',
      codigo: 'RESTRICAO_INTEGRIDADE'
    });
  }
  console.error(erro);
  return res.status(500).json({ mensagem: 'Erro interno do sistema.' });
}

export function rotaAssincrona(
  manipulador: (req: Request, res: Response) => unknown | Promise<unknown>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const resultado = manipulador(req, res);
      if (resultado instanceof Promise) resultado.catch(next);
    } catch (erro) {
      next(erro);
    }
  };
}
