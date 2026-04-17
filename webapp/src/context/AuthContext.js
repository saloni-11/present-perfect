import { createContext, useContext } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => (
  <AuthContext.Provider value={{ user: null, login: () => false, logout: () => {} }}>
    {children}
  </AuthContext.Provider>
);

export const useAuth = () => useContext(AuthContext);
