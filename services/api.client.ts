import axios, { AxiosInstance, AxiosError } from 'axios';
import { API_CONFIG } from './api.config';
import { ApiResponse } from '@/types/api';

class ApiClient {
  private axiosInstance: AxiosInstance;
  private accessToken: string | null = null;

  constructor() {
    // Log the active base URL on startup — useful for catching wrong IP issues
    this.axiosInstance = axios.create({
      baseURL: API_CONFIG.BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add auth token
    this.axiosInstance.interceptors.request.use(
      (config) => {
        if (this.accessToken) {
          config.headers.Authorization = `Bearer ${this.accessToken}`;
        }
        
        const isFormData =
          config.data instanceof FormData ||
          Boolean(config.data && (config.data as any)._parts);

        // For FormData, remove Content-Type to let axios set it with boundary
        if (isFormData) {
          delete config.headers['Content-Type'];
          config.headers.Accept = 'application/json';
        }
        
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor to handle responses
    this.axiosInstance.interceptors.response.use(
      (response) => {
        return response;
      },
      (error: AxiosError) => {
        // Handle response errors
        if (error.response) {
          // Server responded with error status
          return Promise.reject(error);
        } else if (error.request) {
          // Request made but no response
          return Promise.reject(new Error('Network error. Please check your connection.'));
        } else {
          // Something else happened
          return Promise.reject(error);
        }
      }
    );
  }

  setAccessToken(token: string | null) {
    this.accessToken = token;
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  private handleError(error: any): ApiResponse<any> {
    if (axios.isAxiosError(error) && error.response) {
      // Server responded with an error
      const data = error.response.data;
      if (data && typeof data === 'object' && 'StatusCode' in data) {
        return data as ApiResponse<any>;
      }
    }
    
    // Network or other error
    return {
      StatusCode: 500,
      IsSuccess: false,
      ErrorMessage: [error.message || 'Network error. Please check your connection.'],
      Result: null as any,
    };
  }

  async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    try {
      const response = await this.axiosInstance.get<ApiResponse<T>>(endpoint);
      return response.data;
    } catch (error) {
      return this.handleError(error);
    }
  }

  async post<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    try {
      const response = await this.axiosInstance.post<ApiResponse<T>>(endpoint, data);
      return response.data;
    } catch (error) {
      return this.handleError(error);
    }
  }

  async postWithConfig<T>(endpoint: string, data?: any, config?: any): Promise<ApiResponse<T>> {
    try {
      const response = await this.axiosInstance.post<ApiResponse<T>>(endpoint, data, config);
      return response.data;
    } catch (error) {
      return this.handleError(error);
    }
  }

  async put<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    try {
      const response = await this.axiosInstance.put<ApiResponse<T>>(endpoint, data);
      return response.data;
    } catch (error) {
      return this.handleError(error);
    }
  }

  async patch<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    try {
      const response = await this.axiosInstance.patch<ApiResponse<T>>(endpoint, data);
      return response.data;
    } catch (error) {
      return this.handleError(error);
    }
  }

  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    try {
      const response = await this.axiosInstance.delete<ApiResponse<T>>(endpoint);
      return response.data;
    } catch (error) {
      return this.handleError(error);
    }
  }
}

export const apiClient = new ApiClient();
