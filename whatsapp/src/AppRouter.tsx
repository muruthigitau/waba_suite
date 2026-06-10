import { Route, Routes } from "react-router-dom";
import App from "./App.tsx";
import Home from "./pages/Home";

const AppRouter = () => {
  return (
    <Routes>
      <Route element={<App />}>
        <Route path="/" element={<Home />} />
      </Route>
    </Routes>
  );
};

export default AppRouter;
