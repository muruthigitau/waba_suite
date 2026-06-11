import {
  useFrappeAuth,
  useFrappeGetCall,
  useSWRConfig,
} from "frappe-react-sdk";
import { createContext, ReactNode, useContext } from "react";

interface UserContextType {
  currentUser: any;
  isLoading: boolean;
  logout: () => Promise<void>;
  updateCurrentUser: () => void;
  userData: any;
}

const UserContext = createContext<UserContextType>({
  currentUser: null,
  isLoading: true,
  logout: () => Promise.resolve(),
  updateCurrentUser: () => {},
  userData: null,
});

export const useUser = () => useContext(UserContext);

interface UserProviderProps {
  children: ReactNode;
}

export const UserProvider = ({ children }: UserProviderProps) => {
  const { mutate } = useSWRConfig();
  const {
    logout,
    currentUser,
    updateCurrentUser,
    isLoading: authLoading,
  } = useFrappeAuth();

  const { data: user } = useFrappeGetCall(
    "waba_suite.api.config.get_user_details",
    {},
    currentUser ? undefined : { enabled: false },
  );

  const userData = user?.message;

  const handleLogout = async () => {
    localStorage.removeItem("app-cache");

    try {
      if (window.frappePushNotification) {
        await window.frappePushNotification.disableNotification();
      }
    } catch (error) {
      console.error("Failed to disable push notifications", error);
    }

    return logout()
      .then(() => {
        return mutate(
          (key) => {
            if (key === "waba_suite.api.config.get_context") {
              return false;
            }
            return true;
          },
          undefined,
          false,
        );
      })
      .then(() => {
        window.location.href = "/whatsapp/login";
      })
      .catch((error) => {
        console.error("Failed to logout:", error);
        window.location.href = "/whatsapp/login";
      });
  };

  return (
    <UserContext.Provider
      value={{
        isLoading: authLoading,
        updateCurrentUser,
        logout: handleLogout,
        currentUser,
        userData,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};

export default UserContext;
