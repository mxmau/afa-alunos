import { StudentProfile } from "../types";

export type PhraseGroup = {
  title: string;
  phrases: string[];
};

export const profilePhraseBank: Record<keyof StudentProfile, PhraseGroup[]> = {
  resumoRapido: [
    {
      title: "Aberturas",
      phrases: [
        "apresenta boa convivência e responde bem aos combinados da turma",
        "vem demonstrando evolução gradual na rotina escolar",
        "participa melhor quando recebe orientações claras e objetivas",
        "necessita de acompanhamento próximo para manter constância nas atividades",
        "tem potencial, mas precisa fortalecer organização e autonomia",
      ],
    },
    {
      title: "Síntese",
      phrases: [
        "o acompanhamento deve priorizar rotina, participação e conclusão das tarefas",
        "é importante manter o diálogo entre escola e família nas próximas semanas",
        "o foco atual é consolidar avanços e reduzir oscilações no comportamento",
      ],
    },
    {
      title: "Panorama geral",
      phrases: [
        "apresenta bom potencial, mas precisa transformar orientações em rotina",
        "tem evoluído quando recebe acompanhamento próximo e devolutivas objetivas",
        "oscila entre momentos de bom rendimento e períodos de dispersão",
        "demonstra necessidade de fortalecer autonomia, organização e constância",
        "responde melhor quando as combinações são retomadas de forma individual",
        "vem apresentando sinais de amadurecimento na postura escolar",
      ],
    },
    {
      title: "Tom para família",
      phrases: [
        "a família pode ajudar reforçando rotina, prazos e responsabilidade com materiais",
        "a escola seguirá acompanhando a evolução nas próximas semanas",
        "os avanços precisam ser mantidos com constância e reforço positivo",
        "o acompanhamento deve observar comportamento, participação e entregas",
        "a prioridade é reduzir recorrências e consolidar atitudes positivas",
      ],
    },
  ],
  personalidade: [
    {
      title: "Perfil observado",
      phrases: [
        "perfil calmo e observador",
        "demonstra abertura ao diálogo",
        "costuma ser comunicativo(a) com colegas",
        "mostra-se reservado(a) em momentos de exposição oral",
        "necessita de incentivo para participar com mais segurança",
        "beneficia-se de combinados claros e previsíveis",
      ],
    },
    {
      title: "Postura",
      phrases: [
        "responde melhor quando recebe orientação individual",
        "demonstra sensibilidade a correções públicas",
        "mantém boa escuta quando está concentrado(a)",
        "precisa fortalecer autocontrole em situações de frustração",
      ],
    },
    {
      title: "Ritmo pessoal",
      phrases: [
        "tem ritmo mais lento para iniciar e finalizar as propostas",
        "precisa de tempo para organizar ideias antes de responder",
        "demonstra pressa e precisa revisar com mais cuidado",
        "alterna momentos de autonomia com necessidade de mediação",
        "fica mais seguro(a) quando entende as etapas da atividade",
      ],
    },
    {
      title: "Autorregulação",
      phrases: [
        "precisa desenvolver estratégias para lidar com frustração",
        "demonstra impulsividade em momentos de maior agitação",
        "consegue retomar a postura quando orientado(a) de forma objetiva",
        "beneficia-se de pausas breves e retomada dos combinados",
        "precisa fortalecer tolerância à espera e aos limites coletivos",
      ],
    },
  ],
  positivos: [
    {
      title: "Comportamento positivo",
      phrases: [
        "respeita combinados",
        "demonstra colaboração",
        "participa com interesse",
        "mantém boa convivência",
        "demonstra responsabilidade",
        "ajuda colegas",
        "realiza atividades com autonomia",
        "apresenta boa evolução",
      ],
    },
    {
      title: "Evolução positiva",
      phrases: [
        "tem melhorado a organização dos materiais",
        "mostra avanço na conclusão das atividades",
        "vem ampliando a participação nas aulas",
        "aceita melhor as orientações propostas",
      ],
    },
    {
      title: "Forças de aprendizagem",
      phrases: [
        "demonstra boa compreensão quando acompanha a explicação",
        "faz boas contribuições quando está envolvido(a)",
        "apresenta curiosidade diante de novos temas",
        "consegue avançar bem quando segue as etapas propostas",
        "mostra repertório e criatividade em algumas produções",
        "aprende melhor com exemplos práticos e orientação direta",
      ],
    },
    {
      title: "Atitudes em sala",
      phrases: [
        "cuida dos materiais e do espaço coletivo",
        "demonstra respeito nas interações com adultos",
        "aceita combinados e tenta colocá-los em prática",
        "tem boa disposição para ajudar colegas",
        "valoriza devolutivas e busca melhorar o desempenho",
      ],
    },
  ],
  atencao: [
    {
      title: "Pontos de atenção",
      phrases: [
        "dispersa-se com facilidade",
        "necessita de mediação constante",
        "conversa excessivamente durante explicações",
        "tem dificuldade em concluir atividades",
        "esquece materiais com frequência",
        "apresenta resistência para iniciar tarefas",
        "precisa melhorar a organização",
        "necessita desenvolver mais autonomia",
      ],
    },
    {
      title: "Recorrência",
      phrases: [
        "ocorre de forma pontual",
        "tem ocorrido com frequência",
        "precisa ser acompanhado nas próximas semanas",
        "merece alinhamento com a família",
      ],
    },
    {
      title: "Foco e rotina",
      phrases: [
        "perde o foco quando a atividade exige mais tempo de concentração",
        "necessita de lembretes para iniciar a proposta",
        "deixa etapas incompletas mesmo após orientação",
        "precisa registrar melhor tarefas, prazos e materiais",
        "oscila na rotina e precisa de acompanhamento mais constante",
        "apresenta dificuldade para retomar a atividade após interrupções",
      ],
    },
    {
      title: "Postura em aula",
      phrases: [
        "interrompe explicações em momentos inadequados",
        "tem dificuldade em aguardar sua vez de fala",
        "reage com resistência quando contrariado(a)",
        "precisa respeitar melhor os combinados coletivos",
        "necessita melhorar a escuta durante orientações gerais",
      ],
    },
  ],
  social: [
    {
      title: "Socialização",
      phrases: [
        "interage bem com colegas",
        "precisa ampliar a integração com o grupo",
        "envolve-se em conflitos pontuais",
        "necessita de mediação na convivência",
        "demonstra empatia",
        "participa bem em atividades coletivas",
      ],
    },
    {
      title: "Convivência",
      phrases: [
        "precisa fortalecer escuta e respeito aos turnos de fala",
        "beneficia-se de mediação para resolver conflitos",
        "tem boa relação com o professor",
        "precisa desenvolver comunicação mais respeitosa em momentos de tensão",
      ],
    },
    {
      title: "Integração",
      phrases: [
        "prefere interações com poucos colegas",
        "tem dificuldade para se integrar a grupos maiores",
        "aproxima-se melhor quando a atividade tem papéis definidos",
        "precisa ser incentivado(a) a participar de dinâmicas coletivas",
        "demonstra vínculo positivo com alguns colegas específicos",
      ],
    },
    {
      title: "Conflitos e mediação",
      phrases: [
        "envolve-se em conflitos quando há disputa de espaço ou fala",
        "precisa aprender a resolver divergências sem elevar o tom",
        "responde melhor quando a mediação ocorre logo após o episódio",
        "necessita reconhecer o impacto de suas falas nas relações",
        "tem avançado na aceitação de combinados de convivência",
      ],
    },
  ],
  pedagogico: [
    {
      title: "Aspectos pedagógicos",
      phrases: [
        "demonstra compreensão dos conteúdos trabalhados",
        "precisa de reforço em conteúdos básicos",
        "apresenta dificuldade na leitura dos enunciados",
        "necessita de mais atenção na resolução das atividades",
        "evoluiu na realização das tarefas",
        "precisa desenvolver rotina de estudo",
      ],
    },
    {
      title: "Participação",
      phrases: [
        "participa das aulas quando é chamado(a)",
        "realiza melhor as tarefas com orientação por etapas",
        "precisa registrar as atividades com mais cuidado",
        "tem apresentado oscilação na entrega das atividades",
      ],
    },
    {
      title: "Produção e registro",
      phrases: [
        "precisa melhorar a qualidade dos registros no caderno",
        "tem dificuldade para copiar e organizar informações essenciais",
        "realiza parte da proposta, mas nem sempre finaliza",
        "necessita revisar respostas antes de entregar",
        "apresenta melhora quando recebe modelo ou exemplo inicial",
        "precisa transformar participação oral em registro escrito",
      ],
    },
    {
      title: "Estratégias de aprendizagem",
      phrases: [
        "beneficia-se de atividades por etapas curtas",
        "precisa reler enunciados antes de pedir ajuda",
        "tem melhor desempenho com acompanhamento individual",
        "necessita fortalecer hábito de estudo fora da sala",
        "demonstra dificuldade em manter sequência lógica nas respostas",
        "avança quando recebe feedback imediato sobre o erro",
      ],
    },
  ],
  manter: [
    {
      title: "Manter",
      phrases: [
        "manter a participação nas atividades",
        "manter a postura colaborativa",
        "manter a rotina de organização dos materiais",
        "manter os avanços na convivência",
        "manter o esforço para concluir as tarefas",
        "manter a abertura para receber orientações",
      ],
    },
    {
      title: "Hábitos positivos",
      phrases: [
        "manter a pontualidade nas entregas",
        "manter a escuta durante explicações",
        "manter o cuidado com os registros",
        "manter a iniciativa para pedir ajuda quando necessário",
        "manter a cooperação em atividades coletivas",
        "manter a evolução observada no bimestre",
      ],
    },
    {
      title: "Postura e convivência",
      phrases: [
        "manter comunicação respeitosa com colegas",
        "manter controle emocional em situações de frustração",
        "manter a disposição para rever combinados",
        "manter vínculos positivos construídos com o grupo",
      ],
    },
  ],
  melhorar: [
    {
      title: "Melhorar",
      phrases: [
        "melhorar a organização dos materiais",
        "desenvolver maior autonomia",
        "concluir atividades com mais constância",
        "reduzir conversas durante explicações",
        "ampliar a participação oral",
        "fortalecer rotina de estudo",
        "pedir ajuda quando tiver dúvida",
      ],
    },
    {
      title: "Intervenções",
      phrases: [
        "reforçar combinados em sala",
        "realizar acompanhamento semanal",
        "propor atividades por etapas",
        "observar evolução nas próximas semanas",
        "registrar nova devolutiva",
      ],
    },
    {
      title: "Rotina e autonomia",
      phrases: [
        "organizar materiais antes do início das aulas",
        "anotar tarefas e prazos com mais cuidado",
        "iniciar atividades com menos dependência de lembretes",
        "finalizar as propostas dentro do tempo combinado",
        "revisar respostas antes de entregar",
        "trazer dúvidas de forma mais objetiva",
      ],
    },
    {
      title: "Convivência e postura",
      phrases: [
        "respeitar melhor os turnos de fala",
        "reduzir interrupções durante explicações",
        "resolver conflitos com diálogo e mediação",
        "aceitar correções sem resistência excessiva",
        "controlar impulsos em momentos de agitação",
      ],
    },
  ],
  apoioFamilia: [
    {
      title: "Devolutiva familiar",
      phrases: [
        "acompanhar a organização dos materiais",
        "reforçar combinados de rotina em casa",
        "estimular a conclusão das atividades",
        "manter diálogo frequente com a escola",
        "valorizar os avanços observados",
        "ajudar a criar horário regular de estudo",
        "orientar sobre responsabilidade com prazos e materiais",
      ],
    },
    {
      title: "Acompanhamento em casa",
      phrases: [
        "conferir agenda, materiais e tarefas ao longo da semana",
        "combinar horário fixo para estudo e revisão",
        "evitar deixar tarefas acumularem para o último momento",
        "acompanhar se os registros no caderno estão completos",
        "reforçar a importância de trazer dúvidas para a aula",
      ],
    },
    {
      title: "Parceria escola-família",
      phrases: [
        "manter contato com a escola se houver recorrência",
        "alinhar combinados de comportamento entre casa e escola",
        "valorizar pequenas melhoras para fortalecer a motivação",
        "acompanhar as próximas devolutivas do bimestre",
        "reforçar postura respeitosa e responsabilidade com prazos",
      ],
    },
  ],
};

