import { apiClient } from './apiClient';

export interface CallSession {
  id?: string;
  sessionId: string;
  callerId: string;
  callerName: string;
  callerPhoto?: string;
  receiverId: string;
  receiverName: string;
  receiverPhoto?: string;
  panditId?: string;
  callType: 'audio' | 'video';
  status: 'initiating' | 'ringing' | 'accepted' | 'rejected' | 'missed' | 'busy' | 'ended' | 'failed';
  isPaid?: boolean;
  amountPaid?: number;
  durationSeconds: number;
  startedAt: string;
  connectedAt?: string;
  endedAt?: string;
  rejectionReason?: string;
}

export const callService = {
  /**
   * Initiate Audio or Video Call
   */
  async initiateCall(payload: {
    receiverId: string;
    callType: 'audio' | 'video';
    panditId?: string;
  }): Promise<CallSession> {
    const res = await apiClient<any>('/calls/initiate', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return res.data;
  },

  /**
   * Accept an incoming call
   */
  async acceptCall(sessionId: string): Promise<CallSession> {
    const res = await apiClient<any>(`/calls/${sessionId}/accept`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    return res.data;
  },

  /**
   * Reject an incoming call
   */
  async rejectCall(sessionId: string, reason?: string): Promise<CallSession> {
    const res = await apiClient<any>(`/calls/${sessionId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
    return res.data;
  },

  /**
   * End an active call
   */
  async endCall(sessionId: string, reason?: string): Promise<CallSession> {
    const res = await apiClient<any>(`/calls/${sessionId}/end`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
    return res.data;
  },

  /**
   * Get User Call History
   */
  async getCallHistory(page = 1, limit = 20) {
    const res = await apiClient<any>(`/calls/history?page=${page}&limit=${limit}`, {
      method: 'GET',
    });
    return res.data;
  },

  /**
   * Get Pandit Call History
   */
  async getPanditCallHistory(page = 1, limit = 20) {
    const res = await apiClient<any>(`/calls/pandit/history?page=${page}&limit=${limit}`, {
      method: 'GET',
    });
    return res.data;
  },

  /**
   * Get WebRTC STUN/TURN config
   */
  async getWebRtcConfig() {
    const res = await apiClient<any>('/calls/config', {
      method: 'GET',
    });
    return res.data;
  },
};
