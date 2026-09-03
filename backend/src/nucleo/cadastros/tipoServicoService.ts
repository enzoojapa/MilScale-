import { emTransacao } from '../../infra/banco';
import { cursoRepositorio, tipoServicoRepositorio } from '../../infra/repositorios/catalogoRepositorio';
import { auditoriaService } from '../auditoria/auditoriaService';
import { ErroDeNegocio, ErroNaoEncontrado } from '../dominio/erros';

export interface DadosTipoServico {
  nome: string;
  descricao: string | null;
  efetivo_necessario: number;
  hora_inicio: string;
  duracao_horas: number;
  exige_pernoite: boolean;
  ativo: boolean;
  requisitos: { id_posto: number; id_curso: number | null; obrigatorio: boolean }[];
}

/** UC03 – Manter tipos de serviço e seus requisitos de elegibilidade (RN02, RN03, RN11). */
export const tipoServicoService = {
  listar: tipoServicoRepositorio.listar.bind(tipoServicoRepositorio),
  buscar: tipoServicoRepositorio.buscarPorId.bind(tipoServicoRepositorio),

  incluir(dados: DadosTipoServico, idUsuario: number) {
    validar(dados);
    if (tipoServicoRepositorio.listar().some((t) => t.nome.toLowerCase() === dados.nome.trim().toLowerCase())) {
      throw new ErroDeNegocio('Já existe tipo de serviço com este nome.', 409);
    }
    return emTransacao(() => {
      const id = tipoServicoRepositorio.inserir({
        nome: dados.nome.trim(),
        descricao: dados.descricao?.trim() || null,
        efetivo_necessario: dados.efetivo_necessario,
        hora_inicio: dados.hora_inicio,
        duracao_horas: dados.duracao_horas,
        exige_pernoite: dados.exige_pernoite ? 1 : 0,
        ativo: dados.ativo ? 1 : 0
      });
      tipoServicoRepositorio.definirRequisitos(
        id,
        dados.requisitos.map((r) => ({ ...r, obrigatorio: r.obrigatorio ? 1 : 0 }))
      );
      auditoriaService.registrar({
        idUsuario,
        entidade: 'TIPO_SERVICO',
        idRegistro: id,
        acao: 'INCLUSAO',
        valorNovo: dados
      });
      return tipoServicoRepositorio.buscarPorId(id);
    });
  },

  alterar(id: number, dados: DadosTipoServico, idUsuario: number) {
    const atual = tipoServicoRepositorio.buscarPorId(id);
    if (!atual) throw new ErroNaoEncontrado('Tipo de serviço');
    validar(dados);
    // UC03-E3: um tipo já usado em escala publicada não pode ser inativado.
    if (!dados.ativo && atual.ativo && tipoServicoRepositorio.usadoEmEscalaPublicada(id)) {
      throw new ErroDeNegocio('Tipo de serviço utilizado em escala publicada não pode ser inativado.', 409);
    }
    return emTransacao(() => {
      tipoServicoRepositorio.atualizar(id, {
        nome: dados.nome.trim(),
        descricao: dados.descricao?.trim() || null,
        efetivo_necessario: dados.efetivo_necessario,
        hora_inicio: dados.hora_inicio,
        duracao_horas: dados.duracao_horas,
        exige_pernoite: dados.exige_pernoite ? 1 : 0,
        ativo: dados.ativo ? 1 : 0
      });
      tipoServicoRepositorio.definirRequisitos(
        id,
        dados.requisitos.map((r) => ({ ...r, obrigatorio: r.obrigatorio ? 1 : 0 }))
      );
      auditoriaService.registrar({
        idUsuario,
        entidade: 'TIPO_SERVICO',
        idRegistro: id,
        acao: 'ALTERACAO',
        valorAnterior: atual,
        valorNovo: dados
      });
      return tipoServicoRepositorio.buscarPorId(id);
    });
  }
};

/** RF05 – Manter cursos e qualificações. */
export const cursoService = {
  listar: cursoRepositorio.listar,

  incluir(nome: string, descricao: string | null, idUsuario: number) {
    if (!nome?.trim()) throw new ErroDeNegocio('Informe o nome do curso.');
    const id = cursoRepositorio.inserir(nome.trim(), descricao?.trim() || null);
    auditoriaService.registrar({
      idUsuario,
      entidade: 'CURSO',
      idRegistro: id,
      acao: 'INCLUSAO',
      valorNovo: { nome, descricao }
    });
    return id;
  },

  alterar(id: number, nome: string, descricao: string | null, idUsuario: number) {
    if (!nome?.trim()) throw new ErroDeNegocio('Informe o nome do curso.');
    cursoRepositorio.atualizar(id, nome.trim(), descricao?.trim() || null);
    auditoriaService.registrar({
      idUsuario,
      entidade: 'CURSO',
      idRegistro: id,
      acao: 'ALTERACAO',
      valorNovo: { nome, descricao }
    });
  },

  excluir(id: number, idUsuario: number) {
    if (cursoRepositorio.estaEmUso(id)) {
      throw new ErroDeNegocio('Curso vinculado a militares ou a requisitos de serviço.', 409);
    }
    cursoRepositorio.excluir(id);
    auditoriaService.registrar({
      idUsuario,
      entidade: 'CURSO',
      idRegistro: id,
      acao: 'EXCLUSAO'
    });
  }
};

function validar(dados: DadosTipoServico) {
  if (!dados.nome?.trim()) throw new ErroDeNegocio('Informe o nome do tipo de serviço.');
  // UC03-E2: efetivo menor ou igual a zero é recusado.
  if (!dados.efetivo_necessario || dados.efetivo_necessario <= 0) {
    throw new ErroDeNegocio('O efetivo necessário deve ser maior que zero.');
  }
  if (!Array.isArray(dados.requisitos) || dados.requisitos.length === 0) {
    throw new ErroDeNegocio('Informe ao menos um requisito de posto/graduação.');
  }
}
