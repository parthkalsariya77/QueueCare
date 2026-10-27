import React, { createContext, useContext, useState, useEffect } from 'react';

type Role = 'patient' | 'staff';

interface RoleContextType {
  role: Role;
  setRole: (role: Role) => void;
  toggleRole: () => void;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

export const RoleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [role, setRoleState] = useState<Role>(() => {
    return (localStorage.getItem('queuecare_demo_role') as Role) || 'patient';
  });

  const setRole = (newRole: Role) => {
    setRoleState(newRole);
    localStorage.setItem('queuecare_demo_role', newRole);
  };

  const toggleRole = () => {
    setRole(role === 'patient' ? 'staff' : 'patient');
  };

  return (
    <RoleContext.Provider value={{ role, setRole, toggleRole }}>
      {children}
    </RoleContext.Provider>
  );
};

export function useRole() {
  const context = useContext(RoleContext);
  if (!context) {
    throw new Error('useRole must be used within a RoleProvider');
  }
  return context;
}
