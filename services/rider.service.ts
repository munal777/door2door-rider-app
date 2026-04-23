/**
 * Rider Service
 * Handles all rider-related API calls
 */

import { Platform } from 'react-native';
import { apiClient } from './api.client';
import { API_CONFIG } from './api.config';
import {
  ApiResponse,
  RiderRegistrationData,
  RiderRegistrationResponse,
  RiderProfile,
  AvailabilityUpdateRequest,
  RiderAssignedOrderSummary,
  RiderAssignedOrderDetail,
  RiderOrderStatusUpdateRequest,
  RiderLocationUpdatePayload,
} from '@/types/api';

type LatLng = { latitude: number; longitude: number };

export type GoogleDirectionsResponse = {
  status: string;
  routes?: Array<{
    overview_polyline?: { points?: string };
    legs?: Array<{
      distance?: { text?: string };
      duration?: { text?: string };
    }>;
  }>;
  error_message?: string;
};

/**
 * Convert blob URL to File object for web platform
 */
async function blobToFile(blobUrl: string, filename: string, mimeType: string): Promise<File> {
  const response = await fetch(blobUrl);
  const blob = await response.blob();
  return new File([blob], filename, { type: mimeType });
}

export const riderService = {
  /**
   * Register a new rider with documents
   */
  async register(data: RiderRegistrationData): Promise<ApiResponse<RiderRegistrationResponse>> {
    // Create FormData for multipart request
    const formData = new FormData();

    // Add invitation token
    formData.append('invitation_token', data.invitation_token);

    // Add user data
    Object.keys(data.user).forEach((key) => {
      formData.append(`user[${key}]`, (data.user as any)[key]);
    });

    // Add rider personal information
    if (data.date_of_birth) {
      formData.append('date_of_birth', data.date_of_birth);
    }
    if (data.emergency_contact_name) {
      formData.append('emergency_contact_name', data.emergency_contact_name);
    }
    if (data.emergency_contact_phone) {
      formData.append('emergency_contact_phone', data.emergency_contact_phone);
    }

    // Add vehicle information
    formData.append('vehicle_type', data.vehicle_type);
    formData.append('vehicle_number', data.vehicle_number);
    if (data.vehicle_model) {
      formData.append('vehicle_model', data.vehicle_model);
    }
    if (data.vehicle_color) {
      formData.append('vehicle_color', data.vehicle_color);
    }

    // Add documents - handle web vs native differently
    for (let index = 0; index < data.documents.length; index++) {
      const doc = data.documents[index];
      
      formData.append(`documents[${index}][document_type]`, doc.document_type);
      if (doc.document_number) {
        formData.append(`documents[${index}][document_number]`, doc.document_number);
      }
      
      const file = doc.uploaded_file as { uri: string; name: string; type: string };
      
      // Debug: Log file object
      console.log(`Uploading document[${index}]:`, file);
      
      if (Platform.OS === 'web') {
        // For web: Convert blob URL to File object
        try {
          const fileObject = await blobToFile(file.uri, file.name, file.type);
          formData.append(`documents[${index}][uploaded_file]`, fileObject);
          console.log(`Converted blob to File for document[${index}]`);
        } catch (error) {
          console.error(`Failed to convert blob for document[${index}]:`, error);
          throw new Error(`Failed to process file: ${file.name}`);
        }
      } else {
        // For React Native: Use { uri, name, type } format
        formData.append(`documents[${index}][uploaded_file]`, {
          uri: file.uri,
          name: file.name,
          type: file.type,
        } as any);
      }
    }
    
    console.log('FormData prepared for upload');

    return apiClient.postWithConfig<RiderRegistrationResponse>(
      API_CONFIG.ENDPOINTS.RIDER_REGISTER,
      formData
    );
  },

  /**
   * Get rider profile
   */
  async getProfile(): Promise<ApiResponse<RiderProfile>> {
    return apiClient.get<RiderProfile>(API_CONFIG.ENDPOINTS.RIDER_PROFILE);
  },

  /**
   * Update rider profile (only allowed fields)
   */
  async updateProfile(data: Partial<RiderProfile>): Promise<ApiResponse<RiderProfile>> {
    return apiClient.patch<RiderProfile>(API_CONFIG.ENDPOINTS.RIDER_PROFILE, data);
  },

  /**
   * Update rider availability status
   */
  async updateAvailability(data: AvailabilityUpdateRequest): Promise<ApiResponse<{ message: string }>> {
    return apiClient.post<{ message: string }>(API_CONFIG.ENDPOINTS.RIDER_AVAILABILITY, data);
  },

  async getAssignedOrders(): Promise<ApiResponse<RiderAssignedOrderSummary[]>> {
    return apiClient.get<RiderAssignedOrderSummary[]>(API_CONFIG.ENDPOINTS.RIDER_ASSIGNED_ORDERS);
  },

  async getAssignedOrderDetail(orderNumber: string): Promise<ApiResponse<RiderAssignedOrderDetail>> {
    return apiClient.get<RiderAssignedOrderDetail>(
      API_CONFIG.ENDPOINTS.RIDER_ASSIGNED_ORDER_DETAIL(orderNumber)
    );
  },

  async updateAssignedOrderStatus(
    orderNumber: string,
    data: RiderOrderStatusUpdateRequest
  ): Promise<ApiResponse<RiderAssignedOrderDetail>> {
    return apiClient.patch<RiderAssignedOrderDetail>(
      API_CONFIG.ENDPOINTS.RIDER_ASSIGNED_ORDER_STATUS(orderNumber),
      data
    );
  },

  async sendOrderLocationHttp(
    orderNumber: string,
    data: RiderLocationUpdatePayload
  ): Promise<ApiResponse<any>> {
    return apiClient.post<any>(
      API_CONFIG.ENDPOINTS.RIDER_ASSIGNED_ORDER_LOCATION_HTTP(orderNumber),
      data
    );
  },

  async getPickupRouteDirections(
    origin: LatLng,
    destination: LatLng
  ): Promise<GoogleDirectionsResponse> {
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.latitude},${origin.longitude}&destination=${destination.latitude},${destination.longitude}&mode=driving&key=${API_CONFIG.GOOGLE_MAPS_API_KEY}`;
    const response = await fetch(url);
    return response.json();
  },

  buildOrderLocationWebSocketUrl(orderNumber: string, token: string): string {
    const httpBase = API_CONFIG.BASE_URL.replace(/\/$/, '');
    const wsBase = httpBase.startsWith('https://')
      ? httpBase.replace('https://', 'wss://')
      : httpBase.replace('http://', 'ws://');
    return `${wsBase.replace('/api', '')}/ws/riders/orders/${orderNumber}/location/?token=${encodeURIComponent(token)}`;
  },

  createOrderLocationSocket(orderNumber: string, token: string): WebSocket {
    const socketUrl = this.buildOrderLocationWebSocketUrl(orderNumber, token);
    return new WebSocket(socketUrl);
  },
};
