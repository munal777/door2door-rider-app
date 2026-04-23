/**
 * Authentication Context for Rider App
 * Manages global authentication state
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { User, RiderRegistrationData } from "@/types/api";
import { authService } from "@/services/auth.service";
import { riderService } from "@/services/rider.service";
import { storage } from "@/services/storage.service";
import { apiClient } from "@/services/api.client";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (
    email: string,
    password: string,
  ) => Promise<{ success: boolean; error?: string }>;
  register: (
    data: RiderRegistrationData,
  ) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check for existing session on app start
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const accessToken = await storage.getAccessToken();
      const userData = await storage.getUserData();

      if (accessToken && userData) {
        apiClient.setAccessToken(accessToken);

        // Validate restored token before marking user as authenticated.
        const profileResponse = await riderService.getProfile();
        if (profileResponse.IsSuccess) {
          setUser(userData);
        } else {
          await storage.clearAll();
          apiClient.setAccessToken(null);
          setUser(null);
        }
      } else {
        // Ensure stale in-memory token is removed when storage has no session.
        apiClient.setAccessToken(null);
        setUser(null);
      }
    } catch (error) {
      console.error("Error checking auth:", error);
      await storage.clearAll();
      apiClient.setAccessToken(null);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (
    email: string,
    password: string,
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await authService.login({ email, password });

      if (response.IsSuccess && response.Result) {
        const { access, refresh, user: userData } = response.Result;

        // Save tokens and user data
        await storage.setAccessToken(access);
        await storage.setRefreshToken(refresh);
        await storage.setUserData(userData);

        setUser(userData);

        return { success: true };
      } else {
        const errorMsg = Array.isArray(response.ErrorMessage)
          ? response.ErrorMessage.join(", ")
          : typeof response.ErrorMessage === "object"
            ? Object.values(response.ErrorMessage).flat().join(", ")
            : "Login failed";

        return { success: false, error: errorMsg };
      }
    } catch (error) {
      return { success: false, error: "An unexpected error occurred" };
    }
  };

  const register = async (
    data: RiderRegistrationData,
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await riderService.register(data);

      if (response.IsSuccess) {
        return { success: true };
      } else {
        const errorMsg = Array.isArray(response.ErrorMessage)
          ? response.ErrorMessage.join(", ")
          : typeof response.ErrorMessage === "object"
            ? Object.values(response.ErrorMessage).flat().join(", ")
            : "Registration failed";

        return { success: false, error: errorMsg };
      }
    } catch (error) {
      return { success: false, error: "An unexpected error occurred" };
    }
  };

  const logout = async () => {
    try {
      authService.logout();
      await storage.clearAll();
      setUser(null);
    } catch (error) {
      console.error("Error during logout:", error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
