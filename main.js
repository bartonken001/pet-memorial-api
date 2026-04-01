// Language Switcher
class LanguageSwitcher {
    constructor() {
        this.currentLang = 'zh';
        this.init();
    }

    init() {
        const savedLang = localStorage.getItem('lang');
        if (savedLang) {
            this.currentLang = savedLang;
        }
        this.updateButtons();
        this.applyLanguage();

        document.querySelectorAll('.lang-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchLanguage(e.target.dataset.lang);
            });
        });
    }

    switchLanguage(lang) {
        this.currentLang = lang;
        localStorage.setItem('lang', lang);
        this.updateButtons();
        this.applyLanguage();
    }

    updateButtons() {
        document.querySelectorAll('.lang-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.lang === this.currentLang);
        });
    }

    applyLanguage() {
        document.body.classList.toggle('en', this.currentLang === 'en');
        document.documentElement.lang = this.currentLang === 'en' ? 'en' : 'zh-CN';

        document.querySelectorAll('[data-zh]').forEach(el => {
            const text = el.dataset[this.currentLang];
            if (text) {
                el.textContent = text;
            }
        });
    }
}

// API Service
class APIService {
    constructor() {
        this.baseURL = 'https://pet-memorial-api-new.onrender.com';
    }

    async getProducts() {
        try {
            const response = await fetch(`${this.baseURL}/api/products`);
            if (!response.ok) throw new Error('Failed to fetch products');
            return await response.json();
        } catch (error) {
            console.error('API Error:', error);
            return [];
        }
    }

    async healthCheck() {
        try {
            const response = await fetch(`${this.baseURL}/api/health`);
            return response.ok;
        } catch {
            return false;
        }
    }
}

const api = new APIService();

// Product Loader
class ProductLoader {
    constructor() {
        this.loadProducts();
    }

    async loadProducts() {
        // Load products in main page product grid
        const mainProductGrid = document.querySelector('.popular-products .product-grid');
        if (mainProductGrid) {
            mainProductGrid.innerHTML = '<p class="loading">加载中...</p>';
            const products = await api.getProducts();
            
            if (products.length > 0) {
                // Show first 3 products on homepage
                mainProductGrid.innerHTML = products.slice(0, 3).map(product => `
                    <a href="product-detail.html?id=${product.id}" class="product-card">
                        <div class="product-image" style="background-image: url('${product.image_url || 'https://via.placeholder.com/300x200'}')">
                            ${product.category ? `<span class="product-badge">${this.getCategoryName(product.category)}</span>` : ''}
                        </div>
                        <div class="product-info">
                            <h3>${product.name}</h3>
                            <p class="product-desc">${product.description || ''}</p>
                            <p class="product-price">¥${product.price}</p>
                        </div>
                    </a>
                `).join('');
            }
        }

        // Load products in full products page
        const productsGrid = document.querySelector('#products-grid');
        if (productsGrid) {
            productsGrid.innerHTML = '<p class="loading">加载中...</p>';
            const products = await api.getProducts();
            
            if (products.length === 0) {
                productsGrid.innerHTML = '<p class="no-products">暂无产品</p>';
                return;
            }

            productsGrid.innerHTML = products.map(product => `
                <a href="product-detail.html?id=${product.id}" class="product-card">
                    <div class="product-image" style="background-image: url('${product.image_url || 'https://via.placeholder.com/300x200'}')">
                        ${product.category ? `<span class="product-badge">${this.getCategoryName(product.category)}</span>` : ''}
                    </div>
                    <div class="product-info">
                        <h3>${product.name}</h3>
                        <p class="product-desc">${product.description || ''}</p>
                        <p class="product-price">¥${product.price}</p>
                    </div>
                </a>
            `).join('');
        }
    }

    getCategoryName(category) {
        const categories = {
            'pendant': '吊坠',
            'box': '骨灰盒',
            'doll': '公仔',
            'urns': '骨灰瓮',
            'jewelry': '首饰',
            'keepsakes': '纪念品'
        };
        return categories[category] || category;
    }
}

// Mobile Menu
class MobileMenu {
    constructor() {
        this.btn = document.querySelector('.mobile-menu-btn');
        this.nav = document.querySelector('.nav');
        this.init();
    }

    init() {
        if (this.btn) {
            this.btn.addEventListener('click', () => {
                this.nav.classList.toggle('active');
            });
        }
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    new LanguageSwitcher();
    new MobileMenu();
    
    // Check if we need to load products
    if (document.querySelector('.product-grid, #products-grid')) {
        new ProductLoader();
    }
});

// Auth State Manager
class AuthManager {
    constructor() {
        this.user = this.getUser();
        this.updateUI();
    }

    getUser() {
        const userStr = localStorage.getItem('user');
        return userStr ? JSON.parse(userStr) : null;
    }

    getToken() {
        return localStorage.getItem('token');
    }

    isLoggedIn() {
        return !!this.getToken();
    }

    logout() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = 'index.html';
    }

    updateUI() {
        const nav = document.querySelector('.nav');
        if (!nav) return;

        // Remove existing auth elements
        const existingAuth = document.querySelector('.auth-section');
        if (existingAuth) existingAuth.remove();

        // Add auth section to nav
        const authSection = document.createElement('div');
        authSection.className = 'auth-section';
        authSection.style = 'display:flex;align-items:center;gap:10px;';

        if (this.isLoggedIn()) {
            authSection.innerHTML = `
                <span style="color:#666;font-size:14px;">${this.user.name}</span>
                <a href="#" class="btn-logout" style="color:#e74c3c;text-decoration:none;font-size:14px;">退出</a>
            `;
            authSection.querySelector('.btn-logout').addEventListener('click', (e) => {
                e.preventDefault();
                this.logout();
            });
        } else {
            authSection.innerHTML = `
                <a href="login.html" style="color:#f5a623;text-decoration:none;font-size:14px;">登录</a>
                <a href="register.html" style="color:#27ae60;text-decoration:none;font-size:14px;">注册</a>
            `;
        }

        nav.appendChild(authSection);
    }
}

// Initialize auth
const auth = new AuthManager();