export const incidentPhraseBank: PhraseGroup[] = [
  {
    title: "Registros rápidos",
    phrases: [
      "participou com interesse da atividade",
      "necessitou de mediação para concluir a tarefa",
      "envolveu-se em conflito pontual com colega",
      "esqueceu material necessário para a aula",
      "demonstrou avanço positivo na convivência",
      "precisou de lembrete sobre combinados da turma",
      "realizou atividade com autonomia",
    ],
  },
  {
    title: "Ações tomadas",
    phrases: [
      "conversa individual realizada",
      "combinado retomado em sala",
      "responsável deve ser informado se houver recorrência",
      "acompanhar evolução nas próximas aulas",
      "orientação pedagógica registrada",
    ],
  },
  {
    title: "Ocorrências positivas",
    phrases: [
      "demonstrou melhora na postura durante a aula",
      "concluiu a atividade com autonomia",
      "ajudou colega de forma respeitosa",
      "aceitou orientação e retomou a atividade",
      "participou com boa contribuição oral",
      "manteve foco durante a proposta",
    ],
  },
  {
    title: "Ocorrências de atenção",
    phrases: [
      "precisou de lembrete para respeitar combinados",
      "não concluiu a atividade proposta",
      "apresentou dispersão recorrente",
      "interrompeu explicações em momentos inadequados",
      "necessitou de mediação após conflito",
      "não trouxe material necessário",
    ],
  },
  {
    title: "Encaminhamentos",
    phrases: [
      "retomar combinados na próxima aula",
      "observar se haverá repetição do comportamento",
      "registrar nova devolutiva se persistir",
      "orientar família caso haja recorrência",
      "acompanhar entrega da próxima atividade",
    ],
  },
];

export function appendPhrase(current: string, phrase: string): string {
  const cleanCurrent = current.trim();
  const cleanPhrase = phrase.trim();
  if (!cleanPhrase) return current;
  if (!cleanCurrent) return capitalizeSentence(cleanPhrase);
  if (cleanCurrent.toLocaleLowerCase("pt-BR").includes(cleanPhrase.toLocaleLowerCase("pt-BR"))) {
    return current;
  }

  const separator = /[.!?;:]$/.test(cleanCurrent) ? " " : "; ";
  return `${cleanCurrent}${separator}${cleanPhrase}`;
}

function capitalizeSentence(value: string): string {
  return value.charAt(0).toLocaleUpperCase("pt-BR") + value.slice(1);
}
