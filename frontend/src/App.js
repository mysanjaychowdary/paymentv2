import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { Toaster } from "@/components/ui/sonner";
import { AppLayout } from "@/components/layout/AppLayout";

import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Customers from "@/pages/Customers";
import CustomerDetail from "@/pages/CustomerDetail";
import Quotations from "@/pages/Quotations";
import QuotationForm from "@/pages/QuotationForm";
import QuotationView from "@/pages/QuotationView";
import Invoices from "@/pages/Invoices";
import InvoiceForm from "@/pages/InvoiceForm";
import InvoiceView from "@/pages/InvoiceView";
import Payments from "@/pages/Payments";
import CreditPurchases from "@/pages/CreditPurchases";
import Services from "@/pages/Services";
import Reports from "@/pages/Reports";
import StatementAnalyzer from "@/pages/StatementAnalyzer";
import StatementDetail from "@/pages/StatementDetail";

function ProtectedRoute({ children }) {
  const { user } = useAuth();
  if (user === null) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-muted-foreground">Loading...</div>
    );
  }
  if (user === false) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="customers" element={<Customers />} />
            <Route path="customers/:id" element={<CustomerDetail />} />
            <Route path="quotations" element={<Quotations />} />
            <Route path="quotations/new" element={<QuotationForm />} />
            <Route path="quotations/:id" element={<QuotationView />} />
            <Route path="quotations/:id/edit" element={<QuotationForm />} />
            <Route path="invoices" element={<Invoices />} />
            <Route path="invoices/new" element={<InvoiceForm />} />
            <Route path="invoices/:id" element={<InvoiceView />} />
            <Route path="invoices/:id/edit" element={<InvoiceForm />} />
            <Route path="payments" element={<Payments />} />
            <Route path="credit-purchases" element={<CreditPurchases />} />
            <Route path="services" element={<Services />} />
            <Route path="reports" element={<Reports />} />
            <Route path="statement-analyzer" element={<StatementAnalyzer />} />
            <Route path="statement-analyzer/:id" element={<StatementDetail />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
