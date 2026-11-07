import type { ApiResponse, BusinessProfile, User } from '../types';

const API_BASE = '/api';

async function request<T = any>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  const config: RequestInit = {
    ...options,
    credentials: 'include', // Crucial for HTTP-only cookies
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...options.headers,
    },
  };

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, config);
    const data = await res.json().catch(() => ({
      success: false,
      message: `Failed to parse response (HTTP ${res.status})`,
    }));

    if (!res.ok) {
      return {
        success: false,
        message: data.message || `Request failed with status ${res.status}`,
        errors: data.errors,
      };
    }

    return data;
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'Network error occurred while connecting to server',
    };
  }
}

export const api = {
  // Auth APIs
  async login(username: string, password: string, rememberMe = false): Promise<ApiResponse<{ user: User }>> {
    return request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password, rememberMe }),
    });
  },

  async logout(): Promise<ApiResponse> {
    return request('/auth/logout', {
      method: 'POST',
    });
  },

  async getMe(): Promise<ApiResponse<{ user: User }>> {
    return request('/auth/me', {
      method: 'GET',
    });
  },

  // Business Profile APIs
  async getBusinessProfile(): Promise<ApiResponse<BusinessProfile>> {
    return request('/business-profile', {
      method: 'GET',
    });
  },

  async saveBusinessProfile(profile: Partial<BusinessProfile>): Promise<ApiResponse<BusinessProfile>> {
    return request('/business-profile', {
      method: 'POST',
      body: JSON.stringify(profile),
    });
  },

  async updateBusinessProfile(profile: Partial<BusinessProfile>): Promise<ApiResponse<BusinessProfile>> {
    return request('/business-profile', {
      method: 'PUT',
      body: JSON.stringify(profile),
    });
  },

  // Health probe
  async getHealth(): Promise<ApiResponse> {
    return request('/health', {
      method: 'GET',
    });
  },
};
