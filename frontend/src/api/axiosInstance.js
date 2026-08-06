import axios from 'axios';

const api = axios.create({
  baseURL:
    import.meta.env.VITE_API_URL ||
    'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const accessToken = localStorage.getItem('token');

    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    const isUnauthorized =
      error.response?.status === 401;

    const isAuthenticationRequest =
      originalRequest?.url?.includes('/auth/login') ||
      originalRequest?.url?.includes('/auth/refresh');

    if (
      isUnauthorized &&
      !originalRequest?._retry &&
      !isAuthenticationRequest
    ) {
      originalRequest._retry = true;

      const refreshToken =
        localStorage.getItem('refreshToken');

      if (!refreshToken) {
        clearAuthentication();
        return Promise.reject(error);
      }

      try {
        const response = await axios.post(
          `${
            import.meta.env.VITE_API_URL ||
            'http://localhost:5000/api'
          }/auth/refresh`,
          {
            refreshToken,
          }
        );

        const newAccessToken =
          response.data.accessToken;

        localStorage.setItem(
          'token',
          newAccessToken
        );

        if (response.data.user) {
          localStorage.setItem(
            'user',
            JSON.stringify(response.data.user)
          );
        }

        originalRequest.headers.Authorization =
          `Bearer ${newAccessToken}`;

        return api(originalRequest);
      } catch (refreshError) {
        clearAuthentication();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

function clearAuthentication() {
  localStorage.removeItem('token');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');

  if (window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
}

export default api;