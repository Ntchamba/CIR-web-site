// Messagerie instantanée : appels REST (historique, création). Le direct passe par WebSocket.
import { api } from '@/lib/api.js';

export const conversations = (signal) => api.get('/messagerie/conversations/', { signal });
export const creerConversation = (sujet) => api.post('/messagerie/conversations/', { sujet });
export const messages = (id, signal) => api.get(`/messagerie/conversations/${id}/messages/`, { signal });
export const envoyer = (id, texte) => api.post(`/messagerie/conversations/${id}/messages/`, { texte });
export const nonLus = () => api.get('/messagerie/conversations/non_lus/');
