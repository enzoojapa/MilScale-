/** Efetivo fictício do batalhão usado no seed, com nomes de guerra plausíveis. */
export interface EfetivoSemente {
  nome_completo: string;
  nome_guerra: string;
  cursos: string[];
}

export const recrutas: EfetivoSemente[] = [
  { nome_completo: 'Adriano Ferreira Bastos', nome_guerra: 'Bastos', cursos: [] },
  { nome_completo: 'Alan Ribeiro da Costa', nome_guerra: 'Alan', cursos: ['Rancho'] },
  { nome_completo: 'Alex Bonfim Teixeira', nome_guerra: 'Bonfim', cursos: [] },
  { nome_completo: 'André Luiz Camargo', nome_guerra: 'Camargo', cursos: [] },
  { nome_completo: 'Bruno Kaminski Alves', nome_guerra: 'Kaminski', cursos: ['Rancho'] },
  { nome_completo: 'Caio Vinícius Prado', nome_guerra: 'Prado', cursos: [] },
  { nome_completo: 'Carlos Eduardo Munhoz', nome_guerra: 'Munhoz', cursos: [] },
  { nome_completo: 'Cleber Antunes Rocha', nome_guerra: 'Antunes', cursos: ['Rancho'] },
  { nome_completo: 'Daniel Siqueira Lopes', nome_guerra: 'Siqueira', cursos: [] },
  { nome_completo: 'Danilo Fagundes Reis', nome_guerra: 'Fagundes', cursos: [] },
  { nome_completo: 'Diego Wisniewski Paz', nome_guerra: 'Wisniewski', cursos: ['Rancho'] },
  { nome_completo: 'Douglas Meireles Pinto', nome_guerra: 'Meireles', cursos: [] },
  { nome_completo: 'Éderson Vaz Barreto', nome_guerra: 'Vaz', cursos: [] },
  { nome_completo: 'Emerson Grigoletto Dias', nome_guerra: 'Grigoletto', cursos: ['Rancho'] },
  { nome_completo: 'Everton Sampaio Nunes', nome_guerra: 'Sampaio', cursos: [] },
  { nome_completo: 'Fábio Henrique Zanella', nome_guerra: 'Zanella', cursos: [] },
  { nome_completo: 'Felipe Andrade Moreira', nome_guerra: 'Andrade', cursos: ['Rancho'] },
  { nome_completo: 'Gabriel Stresser Coelho', nome_guerra: 'Stresser', cursos: [] },
  { nome_completo: 'Gustavo Pilatti Marques', nome_guerra: 'Pilatti', cursos: [] },
  { nome_completo: 'Heitor Balbino Sales', nome_guerra: 'Balbino', cursos: ['Rancho'] },
  { nome_completo: 'Igor Trevisan Lemos', nome_guerra: 'Trevisan', cursos: [] },
  { nome_completo: 'Jean Carlos Pedroso', nome_guerra: 'Pedroso', cursos: [] },
  { nome_completo: 'João Vitor Feltrin', nome_guerra: 'Feltrin', cursos: ['Rancho'] },
  { nome_completo: 'Jonatas Mendonça Vieira', nome_guerra: 'Mendonça', cursos: [] },
  { nome_completo: 'Kevin Rauber Schmitt', nome_guerra: 'Rauber', cursos: [] },
  { nome_completo: 'Leandro Bittencourt Rosa', nome_guerra: 'Bittencourt', cursos: ['Rancho'] },
  { nome_completo: 'Lucas Portela Amaral', nome_guerra: 'Portela', cursos: [] },
  { nome_completo: 'Marcelo Kruger Deniz', nome_guerra: 'Kruger', cursos: [] },
  { nome_completo: 'Mateus Salvador Chaves', nome_guerra: 'Salvador', cursos: [] },
  { nome_completo: 'Otávio Bertoldi Franco', nome_guerra: 'Bertoldi', cursos: [] },
  { nome_completo: 'Rafael Godoy Simas', nome_guerra: 'Godoy', cursos: [] },
  { nome_completo: 'Renan Cavalheiro Luz', nome_guerra: 'Cavalheiro', cursos: [] },
  { nome_completo: 'Thiago Possamai Brito', nome_guerra: 'Possamai', cursos: [] },
  { nome_completo: 'Vinícius Hauer Correia', nome_guerra: 'Hauer', cursos: [] },
  { nome_completo: 'Wesley Iurk Barbosa', nome_guerra: 'Iurk', cursos: [] },
  { nome_completo: 'Yuri Dalpra Fontes', nome_guerra: 'Dalpra', cursos: [] }
];

