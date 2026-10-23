// Shapes from Manager API Contract v1.2 (§10.1 Room types & amenities).

/** v1.2: MongoDB ObjectId sent as a string, e.g. "6719b4a1f2e8c90012ab34cd" */
export type EntityId = string;

export interface RoomType {
  room_type_id: EntityId;
  name: string;
  /** Default nightly tariff (EGP); each room keeps its own price_per_night */
  base_price: number;
  capacity: number;
  description: string;
  is_active: boolean;
  rooms_count: number;
  /** Lowest / highest price_per_night of the type's active rooms (read-only) */
  price_min: number;
  price_max: number;
  amenities: string[];
  occupancy_rate_pct: number;
  revenue_month_to_date: number;
}

/** PATCH /room-types/{id} */
export interface RoomTypeUpdate {
  base_price?: number;
  capacity?: number;
  description?: string;
  amenities?: string[];
}
