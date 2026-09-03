import { banco, emTransacao } from './banco';
import { aplicacao } from '../aplicacao';
import { autenticacaoService } from '../nucleo/seguranca/autenticacaoService';
import { descricaoDosPerfis, ordemDosPerfis, permissoes, permissoesDoPerfil } from '../nucleo/seguranca/permissoes';
import { agoraISO, hojeISO, somarDias } from '../nucleo/dominio/periodo';
import { militarRepositorio } from './repositorios/militarRepositorio';
import { escalaRepositorio } from './repositorios/escalaRepositorio';
import { solicitacaoRepositorio } from './repositorios/solicitacaoRepositorio';
import {
  cabos,
  recrutas,
  segundosSargentos,
  soldadosEp,
  tenentes,
  terceirosSargentos
} from './dadosIniciais';
import type { EfetivoSemente } from './dadosIniciais';
import type { NomePerfil } from '../nucleo/dominio/tipos';

const SENHA_PADRAO = 'milscale';

interface BlocoDeEfetivo {
  siglaPosto: string;
  integrantes: EfetivoSemente[];
  /** Contador inicial de dias sem serviço, distribuído para simular um ciclo já em andamento. */
  ciclo: number;
}

function inserirPostos() {
  const inserir = banco.prepare(
    'INSERT INTO POSTO_GRADUACAO (sigla, descricao, nivel_hierarquico) VALUES (?, ?, ?)'
  );
  const postos: [string, string, number][] = [
    ['Rct', 'Recruta', 1],
    ['Sd EP', 'Soldado Efetivo Profissional', 2],
    ['Cb', 'Cabo', 3],
    ['3º Sgt', 'Terceiro-Sargento', 4],
    ['2º Sgt', 'Segundo-Sargento', 5],
    ['Ten', 'Tenente', 6]
  ];
  for (const posto of postos) inserir.run(...posto);
  return mapaDe('SELECT id_posto AS id, sigla AS chave FROM POSTO_GRADUACAO');
}

function inserirCursos() {
  const inserir = banco.prepare('INSERT INTO CURSO (nome, descricao) VALUES (?, ?)');
  inserir.run('CFC', 'Curso de Formação de Cabos, exigido para o serviço de Cabo de Dia.');
  inserir.run('Curso de Motorista', 'Habilitação militar para condução de viaturas do batalhão.');
  inserir.run('Rancho', 'Qualificação para os serviços ligados à alimentação da tropa.');
  return mapaDe('SELECT id_curso AS id, nome AS chave FROM CURSO');
}

function inserirPerfisEPermissoes() {
  const inserirPermissao = banco.prepare('INSERT INTO PERMISSAO (codigo, descricao) VALUES (?, ?)');
  for (const [codigo, descricao] of Object.entries(permissoes)) inserirPermissao.run(codigo, descricao);
  const permissoesPorCodigo = mapaDe('SELECT id_permissao AS id, codigo AS chave FROM PERMISSAO');

  const inserirPerfil = banco.prepare('INSERT INTO PERFIL_ACESSO (nome, descricao) VALUES (?, ?)');
  const vincular = banco.prepare(
    'INSERT INTO PERFIL_PERMISSAO (id_perfil, id_permissao) VALUES (?, ?)'
  );
  for (const perfil of ordemDosPerfis) {
    const resultado = inserirPerfil.run(perfil, descricaoDosPerfis[perfil]);
    const idPerfil = Number(resultado.lastInsertRowid);
    for (const codigo of permissoesDoPerfil(perfil)) {
      vincular.run(idPerfil, permissoesPorCodigo[codigo]);
    }
  }
  return mapaDe('SELECT id_perfil AS id, nome AS chave FROM PERFIL_ACESSO');
}

