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
  PodUploadResponse,
} from '@/types/api';

type LatLng = { latitude: number; longitude: number };

export type GoogleDirectionsResponse = {
  status: string;
  routes?: {
    overview_polyline?: { points?: string };
    legs?: {
      distance?: { text?: string };
      duration?: { text?: string };
    }[];
  }[];
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

  async getOrderHistory(): Promise<ApiResponse<RiderAssignedOrderSummary[]>> {
    return apiClient.get<RiderAssignedOrderSummary[]>(API_CONFIG.ENDPOINTS.RIDER_ORDER_HISTORY);
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

  /**
   * Upload Proof of Delivery photo for an assigned order.
   *
   * Uses native fetch() instead of axios to avoid axios's default
   * Content-Type: application/json header leaking into FormData requests.
   * With fetch(), the browser/React Native runtime automatically sets
   * 'multipart/form-data; boundary=...' when given a FormData body.
   */
  async uploadProofOfDelivery(
    orderNumber: string,
    imageUri: string,
    imageName: string = 'pod.jpg',
    imageType: string = 'image/jpeg',
    notes: string = ''
  ): Promise<ApiResponse<PodUploadResponse>> {
    const formData = new FormData();

    if (Platform.OS === 'web') {
      try {
        const fileObject = await blobToFile(imageUri, imageName, imageType);
        formData.append('image', fileObject);
      } catch {
        throw new Error('Failed to process the delivery photo. Please try again.');
      }
    } else {
      // React Native: { uri, name, type } is the correct RN FormData format.
      // Do NOT use instanceof File here — RN's FormData accepts this plain object.
      formData.append('image', {
        uri: imageUri,
        name: imageName,
        type: imageType,
      } as any);
    }

    if (notes.trim()) {
      formData.append('notes', notes.trim());
    }

    // Build the full URL and grab the current auth token from the shared client.
    const url = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.RIDER_POD_UPLOAD(orderNumber)}`;
    const token = apiClient.getAccessToken();

    const headers: Record<string, string> = {
      Accept: 'application/json',
      // Do NOT set Content-Type here — fetch sets it automatically with the
      // correct multipart boundary when the body is FormData.
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    console.log('[POD Upload] POST', url);

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers,
        body: formData,
      });
    } catch (networkError: any) {
      console.error('[POD Upload] Network error:', networkError);
      return {
        StatusCode: 0,
        IsSuccess: false,
        ErrorMessage: [networkError?.message ?? 'Network error. Please check your connection.'],
        Result: null as any,
      };
    }

    let data: ApiResponse<PodUploadResponse>;
    try {
      data = await response.json();
    } catch {
      return {
        StatusCode: response.status,
        IsSuccess: false,
        ErrorMessage: ['Server returned an unexpected response. Please try again.'],
        Result: null as any,
      };
    }

    console.log('[POD Upload] Response status:', response.status, 'IsSuccess:', data?.IsSuccess);
    return data;
  },
};
