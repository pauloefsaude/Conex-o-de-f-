// Conteúdo estático do MVP. Todos os textos são originais do projeto.
// Versículos aparecem apenas como referência; o texto bíblico deve vir de uma tradução
// licenciada (ex.: acordo com a editora) ou de domínio público, a definir antes do lançamento.

// Cidades com coordenadas aproximadas do centro — o app nunca envia GPS preciso.
export const CITIES = {
  'sao-paulo-sp': ['São Paulo', 'SP', -23.55, -46.63], 'rio-de-janeiro-rj': ['Rio de Janeiro', 'RJ', -22.91, -43.17],
  'belo-horizonte-mg': ['Belo Horizonte', 'MG', -19.92, -43.94], 'brasilia-df': ['Brasília', 'DF', -15.79, -47.88],
  'salvador-ba': ['Salvador', 'BA', -12.97, -38.50], 'fortaleza-ce': ['Fortaleza', 'CE', -3.73, -38.52],
  'recife-pe': ['Recife', 'PE', -8.05, -34.88], 'curitiba-pr': ['Curitiba', 'PR', -25.43, -49.27],
  'porto-alegre-rs': ['Porto Alegre', 'RS', -30.03, -51.23], 'manaus-am': ['Manaus', 'AM', -3.12, -60.02],
  'belem-pa': ['Belém', 'PA', -1.46, -48.49], 'goiania-go': ['Goiânia', 'GO', -16.68, -49.25],
  'florianopolis-sc': ['Florianópolis', 'SC', -27.60, -48.55], 'vitoria-es': ['Vitória', 'ES', -20.32, -40.34],
  'natal-rn': ['Natal', 'RN', -5.79, -35.21], 'joao-pessoa-pb': ['João Pessoa', 'PB', -7.12, -34.86],
  'maceio-al': ['Maceió', 'AL', -9.67, -35.74], 'aracaju-se': ['Aracaju', 'SE', -10.91, -37.07],
  'teresina-pi': ['Teresina', 'PI', -5.09, -42.80], 'sao-luis-ma': ['São Luís', 'MA', -2.53, -44.30],
  'campo-grande-ms': ['Campo Grande', 'MS', -20.47, -54.62], 'cuiaba-mt': ['Cuiabá', 'MT', -15.60, -56.10],
  'porto-velho-ro': ['Porto Velho', 'RO', -8.76, -63.90], 'rio-branco-ac': ['Rio Branco', 'AC', -9.97, -67.81],
  'macapa-ap': ['Macapá', 'AP', 0.03, -51.07], 'boa-vista-rr': ['Boa Vista', 'RR', 2.82, -60.67],
  'palmas-to': ['Palmas', 'TO', -10.18, -48.33], 'campinas-sp': ['Campinas', 'SP', -22.91, -47.06],
  'santos-sp': ['Santos', 'SP', -23.96, -46.33], 'ribeirao-preto-sp': ['Ribeirão Preto', 'SP', -21.18, -47.81],
  'londrina-pr': ['Londrina', 'PR', -23.31, -51.16], 'juiz-de-fora-mg': ['Juiz de Fora', 'MG', -21.76, -43.35],
  'uberlandia-mg': ['Uberlândia', 'MG', -18.92, -48.28], 'niteroi-rj': ['Niterói', 'RJ', -22.88, -43.10],
  'joinville-sc': ['Joinville', 'SC', -26.30, -48.85], 'feira-de-santana-ba': ['Feira de Santana', 'BA', -12.27, -38.97],
};

export const OPTIONS = {
  denominations: ['Católica', 'Batista', 'Assembleia de Deus', 'Presbiteriana', 'Metodista', 'Luterana',
    'Adventista', 'Congregação Cristã', 'Quadrangular', 'Universal', 'Comunidade/Independente',
    'Ortodoxa', 'Anglicana', 'Outra', 'Prefiro não dizer'],
  churchFrequency: ['Mais de uma vez por semana', 'Semanalmente', 'Algumas vezes por mês', 'Ocasionalmente', 'Prefiro não dizer'],
  relationshipGoals: ['Amizade', 'Namoro sério', 'Casamento', 'Ainda descobrindo'],
  wantsChildren: ['Quero ter', 'Já tenho e quero mais', 'Já tenho', 'Não quero', 'Ainda não sei'],
  values: ['Sinceridade', 'Fidelidade', 'Família', 'Generosidade', 'Paciência', 'Humildade', 'Bom humor',
    'Responsabilidade', 'Serviço ao próximo', 'Respeito', 'Perdão', 'Disciplina'],
  interests: ['Música', 'Louvor', 'Leitura', 'Estudo bíblico', 'Viagens', 'Cozinhar', 'Esportes', 'Corrida',
    'Trilhas', 'Cinema', 'Voluntariado', 'Missões', 'Fotografia', 'Café', 'Jogos de tabuleiro', 'Praia',
    'Dança', 'Tecnologia', 'Artes', 'Natureza', 'Pets', 'Idiomas'],
};

