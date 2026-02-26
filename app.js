const API_BASE = 'https://pokeapi.co/api/v2';
const PAGE_SIZE = 16;

const state = {
  cache: new Map(),
  results: [],
  page: 1,
  type: '',
  sort: 'id-asc',
  favoritesOnly: false,
  favorites: new Set(JSON.parse(localStorage.getItem('pokelibrary:favorites') || '[]')),
  theme: localStorage.getItem('pokelibrary:theme') || 'dark'
};

const grid = document.querySelector('#pokemon-grid');
const typeFilter = document.querySelector('#type-filter');
const sortFilter = document.querySelector('#sort-filter');
const favoritesOnly = document.querySelector('#favorites-only');
const searchInput = document.querySelector('#search-input');
const pageInfo = document.querySelector('#page-info');
const totalCount = document.querySelector('#total-count');
const favoriteCount = document.querySelector('#favorite-count');
const modal = document.querySelector('#pokemon-modal');
const modalBody = document.querySelector('#modal-body');
const cardTemplate = document.querySelector('#pokemon-card-template');
const themeToggle = document.querySelector('#theme-toggle');

function applyTheme() {
  document.body.classList.toggle('light', state.theme === 'light');
  themeToggle.textContent = state.theme === 'light' ? '🌞 Tema' : '🌙 Tema';
}

function persistFavorites() {
  localStorage.setItem('pokelibrary:favorites', JSON.stringify([...state.favorites]));
}

function formatId(id) {
  return `#${String(id).padStart(4, '0')}`;
}

function typeBadge(type) {
  const span = document.createElement('span');
  span.className = 'type-badge';
  span.textContent = type;
  return span;
}

async function fetchPokemonByNameOrId(query) {
  const key = String(query).trim().toLowerCase();
  if (!key) return null;
  if (state.cache.has(key)) return state.cache.get(key);

  const res = await fetch(`${API_BASE}/pokemon/${encodeURIComponent(key)}`);
  if (!res.ok) return null;

  const data = await res.json();
  state.cache.set(String(data.id), data);
  state.cache.set(data.name, data);
  return data;
}

async function fetchBatch(page = 1) {
  const offset = (page - 1) * PAGE_SIZE;
  const res = await fetch(`${API_BASE}/pokemon?limit=${PAGE_SIZE}&offset=${offset}`);
  const data = await res.json();

  const fullDetails = await Promise.all(data.results.map((p) => fetchPokemonByNameOrId(p.name)));
  return fullDetails.filter(Boolean);
}

async function loadTypes() {
  const res = await fetch(`${API_BASE}/type`);
  const data = await res.json();
  const allowed = data.results
    .map((item) => item.name)
    .filter((name) => !['unknown', 'shadow'].includes(name));

  for (const type of allowed) {
    const option = document.createElement('option');
    option.value = type;
    option.textContent = type;
    typeFilter.append(option);
  }
}

function sortResults(items) {
  const sorted = [...items];
  const [key, direction] = state.sort.split('-');
  const factor = direction === 'asc' ? 1 : -1;

  sorted.sort((a, b) => {
    const valueA = key === 'id' ? a.id : a.name;
    const valueB = key === 'id' ? b.id : b.name;
    if (valueA < valueB) return -1 * factor;
    if (valueA > valueB) return 1 * factor;
    return 0;
  });

  return sorted;
}

function filterResults(items) {
  return items.filter((pokemon) => {
    const hasType = state.type
      ? pokemon.types.some((t) => t.type.name === state.type)
      : true;
    const isFav = state.favoritesOnly ? state.favorites.has(pokemon.id) : true;
    return hasType && isFav;
  });
}

function updateStats(items) {
  totalCount.textContent = String(items.length);
  favoriteCount.textContent = String(state.favorites.size);
}

