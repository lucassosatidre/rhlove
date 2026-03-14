import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AppLayout from "@/components/AppLayout";
import Escala from "@/pages/Escala";
import Colaboradores from "@/pages/Colaboradores";
import Produtividade from "@/pages/Produtividade";
import FeriasProgramadas from "@/pages/FeriasProgramadas";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppLayout>
          <Routes>
            <Route path="/" element={<Escala />} />
            <Route path="/colaboradores" element={<Colaboradores />} />
            <Route path="/produtividade" element={<Produtividade />} />
            <Route path="/ferias" element={<FeriasProgramadas />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AppLayout>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