export const PROFILE_QUESTIONS = [
  'Qual é o papel da fé na sua vida?',
  'O que você mais valoriza em um relacionamento?',
  'Como você imagina sua família no futuro?',
  'Quais valores considera indispensáveis em um casamento?',
  'Qual experiência fortaleceu sua fé?',
  'Como você gosta de passar seu tempo livre?',
  'O que significa caminhar com Deus ao lado de alguém?',
];

export const CONVERSATION_STARTERS = [
  'Qual foi a última coisa que te fez sorrir de verdade?',
  'Que lugar você gostaria de conhecer e por quê?',
  'Tem alguma música de louvor que marcou uma fase da sua vida?',
  'Como é um domingo ideal para você?',
  'Que pessoa inspira você na caminhada de fé?',
  'O que você está aprendendo neste momento da vida?',
  'Qual hábito simples faz diferença no seu dia?',
];

export const INSPIRATION = [
  { id: 1, kind: 'versiculo', title: 'O amor que permanece', ref: '1 Coríntios 13:4-7',
    body: 'Paulo descreve o amor por atitudes, não por sentimentos: paciência, gentileza, ausência de inveja e de orgulho. Uma boa pergunta para hoje: qual dessas atitudes você quer praticar mais nesta semana?' },
  { id: 2, kind: 'reflexao', title: 'Sem pressa, com propósito',
    body: 'Conhecer alguém leva tempo. Conversas sinceras, limites claros e respeito pelo ritmo do outro valem mais do que a empolgação dos primeiros dias.' },
  { id: 3, kind: 'comunicacao', title: 'Ouvir antes de responder', ref: 'Tiago 1:19',
    body: 'Na conversa a dois, perguntar "o que você quis dizer?" evita muitos mal-entendidos. Escutar com atenção é uma forma concreta de cuidado.' },
  { id: 4, kind: 'responsabilidade', title: 'Responsabilidade afetiva',
    body: 'Se o interesse acabou, diga com gentileza em vez de sumir. Clareza é um ato de respeito com o coração de outra pessoa.' },
  { id: 5, kind: 'oracao', title: 'Uma oração para hoje',
    body: 'Senhor, dá-me um coração sereno para esperar, sabedoria para escolher e humildade para amar. Que minhas palavras edifiquem quem eu encontrar. Amém.' },
  { id: 6, kind: 'esperanca', title: 'Esperança no caminho', ref: 'Jeremias 29:11',
    body: 'Esperar não precisa ser um tempo vazio. Ele pode ser vivido com amizades, serviço e crescimento pessoal.' },
  { id: 7, kind: 'seguranca', title: 'Primeiro encontro com segurança',
    body: 'Marque em local público, avise alguém de confiança e vá com seu próprio transporte. Quem tem boas intenções vai entender e respeitar esses cuidados.' },
  { id: 8, kind: 'seguranca', title: 'Pedido de dinheiro é sinal de alerta',
    body: 'Ninguém com boas intenções pede dinheiro, Pix ou presentes a quem acabou de conhecer. Se isso acontecer, não envie e use o botão de denúncia.' },
];

export const HELP_FAQ = [
  { q: 'Como funciona uma combinação?', a: 'Quando duas pessoas se curtem, a conversa é liberada para as duas. Ninguém consegue mandar mensagem sem essa curtida mútua — nem assinantes.' },
  { q: 'Quem vê minha denominação?', a: 'Só quem você permitir. Em Privacidade, cada informação religiosa pode ficar visível ou oculta. Por padrão, ficam ocultas.' },
  { q: 'Como a compatibilidade é calculada?', a: 'Somamos pontos por objetivos de relacionamento, interesses e valores em comum, desejo de ter filhos e distância. Mostramos os motivos de cada sugestão. É um indicador das informações declaradas, não uma promessa.' },
  { q: 'O que significa o selo de e-mail verificado?', a: 'Apenas que a pessoa confirmou o endereço de e-mail. Não é verificação de identidade.' },
  { q: 'Alguém me pediu dinheiro. O que faço?', a: 'Não envie. Denuncie a conversa pelo menu ⋯ e bloqueie a pessoa. Nossa equipe analisa as denúncias.' },
  { q: 'Como excluo minha conta?', a: 'Em Perfil > Excluir conta. Apagamos perfil, fotos, curtidas e mensagens. Guardamos apenas registros mínimos de denúncias quando exigido para segurança de outras pessoas.' },
];