export const soldadosEp: EfetivoSemente[] = [
  { nome_completo: 'Alexandre Bueno Tavares', nome_guerra: 'Bueno', cursos: ['CFC'] },
  { nome_completo: 'Anderson Klein Ramos', nome_guerra: 'Klein', cursos: ['Curso de Motorista'] },
  { nome_completo: 'Augusto Cesar Perego', nome_guerra: 'Perego', cursos: ['CFC'] },
  { nome_completo: 'Cristian Volpato Neves', nome_guerra: 'Volpato', cursos: ['Curso de Motorista'] },
  { nome_completo: 'Danilo Sperandio Rocha', nome_guerra: 'Sperandio', cursos: ['CFC'] },
  { nome_completo: 'Edson Mesquita Faria', nome_guerra: 'Mesquita', cursos: ['Curso de Motorista'] },
  { nome_completo: 'Fernando Bianchi Souza', nome_guerra: 'Bianchi', cursos: ['CFC', 'Curso de Motorista'] },
  { nome_completo: 'Gilberto Nardi Prestes', nome_guerra: 'Nardi', cursos: [] },
  { nome_completo: 'Guilherme Zaninelli Mota', nome_guerra: 'Zaninelli', cursos: ['CFC'] },
  { nome_completo: 'Henrique Doin Castro', nome_guerra: 'Doin', cursos: ['Curso de Motorista'] },
  { nome_completo: 'Jaime Ostrowski Lima', nome_guerra: 'Ostrowski', cursos: ['CFC'] },
  { nome_completo: 'Juliano Cordeiro Maia', nome_guerra: 'Cordeiro', cursos: [] },
  { nome_completo: 'Kleber Fachini Domingues', nome_guerra: 'Fachini', cursos: ['Curso de Motorista'] },
  { nome_completo: 'Luan Ceccon Guimarães', nome_guerra: 'Ceccon', cursos: ['CFC'] },
  { nome_completo: 'Marcos Vinícius Tramontin', nome_guerra: 'Tramontin', cursos: ['Curso de Motorista'] },
  { nome_completo: 'Murilo Angeli Peixoto', nome_guerra: 'Angeli', cursos: ['CFC'] },
  { nome_completo: 'Nelson Kuhn Batista', nome_guerra: 'Kuhn', cursos: [] },
  { nome_completo: 'Patrick Zago Almeida', nome_guerra: 'Zago', cursos: ['Curso de Motorista'] },
  { nome_completo: 'Rodrigo Sandri Machado', nome_guerra: 'Sandri', cursos: ['CFC'] },
  { nome_completo: 'Samuel Franzoi Duarte', nome_guerra: 'Franzoi', cursos: [] },
  { nome_completo: 'Tiago Bergamo Prates', nome_guerra: 'Bergamo', cursos: ['Curso de Motorista'] },
  { nome_completo: 'Vagner Ludwig Freire', nome_guerra: 'Ludwig', cursos: ['CFC'] },
  { nome_completo: 'Willian Modesto Carvalho', nome_guerra: 'Modesto', cursos: [] },
  { nome_completo: 'Éric Zanotto Pacheco', nome_guerra: 'Zanotto', cursos: ['CFC'] }
];

