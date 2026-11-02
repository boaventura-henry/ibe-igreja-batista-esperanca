export type VisitorPrivacyStatus = "DRAFT" | "APPROVED";

export const visitorPrivacyNotice = {
  version: "visitor-privacy-1.0",
  status: "APPROVED" as VisitorPrivacyStatus,
  text: "Privacidade dos seus dados\n\nA Igreja Batista Esperança utilizará os dados informados neste cadastro\npara identificar e registrar sua visita e realizar ações de acolhimento\nrelacionadas às atividades da igreja.\n\nSeus dados serão tratados de acordo com a legislação aplicável e não\nserão comercializados. Eles poderão ser compartilhados somente quando\nnecessário para a prestação dos serviços utilizados pela igreja ou\nquando houver obrigação legal.\n\nOs dados serão mantidos pelo período necessário para atender às\nfinalidades para as quais foram coletados e às obrigações aplicáveis.\n\nVocê poderá solicitar informações sobre seus dados, bem como sua\ncorreção ou exclusão, observadas as hipóteses legais de conservação,\npelo WhatsApp (18) 99744-8397.\n\nControlador: Igreja Batista Esperança\nEndereço: Av. Ibirapuera, 733, Jardim Planalto, Araçatuba/SP\nCanal de privacidade: WhatsApp (18) 99744-8397"
} as const;
