export type Role = "admin" | "staff" | "user";
export interface User { id: string; name: string; email: string; role: Role }
export interface Movie {
  id: string; title: string; originalTitle: string; genres: string[]; duration: number;
  rating: number; ageRating: string; poster: string; backdrop: string; description: string;
  director: string; cast: string[]; releaseDate: string; status: "now" | "coming";
}
export interface Room { id: string; name: string; rows: number; cols: number; type: string }
export interface Showtime { id: string; movieId: string; roomId: string; startTime: string; price: number; format: string }
export interface Combo { id: string; name: string; description: string; price: number; image: string }
export interface Promotion { id: string; code: string; discountPercent: number; minTotal: number; active: boolean }
export interface Booking {
  id: string; userId: string; showtimeId: string; seats: string[]; combos: { id: string; qty: number }[];
  total: number; code: string; status: "paid" | "cancelled" | "checked_in"; createdAt: string;
  movieTitle: string; roomName: string; startTime: string; customerName?: string;
  paymentMethod: "momo" | "bank" | "card";
}
export interface Catalog { movies: Movie[]; showtimes: Showtime[]; rooms: Room[]; combos: Combo[]; promotions: Promotion[] }
export interface Bootstrap extends Catalog { user: User | null; aiConfigured: boolean }
export interface AdminSummary {
  revenue: number; tickets: number; orders: number; occupancy: number;
  dailyRevenue: { date: string; revenue: number }[];
  byMovie: { title: string; revenue: number; tickets: number }[];
  recentBookings: Booking[];
}
