import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ProtectedRoute, AuthRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import LiveView from "./pages/LiveView";
import StandingsView from "./pages/StandingsView";
import DoublesView from "./pages/DoublesView";
import GroupBracketView from "./pages/GroupBracketView";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import { AudioPlayer } from "@/components/AudioPlayer";

const queryClient = new QueryClient();


const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <div className="pb-16">
          <Routes>
            <Route path="/auth" element={<AuthRoute><Auth /></AuthRoute>} />
            <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/live/:id" element={<LiveView />} />
            <Route path="/standings/:id" element={<StandingsView />} />
            <Route path="/doubles/:id" element={<DoublesView />} />
            <Route path="/groups/:id" element={<GroupBracketView />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
        <AudioPlayer />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
