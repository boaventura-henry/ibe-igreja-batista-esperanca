export type NotificationEnvironment = {
  operatingSystem: "WINDOWS" | "ANDROID" | "IOS" | "MACOS" | "LINUX" | "UNKNOWN";
  browser: "CHROME" | "EDGE" | "SAFARI" | "FIREFOX" | "OTHER";
  isStandalone: boolean;
  isMobile: boolean;
};

export function getNotificationEnvironment(): NotificationEnvironment {
  if (typeof window === "undefined") return { operatingSystem: "UNKNOWN", browser: "OTHER", isStandalone: false, isMobile: false };
  const userAgent = navigator.userAgent.toLowerCase();
  const platform = navigator.platform.toLowerCase();
  const isIOS = /iphone|ipad|ipod/.test(userAgent) || (platform.includes("mac") && navigator.maxTouchPoints > 1);
  const operatingSystem = isIOS ? "IOS" : /android/.test(userAgent) ? "ANDROID" : /windows/.test(userAgent) ? "WINDOWS" : /mac os|macintosh/.test(userAgent) ? "MACOS" : /linux/.test(userAgent) ? "LINUX" : "UNKNOWN";
  const browser = /edg\//.test(userAgent) ? "EDGE" : /chrome\//.test(userAgent) ? "CHROME" : /safari\//.test(userAgent) && !/chrome\//.test(userAgent) ? "SAFARI" : /firefox\//.test(userAgent) ? "FIREFOX" : "OTHER";
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches || ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
  return { operatingSystem, browser, isStandalone, isMobile: /android|iphone|ipad|ipod|mobile/.test(userAgent) };
}

export function notificationInstructions(environment: NotificationEnvironment) {
  if (environment.operatingSystem === "WINDOWS") return ["Abra as configurações do Windows.", "Entre em Sistema > Notificações.", "Permita notificações para o navegador e para este site."];
  if (environment.operatingSystem === "ANDROID") return ["Abra Configurações > Aplicativos.", "Selecione o Chrome, Edge ou aplicativo instalado.", "Entre em Notificações e permita o recebimento."];
  if (environment.operatingSystem === "IOS") return ["Confirme que o IBE está instalado na Tela de Início.", "Abra o aplicativo pelo ícone instalado.", "Em Ajustes > Notificações, permita o recebimento."];
  if (environment.operatingSystem === "MACOS") return ["Abra Ajustes do Sistema > Notificações.", "Selecione o navegador usado para acessar o IBE.", "Permita notificações para o navegador e para este site."];
  return ["Abra as configurações de notificações do navegador.", "Localize este site ou aplicativo.", "Permita as notificações e tente novamente."];
}
