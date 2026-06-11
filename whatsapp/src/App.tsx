import { FrappeProvider } from "frappe-react-sdk";
import { Outlet } from "react-router-dom";
import "./App.css";
import { UserProvider } from "./contexts/UserProvider";

function App() {
  return (
    <div className="App">
      <FrappeProvider>
        <UserProvider>
          <Outlet />
        </UserProvider>
      </FrappeProvider>
    </div>
  );
}

export default App;
