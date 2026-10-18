import {
  LayoutDashboard, Headset, Wallet, Send, Download, Repeat, FileText, Percent, CheckCircle2,
  BarChart3, ShieldAlert, ArrowLeftRight, ShoppingCart, Link2, Package, Gift, Trophy, type LucideIcon,
} from "lucide-react";

export type NavLeaf = { title: string; slug: string; icon?: LucideIcon };
export type NavGroup = { title: string; icon: LucideIcon; children: NavLeaf[] };

export const mainNav: NavLeaf[] = [
  { title: "Dashboard", slug: "", icon: LayoutDashboard },
  { title: "Fale com seu gerente", slug: "gerente", icon: Headset },
];

export const groups: NavGroup[] = [
  { title: "Financeiro", icon: Wallet, children: [
    { title: "Enviar", slug: "enviar", icon: Send },
    { title: "Receber", slug: "receber", icon: Download },
    { title: "Converter", slug: "converter", icon: Repeat },
  ]},
  { title: "Relatórios", icon: FileText, children: [
    { title: "Extrato", slug: "extrato", icon: FileText },
    { title: "Comissões", slug: "comissoes", icon: Percent },
    { title: "Aprovações", slug: "aprovacoes", icon: CheckCircle2 },
    { title: "Métricas", slug: "metricas", icon: BarChart3 },
    { title: "Infrações", slug: "infracoes", icon: ShieldAlert },
    { title: "Conversões", slug: "conversoes", icon: ArrowLeftRight },
  ]},
  { title: "Checkout", icon: ShoppingCart, children: [
    { title: "Link de pagamento", slug: "link-de-pagamento", icon: Link2 },
    { title: "Produtos", slug: "produtos", icon: Package },
  ]},
];

export const otherNav: NavLeaf[] = [
  { title: "Indique e ganhe", slug: "indique", icon: Gift },
  { title: "Premiações", slug: "premiacoes", icon: Trophy },
];

export const allLeaves: NavLeaf[] = [
  ...mainNav, ...groups.flatMap((g) => g.children), ...otherNav,
  { title: "Notificações", slug: "notificacoes" },
  { title: "Central de ajuda", slug: "ajuda" },
  { title: "Configurações", slug: "configuracoes" },
];

