export const institution = {
  name: "Igreja Batista Esperança",
  logoPath: "/ibe-logo.png",
  address: {
    street: "Av. Ibirapuera, 733",
    district: "Jardim Planalto",
    cityState: "Araçatuba/SP"
  },
  services: ["Quarta-feira às 20:00", "Domingo às 19:00"],
  presentation: null
} as const;

export const publicSiteConfiguration = {
  fallbackUrl: "https://ibe-igreja-batista-esperanca.vercel.app",
  futureCustomDomain: "https://www.ibearacatuba.com.br"
} as const;
