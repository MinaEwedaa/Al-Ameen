import type { Role } from '../../../core/constants/roles';

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AuthResponse {
  access_token: string;
  expires_in: number;
  staff: {
    staff_id: number;
    name: string;
    default_shift_type: 'morning' | 'evening' | 'night';
  };
  shift: {
    shift_id: number;
    staff_id: number;
    shift_date: string;
    shift_type: 'morning' | 'evening' | 'night';
    start_time: string;
    end_time: string;
    status: 'active' | 'handed_over';
    handed_over_at?: string | null;
    shift_notes?: string | null;
  } | null;
  read_only: boolean;
}



export interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: Role;
  lastLogin: string;
  status: 'active' | 'inactive';
}
