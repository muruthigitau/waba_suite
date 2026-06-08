import { FrappeProvider } from "frappe-react-sdk";
import { Outlet } from "react-router-dom";
import "./App.css";

function App() {
  return (
    <div className="App">
      <FrappeProvider>
        <Outlet />
      </FrappeProvider>
    </div>
  );
}

export default App;
