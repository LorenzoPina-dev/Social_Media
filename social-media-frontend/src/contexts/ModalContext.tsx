import React, { createContext, useContext, useState, ReactNode } from 'react';

interface ModalConfig {
  id: string;
  component: ReactNode;
  props?: Record<string, any>;
}

interface ModalContextType {
  modals: ModalConfig[];
  openModal: (id: string, component: ReactNode, props?: Record<string, any>) => void;
  closeModal: (id: string) => void;
  closeAllModals: () => void;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export const ModalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [modals, setModals] = useState<ModalConfig[]>([]);

  const openModal = (id: string, component: ReactNode, props?: Record<string, any>) => {
    setModals((prev) => {
      // Evita duplicati
      if (prev.some((m) => m.id === id)) {
        return prev;
      }
      return [...prev, { id, component, props }];
    });
  };

  const closeModal = (id: string) => {
    setModals((prev) => prev.filter((m) => m.id !== id));
  };

  const closeAllModals = () => {
    setModals([]);
  };

  return (
    <ModalContext.Provider
      value={{
        modals,
        openModal,
        closeModal,
        closeAllModals,
      }}
    >
      {children}
      {modals.map((modal) => (
        <React.Fragment key={modal.id}>
          {React.isValidElement(modal.component)
            ? React.cloneElement(modal.component, {
                ...modal.props,
                isOpen: true,
                onClose: () => closeModal(modal.id),
              })
            : modal.component}
        </React.Fragment>
      ))}
    </ModalContext.Provider>
  );
};

export const useModal = () => {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useModal must be used within ModalProvider');
  }
  return context;
};