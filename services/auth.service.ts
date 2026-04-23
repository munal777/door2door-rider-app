/**
 * Authentication Service for Riders
 * Handles all authentication-related API calls
 */

import { apiClient } from './api.client';
import { API_CONFIG } from './api.config';
import {
  ApiResponse,
  LoginRequest,
  LoginResponse,
  SendOTPRequest,
  ValidateOTPRequest,
  ChangePasswordRequest,
} from '@/types/api';

export const authService = {
  /**
   * Login with email and password
   */
  async login(data: LoginRequest): Promise<ApiResponse<LoginResponse>> {
    const response = await apiClient.post<LoginResponse>(
      API_CONFIG.ENDPOINTS.LOGIN,
      data
    );
    
    // If login successful, save the access token
    if (response.IsSuccess && response.Result?.access) {
      apiClient.setAccessToken(response.Result.access);
    }
    
    return response;
  },

  /**
   * Send OTP to email for password reset
   */
  async sendOTP(data: SendOTPRequest): Promise<ApiResponse<{ message: string }>> {
    return apiClient.post(API_CONFIG.ENDPOINTS.SEND_OTP, data);
  },

  /**
   * Validate OTP code
   */
  async validateOTP(data: ValidateOTPRequest): Promise<ApiResponse<{ message: string }>> {
    return apiClient.post(API_CONFIG.ENDPOINTS.VALIDATE_OTP, data);
  },

  /**
   * Change password after OTP verification step
   */
  async changePassword(data: ChangePasswordRequest): Promise<ApiResponse<{ message: string }>> {
    return apiClient.post(API_CONFIG.ENDPOINTS.CHANGE_PASSWORD, data);
  },

  /**
   * Logout - clear tokens
   */
  logout() {
    apiClient.setAccessToken(null);
  },
};
