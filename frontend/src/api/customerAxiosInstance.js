import axios from 'axios';

const baseURL =
  import.meta.env.VITE_API_URL ||
  'http://localhost:5000/api';

const customerApi = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

function clearCustomerAuthentication() {
  localStorage.removeItem('customerToken');
  localStorage.removeItem('customerRefreshToken');
  localStorage.removeItem('customerUser');

  if (
    window.location.pathname.startsWith('/account') ||
    window.location.pathname.startsWith('/cart') ||
    window.location.pathname.startsWith('/orders')
  ) {
    window.location.href = '/customer/login';
  }
}

customerApi.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('customerToken');

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

customerApi.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const isUnauthorized = error.response?.status === 401;
    const isCustomerAuthRequest =
      originalRequest?.url?.includes('/customer-auth/login') ||
      originalRequest?.url?.includes('/customer-auth/signup') ||
      originalRequest?.url?.includes('/customer-auth/refresh');

    if (
      isUnauthorized &&
      !originalRequest?._retry &&
      !isCustomerAuthRequest
    ) {
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem(
        'customerRefreshToken'
      );

      if (!refreshToken) {
        clearCustomerAuthentication();
        return Promise.reject(error);
      }

      try {
        const response = await axios.post(
          `${baseURL}/customer-auth/refresh`,
          { refreshToken }
        );
        const newAccessToken = response.data.accessToken;

        localStorage.setItem('customerToken', newAccessToken);

        if (response.data.customer) {
          localStorage.setItem(
            'customerUser',
            JSON.stringify(response.data.customer)
          );
        }

        originalRequest.headers.Authorization =
          `Bearer ${newAccessToken}`;

        return customerApi(originalRequest);
      } catch (refreshError) {
        clearCustomerAuthentication();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export { clearCustomerAuthentication };
export default customerApi;
