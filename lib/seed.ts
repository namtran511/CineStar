import type { Combo, Movie, Promotion, Room, Showtime } from "./types";

// Demonstration catalogue and illustrative screenings, not real release schedules.
const img = (path: string) => `https://image.tmdb.org/t/p/w780${path}`;
export const seedMovies: Movie[] = [
  { id: "dune-2", title: "Dune: Hành tinh cát — Phần hai", originalTitle: "Dune: Part Two", genres: ["Khoa học viễn tưởng", "Phiêu lưu"], duration: 166, rating: 8.5, ageRating: "T16", poster: "/images/dune.jpg", backdrop: "/images/hero.jpg", description: "Paul Atreides cùng Chani và người Fremen bước vào hành trình báo thù, giữa tình yêu và vận mệnh của cả vũ trụ.", director: "Denis Villeneuve", cast: ["Timothée Chalamet", "Zendaya", "Rebecca Ferguson"], releaseDate: "2024-03-01", status: "now" },
  { id: "interstellar", title: "Hố đen tử thần", originalTitle: "Interstellar", genres: ["Khoa học viễn tưởng", "Tâm lý"], duration: 169, rating: 8.7, ageRating: "T13", poster: "/images/interstellar.jpg", backdrop: "/images/interstellar.jpg", description: "Một nhóm phi hành gia vượt qua hố sâu không gian để tìm ngôi nhà mới cho nhân loại. Một hành trình về thời gian, tình cha con và hy vọng.", director: "Christopher Nolan", cast: ["Matthew McConaughey", "Anne Hathaway", "Jessica Chastain"], releaseDate: "2014-11-07", status: "now" },
  { id: "batman", title: "Người Dơi", originalTitle: "The Batman", genres: ["Hành động", "Trinh thám"], duration: 176, rating: 7.8, ageRating: "T16", poster: "/images/batman.jpg", backdrop: "/images/batman.jpg", description: "Bruce Wayne lần theo những manh mối của Riddler, khám phá tham nhũng và những bí mật ẩn sâu trong thành phố Gotham.", director: "Matt Reeves", cast: ["Robert Pattinson", "Zoë Kravitz", "Paul Dano"], releaseDate: "2022-03-04", status: "now" },
  { id: "mai", title: "Mai", originalTitle: "Mai", genres: ["Tâm lý", "Lãng mạn", "Việt Nam"], duration: 131, rating: 7.4, ageRating: "T18", poster: "/images/mai.jpg", backdrop: "/images/mai.jpg", description: "Một người phụ nữ từng trải tìm thấy tình yêu và cơ hội bắt đầu lại, nhưng quá khứ cùng định kiến vẫn đeo bám cuộc đời cô.", director: "Trấn Thành", cast: ["Phương Anh Đào", "Tuấn Trần", "Hồng Đào"], releaseDate: "2024-02-10", status: "now" },
  { id: "spiderverse", title: "Người Nhện: Du hành vũ trụ Nhện", originalTitle: "Spider-Man: Across the Spider-Verse", genres: ["Hoạt hình", "Hành động", "Phiêu lưu"], duration: 140, rating: 8.6, ageRating: "T13", poster: "/images/spiderverse.jpg", backdrop: "/images/spiderverse.jpg", description: "Miles Morales tái ngộ Gwen Stacy và du hành qua đa vũ trụ, nơi cậu gặp những Người Nhện với những lựa chọn đầy thử thách.", director: "Joaquim Dos Santos", cast: ["Shameik Moore", "Hailee Steinfeld", "Oscar Isaac"], releaseDate: "2023-06-02", status: "now" },
  { id: "inside-out-2", title: "Những mảnh ghép cảm xúc 2", originalTitle: "Inside Out 2", genres: ["Hoạt hình", "Gia đình", "Hài"], duration: 96, rating: 7.6, ageRating: "P", poster: "/images/insideout.jpg", backdrop: "/images/insideout.jpg", description: "Riley bước vào tuổi mới lớn. Niềm Vui, Nỗi Buồn và những cảm xúc quen thuộc phải làm quen với Lo Âu cùng các bạn mới.", director: "Kelsey Mann", cast: ["Amy Poehler", "Maya Hawke", "Kensington Tallman"], releaseDate: "2024-06-14", status: "now" },
  { id: "oppenheimer", title: "Oppenheimer", originalTitle: "Oppenheimer", genres: ["Tiểu sử", "Tâm lý", "Lịch sử"], duration: 180, rating: 8.3, ageRating: "T18", poster: "/images/oppenheimer.jpg", backdrop: "/images/oppenheimer.jpg", description: "Chân dung nhà vật lý J. Robert Oppenheimer và những lựa chọn làm thay đổi lịch sử nhân loại.", director: "Christopher Nolan", cast: ["Cillian Murphy", "Emily Blunt", "Robert Downey Jr."], releaseDate: "2026-10-23", status: "coming" },
  { id: "the-wild-robot", title: "Robot hoang dã", originalTitle: "The Wild Robot", genres: ["Hoạt hình", "Gia đình", "Phiêu lưu"], duration: 102, rating: 8.2, ageRating: "P", poster: "/images/wildrobot.jpg", backdrop: "/images/wildrobot.jpg", description: "Robot Roz bị mắc kẹt trên một hòn đảo hoang, học cách sống cùng muông thú và trở thành người mẹ của một chú ngỗng nhỏ.", director: "Chris Sanders", cast: ["Lupita Nyong'o", "Pedro Pascal", "Kit Connor"], releaseDate: "2026-10-30", status: "coming" },
];
export const seedRooms: Room[] = [
  { id: "room-1", name: "Phòng 01 · IMAX", rows: 8, cols: 12, type: "IMAX" },
  { id: "room-2", name: "Phòng 02 · Premium", rows: 7, cols: 10, type: "Premium" },
  { id: "room-3", name: "Phòng 03 · Standard", rows: 6, cols: 10, type: "Standard" },
];
export const seedCombos: Combo[] = [
  { id: "combo-solo", name: "Solo Pop", description: "1 bắp rang lớn + 1 nước ngọt", price: 79000, image: "/images/combo-solo.svg" },
  { id: "combo-duo", name: "Movie Date", description: "1 bắp rang lớn + 2 nước ngọt", price: 119000, image: "/images/combo-duo.svg" },
  { id: "combo-family", name: "Family Night", description: "2 bắp rang lớn + 3 nước ngọt", price: 179000, image: "/images/combo-family.svg" },
];
export const seedPromotions: Promotion[] = [
  { id: "promo-welcome", code: "WELCOME10", discountPercent: 10, minTotal: 100000, active: true },
  { id: "promo-cinema", code: "CINE20", discountPercent: 20, minTotal: 250000, active: true },
];
export function makeSeedShowtimes(now = new Date()): Showtime[] {
  const dateParts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const localDay = ["year", "month", "day"].map(part => dateParts.find(p => p.type === part)?.value).join("-");
  const firstDay = new Date(`${localDay}T00:00:00+07:00`);
  const shows: Showtime[] = [];
  for (let day = 0; day < 7; day++) {
    for (let room = 0; room < 3; room++) {
      for (let slot = 0; slot < 4; slot++) {
        const movie = room + (slot % 2) * 3;
        const start = new Date(firstDay.getTime() + day * 86400000 + (10 + slot * 4) * 3600000);
        shows.push({ id: `show-${localDay}-${day}-${room}-${slot}`, movieId: seedMovies[movie].id, roomId: seedRooms[room].id, startTime: start.toISOString(), price: room === 0 ? 120000 : 90000, format: room === 0 ? "IMAX 2D · Phụ đề" : "2D · Phụ đề" });
      }
    }
  }
  return shows;
}
