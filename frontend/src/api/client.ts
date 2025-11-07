import { API_DOMAIN } from '../utils';
import type { ApiErrorResponse, HttpClientConfig } from '@todo/shared';

export class HttpClient {
  private config: HttpClientConfig;
  private token: string | null = null;
  private onUnauthorized?: () => void;

  constructor(config: HttpClientConfig | string) {
    this.config =
      typeof config === 'string'
        ? { baseURL: config, timeout: 10000 }
        : { timeout: 10000, ...config };
  }

  setAuthToken(token: string | null) {
    this.token = token;
  }

  setUnauthorizedHandler(handler: () => void) {
    this.onUnauthorized = handler;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.config.baseURL}${endpoint}`;
    const headers = new Headers(options.headers || {});

    // Add auth header if token exists
    if (this.token) {
      headers.set('Authorization', `Bearer ${this.token}`);
    }

    // Set content type for POST/PUT requests
    if (options.body && !headers.get('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const config: RequestInit = {
      ...options,
      headers,
    };

    try {
      const response = await fetch(url, config);

      // Handle 401 unauthorized
      if (response.status === 401) {
        this.onUnauthorized?.();
        throw new Error('Unauthorized');
      }

      // Handle other error status codes
      if (!response.ok) {
        let errorData: ApiErrorResponse;
        try {
          errorData = await response.json();
        } catch {
          errorData = {
            error: `HTTP ${response.status}: ${response.statusText}`,
            timestamp: new Date().toISOString(),
            path: endpoint,
            method: options.method || 'GET',
            status: 'error',
          };
        }
        throw new ApiRequestError(errorData, response.status);
      }

      // Handle empty responses (DELETE operations)
      if (
        response.status === 204 ||
        response.headers.get('content-length') === '0'
      ) {
        return {} as T;
      }

      return await response.json();
    } catch (error) {
      if (error instanceof ApiRequestError) {
        throw error;
      }

      // Network or other errors
      throw new ApiRequestError(
        {
          error: 'Network error or server unavailable',
          timestamp: new Date().toISOString(),
          path: endpoint,
          method: options.method || 'GET',
          status: 'error',
        },
        0
      );
    }
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async patch<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

export class ApiRequestError extends Error {
  public readonly data: ApiErrorResponse;
  public readonly status: number;

  constructor(data: ApiErrorResponse, status: number) {
    super(data.error);
    this.name = 'ApiRequestError';
    this.data = data;
    this.status = status;
  }
}

// Create and export the singleton client
export const apiClient = new HttpClient(API_DOMAIN);
