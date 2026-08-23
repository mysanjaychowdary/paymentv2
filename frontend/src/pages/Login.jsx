import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Lock, EnvelopeSimple } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";
import { formatApiErrorDetail } from "@/lib/api";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate("/dashboard");
    } catch (err) {
      setError(formatApiErrorDetail(err.response?.data?.detail) || err.message);
      toast.error("Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
      <div className="flex flex-col justify-center px-8 py-12 sm:px-16 lg:px-20">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-10 flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary font-heading text-base font-bold text-white">
              S
            </div>
            <div>
              <p className="font-heading text-sm font-bold leading-tight tracking-tight">SANJU ANIMATIONS</p>
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">IT Solutions</p>
            </div>
          </div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">Welcome back</h1>
          <p className="mt-2 text-sm text-muted-foreground">Sign in to manage quotations, invoices &amp; credit purchases.</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4" data-testid="login-form">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <EnvelopeSimple size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@sanjuanimations.com"
                  className="pl-9"
                  data-testid="login-email-input"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-9"
                  data-testid="login-password-input"
                />
              </div>
            </div>
            {error && (
              <p className="text-sm text-destructive" data-testid="login-error-message">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={loading} data-testid="login-submit-button">
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>
        </div>
      </div>
      <div className="relative hidden bg-primary lg:block">
        <img
          src="https://images.unsplash.com/photo-1498262257252-c282316270bc?crop=entropy&cs=srgb&fm=jpg&q=85"
          alt="Architectural pattern"
          className="h-full w-full object-cover opacity-90 mix-blend-luminosity"
        />
        <div className="absolute inset-0 bg-primary/40" />
        <div className="absolute bottom-12 left-12 right-12 text-white">
          <p className="font-heading text-2xl font-bold leading-snug tracking-tight">
            Quotations. Invoices. Payments. Credit purchases. All in one place.
          </p>
        </div>
      </div>
    </div>
  );
}
