export class ErroDeNegocio extends Error {
  constructor(mensagem: string, readonly status = 400, readonly codigo?: string) {
    super(mensagem);
    this.name = 'ErroDeNegocio';
  }
}

export class ExcecaoElegibilidade extends ErroDeNegocio {
  constructor(mensagem: string) {
    super(mensagem, 422, 'ELEGIBILIDADE');
  }
}

export class ExcecaoDiaTrancado extends ErroDeNegocio {
  constructor(motivo: string | null) {
    super(
      motivo
        ? `Dia trancado pela sargenteação: ${motivo}`
        : 'Dia trancado pela sargenteação.',
      409,
      'DIA_TRANCADO'
    );
  }
}

export class ExcecaoMilitarImpedido extends ErroDeNegocio {
  constructor(mensagem: string) {
    super(mensagem, 409, 'MILITAR_IMPEDIDO');
  }
}

export class ErroDePermissao extends ErroDeNegocio {
  constructor(mensagem = 'Função não autorizada para o seu perfil.') {
    super(mensagem, 403, 'SEM_PERMISSAO');
  }
}

export class ErroNaoEncontrado extends ErroDeNegocio {
  constructor(recurso: string) {
    super(`${recurso} não encontrado.`, 404, 'NAO_ENCONTRADO');
  }
}
