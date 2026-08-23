import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";

export function AppLayout() {
  return (
    <div className="flex min-h-screen bg-[#FAFAFA]">
      <Sidebar />
      <main className="flex-1 overflow-x-hidden p-6 md:p-8" data-testid="main-content">
        <Outlet />
      </main>
    </div>
  );
}
