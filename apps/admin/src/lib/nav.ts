import {
  Boxes,
  Handshake,
  LayoutDashboard,
  LifeBuoy,
  ScrollText,
  ShieldAlert,
  SlidersHorizontal,
  Store,
  UserPlus,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export type NavChild = { label: string; href: string };
export type NavItem = { label: string; href: string; icon: LucideIcon; children?: NavChild[] };

// Sidebar information architecture (admin-console.md modules). Overview has sub-pages.
export const NAV: NavItem[] = [
  {
    label: "Overview",
    href: "/overview",
    icon: LayoutDashboard,
    children: [
      { label: "Summary", href: "/overview" },
      { label: "Financial", href: "/overview/financial" },
      { label: "Growth", href: "/overview/growth" },
      { label: "Retention", href: "/overview/retention" },
      { label: "Referrers", href: "/overview/referrers" },
      { label: "Geography", href: "/overview/geography" },
      { label: "Operations", href: "/overview/operations" },
    ],
  },
  { label: "Provisioning", href: "/provisioning", icon: Boxes },
  { label: "Members", href: "/members", icon: Users },
  { label: "Support", href: "/support", icon: LifeBuoy },
  { label: "Agents", href: "/agents", icon: UserPlus },
  { label: "Affiliates", href: "/affiliates", icon: Handshake },
  { label: "Payouts", href: "/payouts", icon: Wallet },
  { label: "Fraud", href: "/fraud", icon: ShieldAlert },
  { label: "Partners", href: "/partners", icon: Store },
  { label: "Gamification", href: "/gamification", icon: SlidersHorizontal },
  { label: "Audit Log", href: "/audit", icon: ScrollText },
];
