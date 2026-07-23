export type NeuralCastArticleSection = {
  heading?: string;
  paragraphs: string[];
  bullets?: string[];
};

export type NeuralCastArticle = {
  slug: string;
  title: string;
  eyebrow: string;
  category: "Liderança" | "Comportamento" | "Cultura";
  excerpt: string;
  publishedAt: string;
  readTime: string;
  featured?: boolean;
  quote?: string;
  sections: NeuralCastArticleSection[];
  closingQuestion?: string;
};

export type NeuralCastReel = {
  title: string;
  permalink: string;
  embedUrl: string;
};

export const NEURALCAST_REELS: NeuralCastReel[] = [
  {
    title: "Trabalho individual também traz resultados",
    permalink: "https://www.instagram.com/reel/DVRE4f0jbe2/",
    embedUrl: "https://www.instagram.com/reel/DVRE4f0jbe2/embed",
  },
  {
    title: "Fundamentos da neurociência organizacional",
    permalink: "https://www.instagram.com/reel/DTlP24EDOzp/",
    embedUrl: "https://www.instagram.com/reel/DTlP24EDOzp/embed",
  },
  {
    title: "Quanto tempo dura uma paixão?",
    permalink: "https://www.instagram.com/reel/DVYf3GWjgAk/",
    embedUrl: "https://www.instagram.com/reel/DVYf3GWjgAk/embed",
  },
  {
    title: "Você está jogando com as cartas certas?",
    permalink: "https://www.instagram.com/reel/DVs-330jeiS/",
    embedUrl: "https://www.instagram.com/reel/DVs-330jeiS/embed",
  },
  {
    title: "Pedro Luiz Pereira e Luiza Fröhlich sobre RH, liderança e desenvolvimento de executivos",
    permalink: "https://www.instagram.com/reel/DWR5CscDY34/",
    embedUrl: "https://www.instagram.com/reel/DWR5CscDY34/embed",
  },
];

export const NEURALCAST_ARTICLES: NeuralCastArticle[] = [
  {
    slug: "lideres-nao-nascem-prontos",
    title: "Líderes não nascem prontos",
    eyebrow: "Neurociência em pauta",
    category: "Liderança",
    excerpt:
      "Liderança não é um talento acabado. Ela se desenvolve com autoconhecimento, prática, responsabilidade e evolução contínua.",
    publishedAt: "21 de julho de 2026",
    readTime: "5 min de leitura",
    featured: true,
    quote: "Liderar não é ocupar um cargo. É assumir o compromisso diário de evoluir e desenvolver pessoas.",
    sections: [
      {
        paragraphs: [
          "Por que aplicamos testagens de perfil? A própria pergunta ajuda a explicar o ponto central: as pessoas nascem com determinadas predisposições comportamentais, e essas características participam da formação da personalidade.",
          "Por isso, uma contratação bem conduzida depende também da compreensão do perfil. Muitas rupturas profissionais não acontecem por falta de conhecimento técnico, mas por incompatibilidades comportamentais, relacionais e de contexto.",
        ],
      },
      {
        heading: "Potencial não elimina desenvolvimento",
        paragraphs: [
          "Algumas pessoas estão mais próximas das competências essenciais para liderar. Outras estão mais distantes. Podemos ainda dizer que determinadas pessoas, por mais que queiram, dificilmente alcançarão o mesmo nível de naturalidade em todas essas competências.",
          "Isso não significa que o desenvolvimento seja inútil. Significa apenas que autoconhecimento e contexto importam. Quem reconhece suas forças, limites e padrões consegue escolher melhor como evoluir e onde contribuir.",
        ],
        bullets: [
          "Autoconhecimento para reconhecer padrões de comportamento",
          "Prática deliberada para transformar intenção em competência",
          "Escuta e responsabilidade para construir confiança",
          "Aprendizado contínuo para adaptar a liderança ao contexto",
        ],
      },
      {
        heading: "Liderança e gestão são coisas diferentes",
        paragraphs: [
          "Gestão organiza processos, recursos, metas e resultados. Liderança mobiliza pessoas, cria direção, influencia comportamentos e sustenta relações de confiança.",
          "As duas dimensões podem caminhar juntas, mas não são sinônimos. Uma pessoa pode ser tecnicamente competente na gestão e ainda precisar amadurecer sua forma de liderar.",
        ],
      },
      {
        heading: "A semente precisa ser cultivada",
        paragraphs: [
          "Quem já tem a ‘semente plantada dentro de si’ precisa permanecer em contínuo desenvolvimento. Predisposição sem prática pode virar apenas potencial não realizado.",
          "Liderança se constrói na maneira como alguém escuta, decide, comunica, assume consequências e contribui para o crescimento de quem está ao seu redor.",
        ],
      },
    ],
    closingQuestion: "Na sua opinião, qual competência é indispensável para uma boa liderança?",
  },
  {
    slug: "afinidade-como-base-da-cooperacao",
    title: "Afinidade como base da cooperação",
    eyebrow: "Relações que sustentam resultados",
    category: "Comportamento",
    excerpt:
      "A afinidade amplia a interação social e, quando bem construída, melhora a comunicação, a confiança e a capacidade de cooperar.",
    publishedAt: "18 de julho de 2026",
    readTime: "4 min de leitura",
    quote: "Para haver cooperação, é preciso haver afinidade — não como concordância absoluta, mas como possibilidade real de conexão.",
    sections: [
      {
        paragraphs: [
          "Cooperação não nasce apenas de regras, metas ou organogramas. Ela depende da qualidade da interação entre as pessoas e da percepção de que existe um terreno comum para construir algo juntas.",
          "A afinidade amplia a interação social e esta, por sua vez, melhora a comunicação. Quando as pessoas encontram pontos de conexão, tendem a perguntar mais, interpretar com menos defensividade e negociar diferenças com maior abertura.",
        ],
      },
      {
        heading: "Afinidade não é pensar igual",
        paragraphs: [
          "Equipes saudáveis não precisam ser homogêneas. A afinidade pode surgir de valores compartilhados, respeito mútuo, clareza de propósito ou confiança construída ao longo do tempo.",
          "O desafio da liderança é criar condições para que diferenças de repertório e personalidade não se transformem automaticamente em distanciamento ou conflito improdutivo.",
        ],
        bullets: [
          "Criar espaços seguros de conversa",
          "Explicitar expectativas e responsabilidades",
          "Reconhecer contribuições e diferenças de perfil",
          "Tratar conflitos antes que se tornem rupturas",
        ],
      },
      {
        heading: "Comunicação é consequência da relação",
        paragraphs: [
          "Muitas organizações tentam corrigir a comunicação apenas com novas ferramentas ou processos. Esses recursos ajudam, mas não substituem a confiança.",
          "Quando existe afinidade suficiente para sustentar a relação, a comunicação ganha velocidade, profundidade e precisão. As pessoas deixam de proteger apenas a própria posição e passam a colaborar com o resultado coletivo.",
        ],
      },
    ],
    closingQuestion: "O que fortalece a afinidade e a cooperação dentro da sua equipe?",
  },
];

export const NEURALCAST_CATEGORIES = ["Todos", "Liderança", "Comportamento", "Cultura"] as const;

export function getNeuralCastArticle(slug?: string) {
  if (!slug) return undefined;
  return NEURALCAST_ARTICLES.find((article) => article.slug === slug);
}
