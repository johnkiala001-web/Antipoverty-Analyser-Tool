import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Dashboard from "@/pages/Dashboard";

// Optional Toaster if we add generic UI components that require it later
// import { Toaster } from "@/components/ui/toaster";

const queryClient = new QueryClient();

function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background text-foreground font-mono">
      <div className="text-center space-y-4">
        <h1 className="text-6xl font-bold text-destructive text-shadow-glow">404</h1>
        <p className="text-sm uppercase tracking-widest text-muted-foreground">Signal Lost</p>
        <a href="/" className="inline-block mt-4 px-6 py-2 border border-primary/50 text-primary hover:bg-primary/10 rounded transition-colors">
          Return to Terminal
        </a>
      </div>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <Router />
      </WouterRouter>
    </QueryClientProvider>
  );
}

export default App;
