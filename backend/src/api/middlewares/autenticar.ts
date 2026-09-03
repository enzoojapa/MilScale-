import type { NextFunction, Request, Response } from 'express';
import { autenticacaoService } from '../../nucleo/seguranca/autenticacaoService';
import { ErroDeNegocio, ErroDePermissao } from '../../nucleo/dominio/erros';
import type { CodigoPermissao } from '../../nucleo/seguranca/permissoes';
import type { UsuarioAutenticado } from '../../nucleo/dominio/tipos';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      usuario?: UsuarioAutenticado;
    }
  }
}

export function autenticar(req: Request, _res: Response, next: NextFunction) {
  const cabecalho = req.headers.authorization;
  if (!cabecalho?.startsWith('Bearer ')) {
    return next(new ErroDeNegocio('Autenticação necessária.', 401));
  }
  try {
    req.usuario = autenticacaoService.validarToken(cabecalho.slice(7));
    next();
  } catch (erro) {
    next(erro);
  }
}

/** RNF02 — o RBAC é verificado no servidor, não apenas na interface. */
export function exigirPermissao(...codigos: CodigoPermissao[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.usuario) return next(new ErroDeNegocio('Autenticação necessária.', 401));
    const autorizado = codigos.some((codigo) => req.usuario!.permissoes.includes(codigo));
    if (!autorizado) {
      return next(new ErroDePermissao(`Função privativa: ${codigos.join(' ou ')}.`));
    }
    next();
  };
}

export function usuarioDaRequisicao(req: Request): UsuarioAutenticado {
  if (!req.usuario) throw new ErroDeNegocio('Autenticação necessária.', 401);
  return req.usuario;
}
