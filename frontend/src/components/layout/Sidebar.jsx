import { NavLink, useNavigate } from "react-router-dom";
import { useState } from "react";
import {
  SquaresFour,
  Users,
  FileText,
  Receipt,
  Wallet,
  ChatCircleDots,
  Stack,
  ChartBar,
  MagnifyingGlass,
  GearSix,
  CaretLeft,
  CaretRight,
  SignOut,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", icon: SquaresFour },
  { to: "/customers", label: "Customers", icon: Users },
  { to: "/quotations", label: "Quotations", icon: FileText },
  { to: "/invoices", label: "Invoices", icon: Receipt },
  { to: "/payments", label: "Payments", icon: Wallet },
  { to: "/credit-purchases", label: "Credit Purchases", icon: ChatCircleDots },
  { to: "/services", label: "Services", icon: Stack },
  { to: "/reports", label: "Reports", icon: ChartBar },
  { to: "/statement-analyzer", label: "Statement Analyzer", icon: MagnifyingGlass },
  { to: "/settings", label: "Settings", icon: GearSix },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <aside
      className={cn(
        "sticky top-0 flex h-screen flex-col border-r border-border bg-white transition-all duration-200",
        collapsed ? "w-[68px]" : "w-64"
      )}
      data-testid="app-sidebar"
    >
      <div className="flex h-16 items-center border-b border-border px-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary font-heading text-sm font-bold text-white">
          S
        </div>
        {!collapsed && (
          <div className="ml-2.5 overflow-hidden">
            <p className="truncate font-heading text-sm font-bold leading-tight tracking-tight">SANJU ANIMATIONS</p>
            <p className="truncate text-[10px] font-medium uppercase tracking-wide text-muted-foreground">IT Solutions</p>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            data-testid={`nav-link-${item.to.replace("/", "")}`}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive ? "bg-primary text-primary-foreground" : "text-foreground/70 hover:bg-secondary hover:text-foreground"
              )
            }
          >
            <item.icon size={19} weight="duotone" className="shrink-0" />
            {!collapsed && <span className="truncate">{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-border p-3">
        {!collapsed && user && (
          <div className="mb-2 px-1">
            <p className="truncate text-xs font-semibold">{user.name || "Admin"}</p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          </div>
        )}
        <button
          onClick={handleLogout}
          data-testid="logout-button"
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-foreground/70 transition-colors hover:bg-secondary hover:text-destructive"
        >
          <SignOut size={19} />
          {!collapsed && <span>Log out</span>}
        </button>
        <button
          onClick={() => setCollapsed((c) => !c)}
          data-testid="sidebar-collapse-toggle"
          className="mt-1 flex w-full items-center justify-center gap-2 rounded-md px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-secondary"
        >
          {collapsed ? <CaretRight size={14} /> : <><CaretLeft size={14} /> Collapse</>}
        </button>
      </div>
    </aside>
  );
}