function inserirEfetivo(
  postos: Record<string, number>,
  cursos: Record<string, number>,
  perfis: Record<string, number>
) {
  const blocos: BlocoDeEfetivo[] = [
    { siglaPosto: 'Rct', integrantes: recrutas, ciclo: 6 },
    { siglaPosto: 'Sd EP', integrantes: soldadosEp, ciclo: 8 },
    { siglaPosto: 'Cb', integrantes: cabos, ciclo: 8 },
    { siglaPosto: '3º Sgt', integrantes: terceirosSargentos, ciclo: 5 },
    { siglaPosto: '2º Sgt', integrantes: segundosSargentos, ciclo: 6 },
    { siglaPosto: 'Ten', integrantes: tenentes, ciclo: 5 }
  ];

  const senhaHash = autenticacaoService.gerarHash(SENHA_PADRAO);
  const inserirUsuario = banco.prepare(
    `INSERT INTO USUARIO (id_militar, id_perfil, login, senha_hash, ativo, senha_provisoria)
     VALUES (?, ?, ?, ?, 1, 0)`
  );

  let sequencialCpf = 10_000_000_001;
  const idsPorNomeGuerra = new Map<string, number>();

  for (const bloco of blocos) {
    bloco.integrantes.forEach((pessoa, indice) => {
      const cpf = String(sequencialCpf++);
      // O contador inicial escalona a fila, como a planilha do sargenteante já chega preenchida.
      const diasSemServico = indice % (bloco.ciclo + 1);
      const idMilitar = militarRepositorio.inserir({
        nome_completo: pessoa.nome_completo,
        nome_guerra: pessoa.nome_guerra,
        cpf,
        id_posto: postos[bloco.siglaPosto],
        email: `${semAcento(pessoa.nome_guerra)}@bat.eb.mil.br`,
        telefone: `4199${String(100000 + sequencialCpf % 899999).slice(0, 6)}`,
        dias_sem_servico: diasSemServico,
        data_fim_ultima_missao: null,
        situacao: 'ATIVO'
      });
      militarRepositorio.definirCursos(
        idMilitar,
        pessoa.cursos.map((curso) => ({
          id_curso: cursos[curso],
          data_conclusao: somarDias(hojeISO(), -400 - indice * 3)
        }))
      );
      inserirUsuario.run(idMilitar, perfis.MILITAR_ESCALADO, cpf, senhaHash);
      idsPorNomeGuerra.set(pessoa.nome_guerra, idMilitar);
    });
  }

  // A sargenteação é composta por militares do próprio efetivo, com perfis mais amplos (seção 2).
  const atribuicoes: [string, NomePerfil][] = [
    ['Rossato', 'SARGENTEANTE'],
    ['Petry', 'CABO_SARGENTEACAO'],
    ['Bueno', 'SD_EP_SARGENTEACAO']
  ];
  const alterarPerfil = banco.prepare('UPDATE USUARIO SET id_perfil = ? WHERE id_militar = ?');
  for (const [nomeGuerra, perfil] of atribuicoes) {
    const idMilitar = idsPorNomeGuerra.get(nomeGuerra);
    if (idMilitar) alterarPerfil.run(perfis[perfil], idMilitar);
  }

  return idsPorNomeGuerra;
}

function inserirTiposDeServico(postos: Record<string, number>, cursos: Record<string, number>) {
  // Tabela 1 do detalhamento: posto/graduação privativo e curso exigido por tipo de serviço.
  const catalogo: {
    nome: string;
    descricao: string;
    efetivo: number;
    posto: string;
    curso: string | null;
  }[] = [
    { nome: 'Guarda', descricao: 'Serviço de guarda do aquartelamento.', efetivo: 3, posto: 'Rct', curso: null },
    {
      nome: 'Plantão ao Alojamento',
      descricao: 'Permanência e controle do alojamento da tropa.',
      efetivo: 2,
      posto: 'Rct',
      curso: null
    },
    {
      nome: 'Rancheiro de Dia',
      descricao: 'Apoio ao rancho durante as três refeições do dia.',
      efetivo: 1,
      posto: 'Rct',
      curso: 'Rancho'
    },
    {
      nome: 'Monitoramento',
      descricao: 'Operação da central de monitoramento e comunicações.',
      efetivo: 1,
      posto: 'Sd EP',
      curso: null
    },
    {
      nome: 'Motorista de Dia',
      descricao: 'Condução da viatura de serviço durante o turno de 24 horas.',
      efetivo: 1,
      posto: 'Sd EP',
      curso: 'Curso de Motorista'
    },
    {
      nome: 'Cabo de Dia',
      descricao: 'Auxílio ao comando da guarda e controle de entrada e saída.',
      efetivo: 1,
      posto: 'Sd EP',
      curso: 'CFC'
    },
    {
      nome: 'Cabo da Guarda',
      descricao: 'Chefia direta dos sentinelas do serviço de guarda.',
      efetivo: 1,
      posto: 'Cb',
      curso: null
    },
    {
      nome: 'Cozinheiro de Dia',
      descricao: 'Preparo das refeições e conferência do gênero alimentício.',
      efetivo: 1,
      posto: 'Cb',
      curso: 'Rancho'
    },
    {
      nome: 'Comandante da Guarda',
      descricao: 'Comando do serviço de guarda no turno de 24 horas.',
      efetivo: 1,
      posto: '3º Sgt',
      curso: null
    },
    {
      nome: 'Graduado do Rancho',
      descricao: 'Fiscalização do rancho e do preparo das refeições.',
      efetivo: 1,
      posto: '3º Sgt',
      curso: 'Rancho'
    },
    {
      nome: 'Graduado do Dia',
      descricao: 'Coordenação dos serviços de graduados no aquartelamento.',
      efetivo: 1,
      posto: '2º Sgt',
      curso: null
    },
    {
      nome: 'Oficial de Dia',
      descricao: 'Autoridade máxima do serviço no período de 24 horas.',
      efetivo: 1,
      posto: 'Ten',
      curso: null
    }
  ];

  const inserirTipo = banco.prepare(
    `INSERT INTO TIPO_SERVICO (nome, descricao, efetivo_necessario, hora_inicio, duracao_horas, exige_pernoite, ativo)
     VALUES (?, ?, ?, '08:00', 24, 1, 1)`
  );
  const inserirRequisito = banco.prepare(
    'INSERT INTO REQUISITO_SERVICO (id_tipo_servico, id_posto, id_curso, obrigatorio) VALUES (?, ?, ?, 1)'
  );

  const ids: Record<string, number> = {};
  for (const item of catalogo) {
    const resultado = inserirTipo.run(item.nome, item.descricao, item.efetivo);
    const idTipo = Number(resultado.lastInsertRowid);
    inserirRequisito.run(idTipo, postos[item.posto], item.curso ? cursos[item.curso] : null);
    ids[item.nome] = idTipo;
  }
  return ids;
}

