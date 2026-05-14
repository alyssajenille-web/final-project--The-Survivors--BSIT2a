const API_CONFIG = {
  BASE_URL: '/api',

  async apiCall(endpoint, method = 'GET', body = null, token = null) {
    const url = `${this.BASE_URL}${endpoint}`;
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    if (body) {
      options.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(url, options);
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem('token');
          localStorage.removeItem('currentUser');
          window.location.href = 'login.html';
          throw new Error('Session expired. Please login again.');
        }
        throw new Error(data.message || 'API request failed');
      }

      return data;
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = API_CONFIG;
}