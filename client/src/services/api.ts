import type {
  ApiResponse,
  BusinessProfile,
  Customer,
  DashboardSummary,
  LeadStatus,
  LeadStatusHistory,
  LoanLead,
  User,
} from '../types';

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

    // Verify if server returned JSON
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await res.text();
      const isHtml = text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html') || text.trim().startsWith('<');
      return {
        success: false,
        message: isHtml
          ? `Backend API server is unreachable or returning HTML (HTTP ${res.status}). Please ensure Node.js is running in Hostinger.`
          : `Unexpected server response format (HTTP ${res.status}): ${text.slice(0, 100)}`,
      };
    }

    const data = await res.json().catch(() => ({
      success: false,
      message: `Failed to parse JSON response (HTTP ${res.status})`,
    }));

    if (!res.ok) {
      return {
        success: false,
        message: data.message || `Request failed with status ${res.status}`,
        errors: data.errors,
        isDuplicate: data.isDuplicate,
        existingCustomer: data.existingCustomer,
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

  // Customer Management APIs (Phase 2)
  async getCustomers(params: {
    search?: string;
    city?: string;
    sort?: string;
    page?: number;
    limit?: number;
  } = {}): Promise<ApiResponse<{ customers: Customer[]; pagination: any }>> {
    const query = new URLSearchParams();
    if (params.search) query.set('search', params.search);
    if (params.city) query.set('city', params.city);
    if (params.sort) query.set('sort', params.sort);
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));

    const qs = query.toString() ? `?${query.toString()}` : '';
    return request(`/customers${qs}`);
  },

  async getCustomer(id: number): Promise<ApiResponse<{ customer: Customer }>> {
    return request(`/customers/${id}`);
  },

  async checkCustomerDuplicate(params: {
    mobile_number?: string;
    email?: string;
    excludeId?: number;
  }): Promise<ApiResponse<{ exists: boolean; customer: Customer | null }>> {
    const query = new URLSearchParams();
    if (params.mobile_number) query.set('mobile_number', params.mobile_number);
    if (params.email) query.set('email', params.email);
    if (params.excludeId) query.set('excludeId', String(params.excludeId));
    return request(`/customers/check-duplicate?${query.toString()}`);
  },

  async createCustomer(data: Partial<Customer>, force = false): Promise<ApiResponse<{ customer: Customer }>> {
    return request(`/customers${force ? '?force=true' : ''}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateCustomer(id: number, data: Partial<Customer>, force = false): Promise<ApiResponse<{ customer: Customer }>> {
    return request(`/customers/${id}${force ? '?force=true' : ''}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteCustomer(id: number): Promise<ApiResponse<{ hasLinkedLeads: boolean }>> {
    return request(`/customers/${id}`, {
      method: 'DELETE',
    });
  },

  // Lead Management APIs (Phase 2)
  async getLeads(params: {
    search?: string;
    loan_type?: string;
    lead_status?: string;
    lead_source?: string;
    startDate?: string;
    endDate?: string;
    sort?: string;
    page?: number;
    limit?: number;
  } = {}): Promise<ApiResponse<{ leads: LoanLead[]; pagination: any }>> {
    const query = new URLSearchParams();
    if (params.search) query.set('search', params.search);
    if (params.loan_type) query.set('loan_type', params.loan_type);
    if (params.lead_status) query.set('lead_status', params.lead_status);
    if (params.lead_source) query.set('lead_source', params.lead_source);
    if (params.startDate) query.set('startDate', params.startDate);
    if (params.endDate) query.set('endDate', params.endDate);
    if (params.sort) query.set('sort', params.sort);
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));

    const qs = query.toString() ? `?${query.toString()}` : '';
    return request(`/leads${qs}`);
  },

  async getLead(id: number): Promise<ApiResponse<{ lead: LoanLead }>> {
    return request(`/leads/${id}`);
  },

  async createLead(data: any): Promise<ApiResponse<{ lead: LoanLead }>> {
    return request('/leads', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateLead(id: number, data: any): Promise<ApiResponse<{ lead: LoanLead }>> {
    return request(`/leads/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async updateLeadStatus(
    id: number,
    new_status: LeadStatus,
    change_notes?: string
  ): Promise<ApiResponse<{ lead: LoanLead }>> {
    return request(`/leads/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ new_status, change_notes }),
    });
  },

  async getLeadHistory(id: number): Promise<ApiResponse<{ history: LeadStatusHistory[] }>> {
    return request(`/leads/${id}/history`);
  },

  // Dashboard Live Metrics APIs (Phase 2)
  async getDashboardSummary(): Promise<ApiResponse<DashboardSummary>> {
    return request('/dashboard/summary');
  },

  async getRecentCustomers(limit = 5): Promise<ApiResponse<Customer[]>> {
    return request(`/dashboard/recent-customers?limit=${limit}`);
  },

  async getRecentLeads(limit = 5): Promise<ApiResponse<LoanLead[]>> {
    return request(`/dashboard/recent-leads?limit=${limit}`);
  },

  // Health probe
  async getHealth(): Promise<ApiResponse> {
    return request('/health', {
      method: 'GET',
    });
  },
};