function inserirRegras(tipos: Record<string, number>, idUsuarioSargenteante: number) {
  // Limites por família de serviço, calibrados pelo efetivo de cada posto/graduação.
  const parametros: Record<string, { minimo: number; maximo: number; intervalo: number; mes: number }> = {
    Guarda: { minimo: 3, maximo: 12, intervalo: 4, mes: 8 },
    'Plantão ao Alojamento': { minimo: 3, maximo: 12, intervalo: 4, mes: 8 },
    'Rancheiro de Dia': { minimo: 3, maximo: 12, intervalo: 4, mes: 8 },
    Monitoramento: { minimo: 4, maximo: 15, intervalo: 5, mes: 6 },
    'Motorista de Dia': { minimo: 4, maximo: 15, intervalo: 5, mes: 6 },
    'Cabo de Dia': { minimo: 4, maximo: 15, intervalo: 5, mes: 6 },
    'Cabo da Guarda': { minimo: 4, maximo: 15, intervalo: 5, mes: 6 },
    'Cozinheiro de Dia': { minimo: 3, maximo: 12, intervalo: 4, mes: 8 },
    'Comandante da Guarda': { minimo: 3, maximo: 12, intervalo: 4, mes: 8 },
    'Graduado do Rancho': { minimo: 3, maximo: 10, intervalo: 4, mes: 8 },
    'Graduado do Dia': { minimo: 3, maximo: 10, intervalo: 4, mes: 8 },
    'Oficial de Dia': { minimo: 3, maximo: 10, intervalo: 4, mes: 8 }
  };

  const inserir = banco.prepare(
    `INSERT INTO REGRA_ESCALA
       (id_tipo_servico, ciclo_minimo, ciclo_maximo, dias_servico, intervalo_minimo,
        max_servicos_mes, vigencia_inicio, vigencia_fim, id_usuario_criacao)
     VALUES (?, ?, ?, 1, ?, ?, ?, NULL, ?)`
  );
  const inicioVigencia = somarDias(hojeISO(), -365);
  for (const [nome, idTipo] of Object.entries(tipos)) {
    const p = parametros[nome];
    inserir.run(idTipo, p.minimo, p.maximo, p.intervalo, p.mes, inicioVigencia, idUsuarioSargenteante);
  }
}

