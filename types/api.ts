/**
 * API Response Types for Rider App
 */

export interface ApiResponse<T = any> {
  StatusCode: number;
  IsSuccess: boolean;
  ErrorMessage: string[] | Record<string, string[]>;
  Result: T;
}

export interface AuthTokens {
  access: string;
  refresh: string;
}

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone_number?: string;
  user_type: 'rider';
  is_active: boolean;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  message: string;
  access: string;
  refresh: string;
  user: User;
}

export interface SendOTPRequest {
  email: string;
}

export interface ValidateOTPRequest {
  email: string;
  otp: string;
}

export interface ChangePasswordRequest {
  email: string;
  password: string;
  confirm_password: string;
}

export interface ErrorDetail {
  field?: string;
  message: string;
}

// Rider Registration Types
export interface RiderDocument {
  document_type: 'rider_driving_license' | 'rider_id_proof';
  document_number?: string;
  uploaded_file: File | { uri: string; name: string; type: string };
}

export interface RiderRegistrationData {
  invitation_token: string;
  user: {
    email: string;
    first_name: string;
    last_name: string;
    phone_number: string;
    password: string;
    confirm_password: string;
  };
  date_of_birth?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  vehicle_type: 'bike' | 'scooter' | 'car' | 'van';
  vehicle_number: string;
  vehicle_model?: string;
  vehicle_color?: string;
  documents: RiderDocument[];
}

export interface RiderRegistrationResponse {
  message: string;
}

// Rider Profile Types
export interface RiderProfile extends User {
  date_of_birth?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  vehicle_type: 'bike' | 'scooter' | 'car' | 'van';
  vehicle_number: string;
  vehicle_model?: string;
  vehicle_color?: string;
  operational_status: 'under_review' | 'active' | 'suspended' | 'inactive';
  availability_status: 'available' | 'busy' | 'offline';
  company_name?: string;
}

export interface AvailabilityUpdateRequest {
  status: 'available' | 'busy' | 'offline';
}

export interface RiderAssignedOrderSummary {
  id: number;
  order_number: string;
  order_status: string;
  sender_name: string;
  sender_city: string;
  sender_address: string;
  package_type: string;
  notes?: string;
  assigned_at: string;
}

export interface RiderOrderTrackingItem {
  status: string;
  location_city: string;
  remarks: string;
  created_at: string;
}

export interface RiderAssignedOrderDetail extends RiderAssignedOrderSummary {
  // Full sender info (detail only)
  sender_phone: string;
  sender_city: string;
  sender_state: string;
  sender_latitude: string | null;
  sender_longitude: string | null;
  // Full receiver info (detail only — not exposed in list)
  receiver_name: string;
  receiver_phone: string;
  receiver_address: string;
  receiver_city: string;
  receiver_state: string;
  receiver_latitude: string | null;
  receiver_longitude: string | null;
  // Package details
  service_type: string;
  total_price: string;
  package_description?: string;
  weight: string;
  last_location_update_at?: string | null;
  tracking_history: RiderOrderTrackingItem[];
}

export interface RiderOrderStatusUpdateRequest {
  status: 'picked_up' | 'in_transit' | 'out_for_delivery' | 'delivered';
  remarks?: string;
  location_city?: string;
}

export interface RiderLocationUpdatePayload {
  latitude: number;
  longitude: number;
  accuracy_meters?: number;
  speed_kmh?: number;
  heading_degrees?: number;
}
