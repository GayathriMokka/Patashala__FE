export const TRANSPORT_TABS = ['assignment', 'payments', 'vehicles'] as const
export type TransportTab = (typeof TRANSPORT_TABS)[number]

export const FEE_TYPES = ['Monthly', 'Quarterly', 'Half-Yearly', 'Annual'] as const
export type FeeType = (typeof FEE_TYPES)[number]

export const TRIP_SELECTIONS = ['Morning', 'Evening', 'Combined'] as const
export type TripSelection = (typeof TRIP_SELECTIONS)[number]

export const PAYMENT_MODES = ['Cash', 'UPI', 'Card', 'Bank Transfer', 'Online Gateway'] as const
export type TransportPaymentMode = (typeof PAYMENT_MODES)[number]

export const FEE_STATUSES = ['Paid', 'Pending', 'Partial'] as const
export type FeeStatus = (typeof FEE_STATUSES)[number]

export type TransportDashboard = {
  total_vehicles: number
  total_routes: number
  total_trips: number
  total_assigned_students: number
  monthly_revenue: number
  pending_payments: number
  collected_payments: number
  active_vehicles: number
}

export type TransportMapping = {
  van_id: number
  route_id: number
  trip_type: string
  trip_selection: string
  vehicle_number: string
  vehicle_name?: string
  capacity: number
  occupied_seats: number
  available_seats: number
  route_name: string
  route_code: string
  driver_name?: string
  stops_count: number
}

export type TransportAssignment = {
  id: number
  student_id: number
  student_name: string
  admission_number?: string
  class_name?: string
  section_name?: string
  class_id?: number
  section_id?: number
  route_name: string
  trip_selection?: string
  vehicle_number?: string
  fee_type?: string
  fee_amount: number
  paid_amount: number
  pending_amount: number
  fee_status: FeeStatus
  assigned_at?: string
  is_active: boolean
  route_id: number
  van_id?: number
  stop_id: number
  remarks?: string
}

export type TransportPayment = {
  id: number
  receipt_number: string
  payment_date: string
  student_name: string
  route_name: string
  trip_selection?: string
  amount: number
  discount: number
  final_amount: number
  payment_mode: string
  collected_by_name?: string
  status: string
  assignment_id: number
}

export type VehicleSummary = {
  id: number
  vehicle_number: string
  vehicle_name?: string
  driver_name?: string
  driver_mobile?: string
  capacity: number
  occupied_seats: number
  available_seats: number
  vehicle_status: string
  live_status: string
  is_active: boolean
}