function renderGrid(items) {
  grid.innerHTML = '';

  if (items.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'status card-glass';
    empty.textContent = 'Nenhum Pokémon encontrado nessa estante 😢';
    grid.append(empty);
    return;
  }

  for (const pokemon of items) {
    const node = cardTemplate.content.cloneNode(true);
    const card = node.querySelector('.pokemon-card');
    const img = node.querySelector('.pokemon-image');
    const id = node.querySelector('.pokemon-id');
    const name = node.querySelector('.pokemon-name');
    const types = node.querySelector('.types');
    const favoriteBtn = node.querySelector('.favorite-btn');
    const detailsBtn = node.querySelector('.details-btn');

    img.src =
      pokemon.sprites.other['official-artwork'].front_default ||
      pokemon.sprites.front_default ||
      '';
    img.alt = pokemon.name;
    id.textContent = formatId(pokemon.id);
    name.textContent = pokemon.name;

    pokemon.types.forEach((t) => types.append(typeBadge(t.type.name)));

    const isActive = state.favorites.has(pokemon.id);
    favoriteBtn.classList.toggle('active', isActive);
    favoriteBtn.textContent = isActive ? '★' : '☆';

    favoriteBtn.addEventListener('click', () => {
      if (state.favorites.has(pokemon.id)) {
        state.favorites.delete(pokemon.id);
      } else {
        state.favorites.add(pokemon.id);
      }
      persistFavorites();
      refresh();
    });

    detailsBtn.addEventListener('click', () => openModal(pokemon));
    card.addEventListener('dblclick', () => openModal(pokemon));

    grid.append(node);
  }
}

function openModal(pokemon) {
  const abilities = pokemon.abilities.map((a) => a.ability.name).join(', ');
  const stats = pokemon.stats
    .map((s) => `${s.stat.name.toUpperCase()}: ${s.base_stat}`)
    .join('<br/>');

  modalBody.innerHTML = `
    <div class="modal-grid">
      <img src="${pokemon.sprites.other['official-artwork'].front_default || pokemon.sprites.front_default || ''}" alt="${pokemon.name}" />
      <div>
        <h2>${pokemon.name} ${formatId(pokemon.id)}</h2>
        <p><strong>Tipos:</strong> ${pokemon.types.map((t) => t.type.name).join(', ')}</p>
        <p><strong>Altura:</strong> ${(pokemon.height / 10).toFixed(1)} m</p>
        <p><strong>Peso:</strong> ${(pokemon.weight / 10).toFixed(1)} kg</p>
        <p><strong>Habilidades:</strong> ${abilities}</p>
        <p><strong>Status base:</strong><br/>${stats}</p>
      </div>
    </div>
  `;
  modal.showModal();
}

async function refresh() {
  const filtered = filterResults(state.results);
  const sorted = sortResults(filtered);
  renderGrid(sorted);
  updateStats(sorted);
  pageInfo.textContent = `Página ${state.page}`;
}

async function init() {
  applyTheme();
  await loadTypes();
  state.results = await fetchBatch(state.page);
  refresh();
}

document.querySelector('#search-btn').addEventListener('click', async () => {
  const value = searchInput.value.trim();
  if (!value) {
    state.results = await fetchBatch(state.page);
    refresh();
    return;
  }

  const found = await fetchPokemonByNameOrId(value);
  state.results = found ? [found] : [];
  state.page = 1;
  refresh();
});

searchInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    document.querySelector('#search-btn').click();
  }
});

typeFilter.addEventListener('change', () => {
  state.type = typeFilter.value;
  refresh();
});

sortFilter.addEventListener('change', () => {
  state.sort = sortFilter.value;
  refresh();
});

favoritesOnly.addEventListener('change', () => {
  state.favoritesOnly = favoritesOnly.checked;
  refresh();
});

document.querySelector('#prev-btn').addEventListener('click', async () => {
  if (state.page === 1) return;
  state.page -= 1;
  state.results = await fetchBatch(state.page);
  refresh();
});

document.querySelector('#next-btn').addEventListener('click', async () => {
  state.page += 1;
  state.results = await fetchBatch(state.page);
  refresh();
});

themeToggle.addEventListener('click', () => {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  localStorage.setItem('pokelibrary:theme', state.theme);
  applyTheme();
});

document.querySelector('#close-modal').addEventListener('click', () => modal.close());
modal.addEventListener('click', (event) => {
  const bounds = modal.getBoundingClientRect();
  const inDialog =
    event.clientX >= bounds.left &&
    event.clientX <= bounds.right &&
    event.clientY >= bounds.top &&
    event.clientY <= bounds.bottom;
  if (!inDialog) modal.close();
});

init().catch((error) => {
  console.error(error);
  grid.innerHTML = '<p class="status card-glass">Erro ao carregar Pokédex. Tenta de novo 🥲</p>';
});
