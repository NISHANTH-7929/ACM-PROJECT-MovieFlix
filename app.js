import config from './config.js';

document.addEventListener('DOMContentLoaded', () => {
    // --- API Configuration & Documentation ---
    const API_KEY = config.tmdbApiKey;
    const BASE_URL = 'https://api.themoviedb.org/3';
    const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';
    
    // API Endpoints Used:
    // - GET /movie/popular (for the homepage)
    // - GET /search/movie (for search functionality)
    // - GET /movie/{id} (for movie details)

    // --- State Management ---
    let currentPage = 1;
    let currentSearchTerm = '';
    let currentView = 'home'; // 'home', 'details', 'favorites'

    // --- DOM Element References ---
    const movieGrid = document.getElementById('movie-grid');
    const spinner = document.getElementById('spinner');
    const loadMoreBtn = document.getElementById('load-more-btn');
    const searchForm = document.getElementById('search-form');
    const searchInput = document.getElementById('search-input');
    const moviesSection = document.getElementById('movies-section');
    const movieDetailsSection = document.getElementById('movie-details-section');
    const movieCardTemplate = document.getElementById('movie-card-template');
    const moviesHeading = document.getElementById('movies-heading');
    
    // --- API Fetch Functions (with Error Handling) ---
    async function fetchMovieTrailer(movieId) {
        try {
            const response = await fetch(`${BASE_URL}/movie/${movieId}/videos?api_key=${API_KEY}`);
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            const data = await response.json();
            // Filter for YouTube trailers, preferring official trailers
            const trailers = data.results.filter(video => 
                video.site === 'YouTube' && 
                (video.type === 'Trailer' || video.type === 'Teaser')
            );
            return trailers.length > 0 ? trailers[0] : null;
        } catch (error) {
            console.error("Failed to fetch movie trailer:", error);
            return null;
        }
    }

    async function fetchMovies(url) {
        spinner.classList.remove('hidden');
        loadMoreBtn.classList.add('hidden');
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            const data = await response.json();
            return data.results;
        } catch (error) {
            console.error("Failed to fetch movies:", error);
            movieGrid.innerHTML = `<p class="error">Failed to load movies. Please try again later.</p>`;
            return [];
        } finally {
            spinner.classList.add('hidden');
        }
    }
    
    // --- DOM Manipulation Functions ---
    function displayMovies(movies) {
        if (currentPage === 1) {
            movieGrid.innerHTML = ''; // Clear grid for new search/page load
        }
        
        movies.forEach(movie => {
            const card = document.importNode(movieCardTemplate.content, true);
            const movieCard = card.querySelector('.movie-card');
            movieCard.dataset.movieId = movie.id; // Store ID for click events
            
            const poster = card.querySelector('img');
            poster.src = movie.poster_path ? `${IMAGE_BASE_URL}${movie.poster_path}` : 'https://via.placeholder.com/500x750?text=No+Image';
            poster.alt = `${movie.title} Poster`;

            card.querySelector('h3').textContent = movie.title;
            movieGrid.appendChild(card);
        });

        if (movies.length > 0) {
            loadMoreBtn.classList.remove('hidden');
        }
    }

    async function displayMovieDetails(movieId) {
        currentView = 'details';
        moviesSection.classList.add('hidden');
        movieDetailsSection.classList.remove('hidden');
        movieDetailsSection.innerHTML = ''; // Clear previous details
        spinner.classList.remove('hidden');
        
        try {
            const [response, trailer] = await Promise.all([
                fetch(`${BASE_URL}/movie/${movieId}?api_key=${API_KEY}`),
                fetchMovieTrailer(movieId)
            ]);
            
            const movie = await response.json();
            const isFavorite = getFavorites().some(fav => fav.id === movie.id);
            const favoriteButtonText = isFavorite ? 'Remove from Favorites' : 'Add to Favorites';

            const trailerHTML = trailer ? `
                <div class="trailer-container">
                    <h3>Trailer</h3>
                    <iframe 
                        src="https://www.youtube.com/embed/${trailer.key}"
                        frameborder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowfullscreen
                    ></iframe>
                </div>
            ` : '';

            movieDetailsSection.innerHTML = `
                <div class="movie-info-container">
                    <img src="${movie.poster_path ? IMAGE_BASE_URL + movie.poster_path : 'https://via.placeholder.com/500x750?text=No+Image'}" alt="${movie.title}">
                    <div class="movie-info">
                        <h2>${movie.title} (${new Date(movie.release_date).getFullYear()})</h2>
                        <p><strong>Rating:</strong> ${movie.vote_average.toFixed(1)} / 10</p>
                        <p>${movie.overview}</p>
                        <div class="action-buttons">
                            <button class="action-btn" id="favorite-btn" data-movie-id="${movie.id}">${favoriteButtonText}</button>
                            <button class="action-btn" id="back-btn">Back to List</button>
                        </div>
                    </div>
                </div>
                ${trailerHTML}
            `;
            // Add event listener to the new back button
            document.getElementById('back-btn').addEventListener('click', showHomeScreen);
            document.getElementById('favorite-btn').addEventListener('click', () => toggleFavorite(movie));
        } catch (error) {
            console.error("Failed to fetch movie details:", error);
            movieDetailsSection.innerHTML = `<p class="error">Could not load details.</p>`;
        } finally {
            spinner.classList.add('hidden');
        }
    }
    
    // --- Application Flow Functions ---
    async function loadInitialMovies() {
        currentPage = 1;
        currentSearchTerm = '';
        moviesHeading.textContent = 'Popular Movies';
        const url = `${BASE_URL}/movie/popular?api_key=${API_KEY}&page=${currentPage}`;
        const movies = await fetchMovies(url);
        displayMovies(movies);
    }
    
    async function loadMoreMovies() {
        currentPage++;
        const url = currentSearchTerm
            ? `${BASE_URL}/search/movie?api_key=${API_KEY}&query=${currentSearchTerm}&page=${currentPage}`
            : `${BASE_URL}/movie/popular?api_key=${API_KEY}&page=${currentPage}`;
        
        const movies = await fetchMovies(url);
        displayMovies(movies); // Appends movies instead of replacing
    }
    
    function showHomeScreen() {
        currentView = 'home';
        movieDetailsSection.classList.add('hidden');
        moviesSection.classList.remove('hidden');
        searchInput.value = ''; // Clear search input when returning home
        loadInitialMovies();
    }
    
    // --- Event Listeners ---
    searchForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const searchTerm = searchInput.value.trim();
        if (searchTerm) {
            currentPage = 1;
            currentSearchTerm = searchTerm;
            moviesHeading.textContent = `Results for "${searchTerm}"`;
            const url = `${BASE_URL}/search/movie?api_key=${API_KEY}&query=${searchTerm}&page=${currentPage}`;
            const movies = await fetchMovies(url);
            if (movies.length === 0) {
                movieGrid.innerHTML = '<p style="text-align: center; width: 100%; padding: 2rem;">No movies found. Try a different search term.</p>';
                loadMoreBtn.classList.add('hidden');
            } else {
                displayMovies(movies);
            }
        }
    });

    // Add real-time search after user stops typing
    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(async () => {
            const searchTerm = e.target.value.trim();
            if (searchTerm.length >= 3) { // Only search if at least 3 characters
                currentPage = 1;
                currentSearchTerm = searchTerm;
                moviesHeading.textContent = `Results for "${searchTerm}"`;
                const url = `${BASE_URL}/search/movie?api_key=${API_KEY}&query=${searchTerm}&page=${currentPage}`;
                const movies = await fetchMovies(url);
                if (movies.length === 0) {
                    movieGrid.innerHTML = '<p style="text-align: center; width: 100%; padding: 2rem;">No movies found. Try a different search term.</p>';
                    loadMoreBtn.classList.add('hidden');
                } else {
                    displayMovies(movies);
                }
            } else if (searchTerm.length === 0) {
                // If search is cleared, show popular movies
                showHomeScreen();
            }
        }, 500); // Wait 500ms after user stops typing before searching
    });

    loadMoreBtn.addEventListener('click', loadMoreMovies);
    
    movieGrid.addEventListener('click', (e) => {
        const card = e.target.closest('.movie-card');
        if (card) {
            const movieId = card.dataset.movieId;
            displayMovieDetails(movieId);
        }
    });

    // --- Bonus: Favorites System ---
    function getFavorites() {
        return JSON.parse(localStorage.getItem('favoriteMovies')) || [];
    }
    
    function saveFavorites(favorites) {
        localStorage.setItem('favoriteMovies', JSON.stringify(favorites));
    }
    
    function toggleFavorite(movie) {
        let favorites = getFavorites();
        const favoriteBtn = document.getElementById('favorite-btn');
        if (favorites.some(fav => fav.id === movie.id)) {
            favorites = favorites.filter(fav => fav.id !== movie.id);
            favoriteBtn.textContent = 'Add to Favorites';
        } else {
            favorites.push(movie);
            favoriteBtn.textContent = 'Remove from Favorites';
        }
        saveFavorites(favorites);
    }
    
    function showFavorites() {
        currentView = 'favorites';
        movieDetailsSection.classList.add('hidden');
        moviesSection.classList.remove('hidden');
        moviesHeading.textContent = 'My Favorites';
        const favorites = getFavorites();
        currentPage = 1; // Reset for display purposes
        displayMovies(favorites);
        loadMoreBtn.classList.add('hidden'); // No pagination for favorites
    }
    
    // Navigation Links
    document.getElementById('home-link').addEventListener('click', showHomeScreen);
    document.getElementById('favorites-link').addEventListener('click', showFavorites);

    // --- Initial Load ---
    loadInitialMovies();
});