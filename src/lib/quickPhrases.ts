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
