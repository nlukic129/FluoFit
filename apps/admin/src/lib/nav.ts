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

export type NavItem = { label: string; href: string; icon: LucideIcon };

// Sidebar information architecture (admin-console.md modules).
export const NAV: NavItem[] = [
  { label: "Overview", href: "/overview", icon: LayoutDashboard },
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
