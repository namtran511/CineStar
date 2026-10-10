// Official studio/distributor uploads, verified with YouTube oEmbed.
const trailerIds = {
    "dune-2": "Way9Dexny3w",
    interstellar: "zSWdZVtXT7E",
    batman: "mqqft2x_Aa4",
    mai: "HXWRTGbhb4U",
    spiderverse: "cqGjhVJWtEg",
    "inside-out-2": "LEjhY15eCx0",
    oppenheimer: "bK6ldnjE3Y0",
    "the-wild-robot": "njPNg0A9VpY",
};
export function movieTrailer(movie) {
    const id = trailerIds[movie.id];
    return id ? `https://www.youtube.com/watch?v=${id}` : undefined;
}
// Landscape artwork is separate from the portrait posters used in movie cards.
const featuredBackdrops = {
    "dune-2": "/images/hero.jpg",
    interstellar: "/images/backdrops/interstellar.jpg",
    batman: "/images/backdrops/batman.jpg",
    mai: "/images/backdrops/mai.jpg",
    spiderverse: "/images/backdrops/spiderverse.jpg",
    "inside-out-2": "/images/backdrops/inside-out-2.jpg",
    oppenheimer: "/images/backdrops/oppenheimer.jpg",
    "the-wild-robot": "/images/backdrops/the-wild-robot.jpg",
};
export function featuredBackdrop(movie) {
    return featuredBackdrops[movie.id] || movie.backdrop || movie.poster || "/images/hero.jpg";
}
