import { Loader2 } from "lucide-react";
import { Navigate, Route, Routes } from "react-router-dom";
import App from "./App";
import { useUser } from "./contexts/UserProvider";
import Home from "./pages/Home";
import Login from "./pages/Login";

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { currentUser, isLoading } = useUser();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#111b21] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#25D366]" />
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

const AppRouter = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<App />}>
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Home />
            </ProtectedRoute>
          }
        />
      </Route>
    </Routes>
  );
};

export default AppRouter;
