export function movieRatingLabel(movie) {
    return Number(movie.reviewCount) > 0 ? `${Number(movie.rating).toFixed(1)}/10` : "Chưa đánh giá";
}
