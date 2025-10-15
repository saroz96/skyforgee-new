// hooks/useModalManager.js
import { useState, useEffect, useCallback } from 'react';

export const useModalManager = () => {
    const [modalStack, setModalStack] = useState([]);

    const pushModal = useCallback((modalId) => {
        setModalStack(prev => [...prev, modalId]);
    }, []);

    const popModal = useCallback(() => {
        setModalStack(prev => prev.slice(0, -1));
    }, []);

    const removeModal = useCallback((modalId) => {
        setModalStack(prev => prev.filter(id => id !== modalId));
    }, []);

    const getTopModal = useCallback(() => {
        return modalStack.length > 0 ? modalStack[modalStack.length - 1] : null;
    }, [modalStack]);

    const isModalOpen = useCallback((modalId) => {
        return modalStack.includes(modalId);
    }, [modalStack]);

    return {
        modalStack,
        pushModal,
        popModal,
        removeModal,
        getTopModal,
        isModalOpen
    };
};