export const cabos: EfetivoSemente[] = [
  { nome_completo: 'Aline Petry Marcondes', nome_guerra: 'Petry', cursos: ['Rancho'] },
  { nome_completo: 'Bruno Salgado Ferrari', nome_guerra: 'Salgado', cursos: [] },
  { nome_completo: 'Cesar Bortolini Nogueira', nome_guerra: 'Bortolini', cursos: ['Rancho'] },
  { nome_completo: 'Diego Lazzarotto Pires', nome_guerra: 'Lazzarotto', cursos: [] },
  { nome_completo: 'Elias Manfroi Gomes', nome_guerra: 'Manfroi', cursos: ['Rancho'] },
  { nome_completo: 'Fernanda Ruthes Padilha', nome_guerra: 'Ruthes', cursos: [] },
  { nome_completo: 'Gilmar Tonon Xavier', nome_guerra: 'Tonon', cursos: ['Rancho'] },
  { nome_completo: 'Hugo Delgado Martins', nome_guerra: 'Delgado', cursos: [] },
  { nome_completo: 'Ivan Bochenek Araújo', nome_guerra: 'Bochenek', cursos: ['Rancho'] },
  { nome_completo: 'Jonas Piccoli Ribas', nome_guerra: 'Piccoli', cursos: [] },
  { nome_completo: 'Luciano Foggiato Serra', nome_guerra: 'Foggiato', cursos: ['Rancho'] },
  { nome_completo: 'Marcelo Trindade Aquino', nome_guerra: 'Trindade', cursos: [] },
  { nome_completo: 'Paulo Guerra Assunção', nome_guerra: 'Guerra', cursos: ['Rancho'] },
  { nome_completo: 'Ricardo Sanches Vilela', nome_guerra: 'Sanches', cursos: [] },
  { nome_completo: 'Sérgio Bandeira Fialho', nome_guerra: 'Bandeira', cursos: ['Rancho'] },
  { nome_completo: 'Tatiane Kozak Ferrão', nome_guerra: 'Kozak', cursos: [] }
];

export const terceirosSargentos: EfetivoSemente[] = [
  { nome_completo: 'Adilson Petrucci Vargas', nome_guerra: 'Petrucci', cursos: ['Rancho'] },
  { nome_completo: 'Carla Bispo Andrade', nome_guerra: 'Bispo', cursos: [] },
  { nome_completo: 'Denis Fabris Toledo', nome_guerra: 'Fabris', cursos: ['Rancho'] },
  { nome_completo: 'Fabiano Roldão Cunha', nome_guerra: 'Roldão', cursos: [] },
  { nome_completo: 'Gerson Maggi Antunes', nome_guerra: 'Maggi', cursos: ['Rancho'] },
  { nome_completo: 'Ivo Constante Barros', nome_guerra: 'Constante', cursos: [] },
  { nome_completo: 'Jaqueline Ferrarini Melo', nome_guerra: 'Ferrarini', cursos: ['Rancho'] },
  { nome_completo: 'Márcio Sbardelotto Reis', nome_guerra: 'Sbardelotto', cursos: [] },
  { nome_completo: 'Rogério Dallabrida Lisboa', nome_guerra: 'Dallabrida', cursos: ['Rancho'] },
  { nome_completo: 'Vanderlei Poletto Cruz', nome_guerra: 'Poletto', cursos: [] }
];

export const segundosSargentos: EfetivoSemente[] = [
  { nome_completo: 'Anderson Ribas Colombo', nome_guerra: 'Colombo', cursos: [] },
  { nome_completo: 'Cleiton Marostica Guedes', nome_guerra: 'Marostica', cursos: [] },
  { nome_completo: 'Fabrício Zonta Peralta', nome_guerra: 'Zonta', cursos: [] },
  { nome_completo: 'Juliana Rossato Menezes', nome_guerra: 'Rossato', cursos: [] },
  { nome_completo: 'Rodrigo Balestrin Cardoso', nome_guerra: 'Balestrin', cursos: [] },
  { nome_completo: 'Wagner Debortoli Ávila', nome_guerra: 'Debortoli', cursos: [] }
];

export const tenentes: EfetivoSemente[] = [
  { nome_completo: 'Bruno Wenceslau Athayde', nome_guerra: 'Wenceslau', cursos: [] },
  { nome_completo: 'Camila Portugal Bastos', nome_guerra: 'Portugal', cursos: [] },
  { nome_completo: 'Eduardo Menegatti Rangel', nome_guerra: 'Menegatti', cursos: [] },
  { nome_completo: 'Leonardo Vasques Amorim', nome_guerra: 'Vasques', cursos: [] },
  { nome_completo: 'Rafael Bocchi Monteiro', nome_guerra: 'Bocchi', cursos: [] }
];