function inserirImpedimentos(ids: Map<string, number>, idUsuarioSargenteante: number) {
  const hoje = hojeISO();
  const inserir = banco.prepare(
    `INSERT INTO MISSAO (id_militar, tipo, descricao, data_inicio, data_fim, id_usuario_registro, data_registro)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  const atualizarRetorno = banco.prepare(
    'UPDATE MILITAR SET data_fim_ultima_missao = ? WHERE id_militar = ?'
  );

  const impedimentos: { nomeGuerra: string; tipo: string; descricao: string; de: number; ate: number }[] = [
    {
      nomeGuerra: 'Bastos',
      tipo: 'MISSAO',
      descricao: 'Segurança de comboio logístico para Ponta Grossa.',
      de: 2,
      ate: 9
    },
    {
      nomeGuerra: 'Camargo',
      tipo: 'FERIAS',
      descricao: 'Férias regulamentares do primeiro semestre.',
      de: 5,
      ate: 25
    },
    {
      nomeGuerra: 'Klein',
      tipo: 'MISSAO',
      descricao: 'Apoio de transporte ao exercício no campo de instrução.',
      de: 1,
      ate: 6
    },
    {
      nomeGuerra: 'Salgado',
      tipo: 'DISPENSA',
      descricao: 'Dispensa médica por procedimento ortopédico.',
      de: 3,
      ate: 12
    },
    {
      nomeGuerra: 'Poletto',
      tipo: 'MISSAO',
      descricao: 'Curso de atualização na guarnição de Curitiba.',
      de: -4,
      ate: -1
    },
    {
      nomeGuerra: 'Bispo',
      tipo: 'MISSAO',
      descricao: 'Representação do batalhão em solenidade regional.',
      de: 8,
      ate: 11
    }
  ];

  for (const impedimento of impedimentos) {
    const idMilitar = ids.get(impedimento.nomeGuerra);
    if (!idMilitar) continue;
    const dataInicio = somarDias(hoje, impedimento.de);
    const dataFim = somarDias(hoje, impedimento.ate);
    inserir.run(
      idMilitar,
      impedimento.tipo,
      impedimento.descricao,
      dataInicio,
      dataFim,
      idUsuarioSargenteante,
      agoraISO()
    );
    atualizarRetorno.run(dataFim, idMilitar);
  }
}

function mapaDe(consulta: string): Record<string, number> {
  const linhas = banco.prepare(consulta).all() as { id: number; chave: string }[];
  return Object.fromEntries(linhas.map((l) => [l.chave, l.id]));
}

function semAcento(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

function executar() {
  const idsPorNomeGuerra = emTransacao(() => {
    const postos = inserirPostos();
    const cursos = inserirCursos();
    const perfis = inserirPerfisEPermissoes();
    const ids = inserirEfetivo(postos, cursos, perfis);
    const tipos = inserirTiposDeServico(postos, cursos);

    const sargenteante = banco
      .prepare('SELECT id_usuario FROM USUARIO WHERE id_militar = ?')
      .get(ids.get('Rossato')) as { id_usuario: number };

    inserirRegras(tipos, sargenteante.id_usuario);
    inserirImpedimentos(ids, sargenteante.id_usuario);
    return ids;
  });

  const usuarioDe = (nomeGuerra: string) =>
    (
      banco.prepare('SELECT id_usuario FROM USUARIO WHERE id_militar = ?').get(
        idsPorNomeGuerra.get(nomeGuerra)
      ) as { id_usuario: number }
    ).id_usuario;

  const idSargenteante = usuarioDe('Rossato');
  const idCabo = usuarioDe('Petry');

  // A escala do mês corrente é gerada pelo próprio motor (UC05) e publicada, para que o sistema
  // já abra com um ciclo real de dados em vez de registros artificiais.
  const inicio = hojeISO().slice(0, 8) + '01';
  const fim = somarDias(`${proximoMes(inicio)}-01`, -1);

  const relatorio = aplicacao.geradorEscalaService.gerar({
    dataInicio: inicio,
    dataFim: fim,
    descricao: `Escala ${nomeDoMes(inicio)}`,
    confirmarCicloAbaixoDoMinimo: true,
    idUsuario: idCabo
  });
  aplicacao.geradorEscalaService.publicar(relatorio.idEscala, idSargenteante);

  criarSolicitacoesDeExemplo(idsPorNomeGuerra, idCabo);

  const contar = (tabela: string) =>
    (banco.prepare(`SELECT COUNT(*) AS total FROM ${tabela}`).get() as { total: number }).total;

  console.log('Seed aplicado.');
  console.log(`  militares .............. ${contar('MILITAR')}`);
  console.log(`  tipos de serviço ....... ${contar('TIPO_SERVICO')}`);
  console.log(`  regras da escala ....... ${contar('REGRA_ESCALA')}`);
  console.log(`  impedimentos ........... ${contar('MISSAO')}`);
  console.log(`  dias de escala ......... ${contar('DIA_ESCALA')}`);
  console.log(`  serviços escalados ..... ${contar('SERVICO_ESCALADO')}`);
  console.log(`  solicitações de troca .. ${contar('SOLICITACAO_TROCA')}`);
  console.log(`  notificações ........... ${contar('NOTIFICACAO')}`);
  console.log('');
  console.log(`Ciclos apurados para ${relatorio.periodo.inicio} a ${relatorio.periodo.fim}:`);
  for (const ciclo of relatorio.ciclos) {
    console.log(
      `  ${ciclo.nomeTipoServico.padEnd(24)} ${ciclo.proporcao.padStart(6)}  ` +
        `(${ciclo.efetivoElegivel} elegíveis / ${ciclo.efetivoDiarioExigido} por dia)`
    );
  }
  if (relatorio.totalPendencias > 0) {
    console.log(`  ${relatorio.totalPendencias} vaga(s) sem militar elegível.`);
  }
  console.log('');
  console.log(`Acesso (senha "${SENHA_PADRAO}" para todos):`);
  for (const nomeGuerra of ['Rossato', 'Petry', 'Bueno', 'Kaminski']) {
    const linha = banco
      .prepare(
        `SELECT u.login, pf.nome AS perfil, p.sigla, m.nome_guerra
         FROM USUARIO u
         JOIN PERFIL_ACESSO pf ON pf.id_perfil = u.id_perfil
         JOIN MILITAR m ON m.id_militar = u.id_militar
         JOIN POSTO_GRADUACAO p ON p.id_posto = m.id_posto
         WHERE m.id_militar = ?`
      )
      .get(idsPorNomeGuerra.get(nomeGuerra)) as {
      login: string;
      perfil: string;
      sigla: string;
      nome_guerra: string;
    };
    console.log(`  ${linha.login}  ${linha.sigla} ${linha.nome_guerra}`.padEnd(34) + linha.perfil);
  }
}

/** Deixa a fila de trocas com casos nos dois estágios da cadeia de aprovação do MilScale. */
function criarSolicitacoesDeExemplo(ids: Map<string, number>, idUsuarioCabo: number) {
  const candidatos = escalaRepositorio
    .servicosPorPeriodo({ inicio: somarDias(hojeISO(), 3), fim: somarDias(hojeISO(), 20) })
    .filter((s) => s.id_militar);

  const motivos = [
    'Casamento de familiar em Londrina no fim de semana.',
    'Consulta médica agendada fora da guarnição.',
    'Compromisso acadêmico: prova presencial no período do serviço.'
  ];

  let criadas = 0;
  for (const servico of candidatos) {
    if (criadas >= 3) break;
    const substitutos = aplicacao.solicitacaoTrocaService.substitutosPossiveis(
      servico.id_servico_escalado
    );
    if (substitutos.length === 0) continue;

    const usuarioSolicitante = banco
      .prepare('SELECT id_usuario FROM USUARIO WHERE id_militar = ?')
      .get(servico.id_militar) as { id_usuario: number };

    const solicitacao = aplicacao.solicitacaoTrocaService.registrar({
      idServicoEscalado: servico.id_servico_escalado,
      idMilitarSolicitante: servico.id_militar as number,
      idMilitarSubstituto: substitutos[0].id_militar,
      motivo: motivos[criadas],
      idUsuario: usuarioSolicitante.id_usuario
    });

    // A primeira solicitação já recebe a triagem do cabo e fica aguardando o sargenteante.
    if (criadas === 0 && solicitacao) {
      aplicacao.solicitacaoTrocaService.avaliar({
        idSolicitacao: solicitacao.id_solicitacao,
        decisao: 'APROVAR',
        justificativa: 'Substituto elegível, sem impacto no efetivo do dia.',
        usuario: {
          id_usuario: idUsuarioCabo,
          id_militar: ids.get('Petry') as number,
          id_perfil: 3,
          login: '',
          perfil: 'CABO_SARGENTEACAO',
          nome_guerra: 'Petry',
          nome_completo: '',
          sigla_posto: 'Cb',
          permissoes: []
        }
      });
    }
    criadas += 1;
  }

  if (solicitacaoRepositorio.listar().length === 0) {
    console.log('Nenhuma solicitação de exemplo pôde ser criada com o efetivo disponível.');
  }
}

function proximoMes(data: string): string {
  const ano = Number(data.slice(0, 4));
  const mes = Number(data.slice(5, 7));
  return mes === 12 ? `${ano + 1}-01` : `${ano}-${String(mes + 1).padStart(2, '0')}`;
}

function nomeDoMes(data: string): string {
  const nomes = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  return `${nomes[Number(data.slice(5, 7)) - 1]}/${data.slice(0, 4)}`;
}

executar();
