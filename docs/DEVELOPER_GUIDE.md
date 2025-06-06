# 👨‍💻 Flokout API Developer Guide

**For React Native & Web Developers**  
**Version:** 1.0.0

---

## 🚀 Quick Integration

### Setup API Client
```javascript
// api.js
const API_URL = 'http://localhost:3000/api';

class FlokoutAPI {
  constructor() {
    this.baseURL = API_URL;
    this.token = null;
  }

  setAuthToken(token) {
    this.token = token;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...(this.token && { Authorization: `Bearer ${this.token}` }),
        ...options.headers,
      },
      ...options,
    };

    const response = await fetch(url, config);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'API request failed');
    }

    return data;
  }

  // Auth methods
  async login(email, password) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setAuthToken(data.access_token);
    return data;
  }

  async register(email, password, full_name) {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, full_name }),
    });
  }

  async getCurrentUser() {
    return this.request('/auth/me');
  }
}

export default new FlokoutAPI();
```

---

## 🔐 Authentication Patterns

### Login Flow with Error Handling
```javascript
// LoginScreen.js
import api from './api';

const handleLogin = async (email, password) => {
  try {
    const result = await api.login(email, password);
    
    // Store tokens securely
    await AsyncStorage.setItem('access_token', result.access_token);
    await AsyncStorage.setItem('refresh_token', result.refresh_token);
    
    // Navigate to main app
    navigation.navigate('Home');
  } catch (error) {
    Alert.alert('Login Failed', error.message);
  }
};
```

### Auto-Login with Stored Token
```javascript
// App.js
useEffect(() => {
  const checkAuthStatus = async () => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      if (token) {
        api.setAuthToken(token);
        const user = await api.getCurrentUser();
        setCurrentUser(user.user);
        setIsAuthenticated(true);
      }
    } catch (error) {
      // Token expired or invalid
      await AsyncStorage.removeItem('access_token');
      setIsAuthenticated(false);
    }
  };
  
  checkAuthStatus();
}, []);
```

### Token Refresh Pattern
```javascript
// tokenManager.js
class TokenManager {
  async refreshToken() {
    try {
      const refreshToken = await AsyncStorage.getItem('refresh_token');
      const response = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      
      const data = await response.json();
      if (response.ok) {
        await AsyncStorage.setItem('access_token', data.access_token);
        await AsyncStorage.setItem('refresh_token', data.refresh_token);
        api.setAuthToken(data.access_token);
        return data.access_token;
      } else {
        throw new Error('Refresh failed');
      }
    } catch (error) {
      // Redirect to login
      await this.logout();
      throw error;
    }
  }

  async logout() {
    await AsyncStorage.multiRemove(['access_token', 'refresh_token']);
    api.setAuthToken(null);
  }
}
```

---

## 👥 Floks Integration

### Join Flok with Invite Code
```javascript
// JoinFlokScreen.js
const joinFlokWithInvite = async (flokId, inviteCode) => {
  try {
    const result = await api.request(`/floks/${flokId}/join`, {
      method: 'POST',
      body: JSON.stringify({ invite_code: inviteCode }),
    });
    
    Alert.alert('Success', 'You have joined the flok!');
    navigation.navigate('FlokDetails', { flokId });
  } catch (error) {
    Alert.alert('Error', error.message);
  }
};
```

### Create Flok and Generate Invite
```javascript
// CreateFlokScreen.js
const createFlokAndInvite = async (name, inviteExpiryDays = 7) => {
  try {
    // Create flok
    const flok = await api.request('/floks', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
    
    // Generate invite code
    const invite = await api.request(`/floks/${flok.flok.id}/invites`, {
      method: 'POST',
      body: JSON.stringify({ expires_in_days: inviteExpiryDays }),
    });
    
    return {
      flok: flok.flok,
      inviteCode: invite.invite.code,
    };
  } catch (error) {
    throw error;
  }
};
```

---

## 🎉 Flokouts & RSVPs

### Complete Flokout Lifecycle
```javascript
// FlokoutService.js
class FlokoutService {
  // Create flokout
  async createFlokout(flokoutData) {
    return api.request('/flokouts', {
      method: 'POST',
      body: JSON.stringify(flokoutData),
    });
  }

  // Get flokout with RSVPs
  async getFlokoutWithRSVPs(flokoutId) {
    const [flokout, rsvps] = await Promise.all([
      api.request(`/flokouts/${flokoutId}`),
      api.request(`/rsvps/flokout/${flokoutId}`),
    ]);
    
    return {
      ...flokout.flokout,
      rsvps: rsvps.rsvps,
    };
  }

  // RSVP to flokout
  async rsvpToFlokout(flokoutId, response) {
    return api.request(`/rsvps/flokout/${flokoutId}`, {
      method: 'POST',
      body: JSON.stringify({ response }), // 'yes', 'no', 'maybe'
    });
  }

  // Confirm flokout (admin only)
  async confirmFlokout(flokoutId) {
    try {
      return await api.request(`/flokouts/${flokoutId}/confirm`, {
        method: 'POST',
      });
    } catch (error) {
      if (error.message.includes('Minimum')) {
        Alert.alert('Cannot Confirm', 'Not enough people have confirmed attendance.');
      } else {
        throw error;
      }
    }
  }
}
```

### Real-time RSVP Updates
```javascript
// FlokoutScreen.js
const [flokout, setFlokout] = useState(null);
const [rsvps, setRSVPs] = useState(null);

// Poll for RSVP updates
useEffect(() => {
  const pollRSVPs = async () => {
    try {
      const rsvpData = await api.request(`/rsvps/flokout/${flokoutId}`);
      setRSVPs(rsvpData.rsvps);
    } catch (error) {
      console.error('Failed to fetch RSVPs:', error);
    }
  };

  // Poll every 30 seconds during active voting
  const interval = setInterval(pollRSVPs, 30000);
  pollRSVPs(); // Initial fetch

  return () => clearInterval(interval);
}, [flokoutId]);
```

---

## 💰 Expenses & Settlement

### Complete Expense Flow
```javascript
// ExpenseService.js
class ExpenseService {
  // Create expense with auto-sharing
  async createExpense(expenseData) {
    return api.request('/expenses', {
      method: 'POST',
      body: JSON.stringify(expenseData),
    });
  }

  // Get settle up calculations
  async getSettleUp(flokId = null) {
    const endpoint = flokId 
      ? `/expenses/settle-up/calculate?flok_id=${flokId}`
      : '/expenses/settle-up/calculate';
    
    return api.request(endpoint);
  }

  // Mark payment as sent
  async markPaymentSent(expenseShareIds, paymentMethod = 'other') {
    return api.request('/expenses/settle-up/mark-sent', {
      method: 'POST',
      body: JSON.stringify({
        expense_share_ids: expenseShareIds,
        payment_method: paymentMethod,
      }),
    });
  }

  // Mark payment as received (payer only)
  async markPaymentReceived(expenseShareIds) {
    return api.request('/expenses/settle-up/mark-received', {
      method: 'POST',
      body: JSON.stringify({
        expense_share_ids: expenseShareIds,
      }),
    });
  }
}
```

### Smart Settlement Interface
```javascript
// SettleUpScreen.js
const SettleUpScreen = () => {
  const [settleUpItems, setSettleUpItems] = useState([]);
  
  useEffect(() => {
    loadSettleUpData();
  }, []);

  const loadSettleUpData = async () => {
    try {
      const data = await api.request('/expenses/settle-up/calculate');
      setSettleUpItems(data.settle_up_items);
    } catch (error) {
      Alert.alert('Error', 'Failed to load settlement data');
    }
  };

  const handlePaymentSent = async (item, paymentMethod) => {
    try {
      await api.request('/expenses/settle-up/mark-sent', {
        method: 'POST',
        body: JSON.stringify({
          expense_share_ids: item.expense_share_ids,
          payment_method: paymentMethod,
        }),
      });
      
      Alert.alert('Success', 'Payment marked as sent');
      loadSettleUpData(); // Refresh data
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  return (
    <View>
      {settleUpItems.map((item, index) => (
        <SettlementItem 
          key={index}
          item={item}
          onPaymentSent={handlePaymentSent}
        />
      ))}
    </View>
  );
};
```

---

## 📱 React Native Specific Patterns

### AsyncStorage Integration
```javascript
// storage.js
import AsyncStorage from '@react-native-async-storage/async-storage';

export const Storage = {
  async setToken(token) {
    await AsyncStorage.setItem('access_token', token);
  },
  
  async getToken() {
    return AsyncStorage.getItem('access_token');
  },
  
  async removeToken() {
    await AsyncStorage.removeItem('access_token');
  },
  
  async setUser(user) {
    await AsyncStorage.setItem('user', JSON.stringify(user));
  },
  
  async getUser() {
    const user = await AsyncStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  },
};
```

### Navigation Integration
```javascript
// useAuth.js (Custom Hook)
import { useContext, createContext } from 'react';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const login = async (email, password) => {
    try {
      const result = await api.login(email, password);
      setUser(result.user);
      await Storage.setToken(result.access_token);
      await Storage.setUser(result.user);
      return result;
    } catch (error) {
      throw error;
    }
  };

  const logout = async () => {
    try {
      await api.request('/auth/logout', { method: 'POST' });
    } catch (error) {
      // Continue with logout even if API call fails
    } finally {
      setUser(null);
      await Storage.removeToken();
      await Storage.removeUser();
    }
  };

  const value = {
    user,
    login,
    logout,
    isAuthenticated: !!user,
    isLoading,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
```

### Image Upload Pattern (for avatars)
```javascript
// imageUpload.js
import { launchImageLibrary } from 'react-native-image-picker';

const uploadAvatar = async (userId) => {
  return new Promise((resolve, reject) => {
    launchImageLibrary(
      {
        mediaType: 'photo',
        quality: 0.8,
        maxWidth: 500,
        maxHeight: 500,
      },
      async (response) => {
        if (response.didCancel || response.error) {
          reject(new Error('Image selection cancelled'));
          return;
        }

        const formData = new FormData();
        formData.append('avatar', {
          uri: response.assets[0].uri,
          type: response.assets[0].type,
          name: response.assets[0].fileName || 'avatar.jpg',
        });

        try {
          // Note: You'd need to implement file upload endpoint
          const result = await api.request(`/users/${userId}/avatar`, {
            method: 'POST',
            headers: {
              'Content-Type': 'multipart/form-data',
            },
            body: formData,
          });
          resolve(result);
        } catch (error) {
          reject(error);
        }
      }
    );
  });
};
```

---

## 🔄 State Management Patterns

### Redux Integration
```javascript
// store/slices/authSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

export const loginUser = createAsyncThunk(
  'auth/login',
  async ({ email, password }, { rejectWithValue }) => {
    try {
      const result = await api.login(email, password);
      await Storage.setToken(result.access_token);
      return result;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: null,
    token: null,
    isLoading: false,
    error: null,
  },
  reducers: {
    logout: (state) => {
      state.user = null;
      state.token = null;
      Storage.removeToken();
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginUser.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.user;
        state.token = action.payload.access_token;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });
  },
});

export default authSlice.reducer;
```

### Context API Pattern
```javascript
// FlokContext.js
const FlokContext = createContext();

export const FlokProvider = ({ children }) => {
  const [floks, setFloks] = useState([]);
  const [currentFlok, setCurrentFlok] = useState(null);
  
  const loadFloks = async () => {
    try {
      const data = await api.request('/floks');
      setFloks(data.floks);
    } catch (error) {
      console.error('Failed to load floks:', error);
    }
  };

  const createFlok = async (name) => {
    try {
      const result = await api.request('/floks', {
        method: 'POST',
        body: JSON.stringify({ name }),
      });
      setFloks(prev => [...prev, result.flok]);
      return result.flok;
    } catch (error) {
      throw error;
    }
  };

  return (
    <FlokContext.Provider value={{
      floks,
      currentFlok,
      setCurrentFlok,
      loadFloks,
      createFlok,
    }}>
      {children}
    </FlokContext.Provider>
  );
};
```

---

## 🎯 Best Practices

### Error Handling
```javascript
// errorHandler.js
export const handleApiError = (error, navigation) => {
  if (error.message.includes('Not authenticated')) {
    // Token expired
    navigation.navigate('Login');
    return;
  }
  
  if (error.message.includes('Access denied')) {
    Alert.alert('Permission Denied', 'You don\'t have permission for this action');
    return;
  }
  
  // Generic error
  Alert.alert('Error', error.message || 'Something went wrong');
};
```

### Pagination Handling
```javascript
// usePagination.js
const usePagination = (endpoint, limit = 20) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);

  const loadMore = async () => {
    if (loading || !hasMore) return;
    
    setLoading(true);
    try {
      const result = await api.request(
        `${endpoint}?limit=${limit}&offset=${offset}`
      );
      
      const newData = result.flokouts || result.expenses || result.spots || [];
      setData(prev => [...prev, ...newData]);
      setHasMore(newData.length === limit);
      setOffset(prev => prev + limit);
    } catch (error) {
      console.error('Pagination error:', error);
    } finally {
      setLoading(false);
    }
  };

  return { data, loading, hasMore, loadMore };
};
```

### Optimistic Updates
```javascript
// useOptimisticRSVP.js
const useOptimisticRSVP = () => {
  const updateRSVP = async (flokoutId, response, optimisticUpdate) => {
    // Immediately update UI
    optimisticUpdate(response);
    
    try {
      await api.request(`/rsvps/flokout/${flokoutId}`, {
        method: 'POST',
        body: JSON.stringify({ response }),
      });
    } catch (error) {
      // Revert optimistic update
      optimisticUpdate(null);
      throw error;
    }
  };

  return { updateRSVP };
};
```

---

## 🧪 Testing Patterns

### API Testing
```javascript
// __tests__/api.test.js
import api from '../api';

describe('Flokout API', () => {
  beforeEach(() => {
    // Mock fetch or use test server
  });

  test('should login successfully', async () => {
    const result = await api.login('test@example.com', 'password');
    expect(result.access_token).toBeDefined();
    expect(result.user.email).toBe('test@example.com');
  });

  test('should handle login error', async () => {
    await expect(
      api.login('invalid@example.com', 'wrong')
    ).rejects.toThrow('Invalid credentials');
  });
});
```

### Component Testing
```javascript
// __tests__/LoginScreen.test.js
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import LoginScreen from '../LoginScreen';

test('should login successfully', async () => {
  const { getByPlaceholderText, getByText } = render(<LoginScreen />);
  
  fireEvent.changeText(getByPlaceholderText('Email'), 'test@example.com');
  fireEvent.changeText(getByPlaceholderText('Password'), 'password');
  fireEvent.press(getByText('Login'));
  
  await waitFor(() => {
    // Assert navigation or state change
  });
});
```

---

## 🚀 Deployment Considerations

### Environment Configuration
```javascript
// config.js
const config = {
  development: {
    API_URL: 'http://localhost:3000/api',
  },
  staging: {
    API_URL: 'https://staging-api.flokout.com/api',
  },
  production: {
    API_URL: 'https://api.flokout.com/api',
  },
};

export default config[process.env.NODE_ENV || 'development'];
```

### Network Handling
```javascript
// networkService.js
import NetInfo from '@react-native-netinfo/netinfo';

class NetworkService {
  constructor() {
    this.isConnected = true;
    this.initializeNetworkListener();
  }

  initializeNetworkListener() {
    NetInfo.addEventListener(state => {
      this.isConnected = state.isConnected;
    });
  }

  async request(url, options) {
    if (!this.isConnected) {
      throw new Error('No internet connection');
    }
    
    return fetch(url, options);
  }
}
```

---

## 📚 Additional Resources

### Useful Libraries
- **Authentication:** `@react-native-async-storage/async-storage`
- **HTTP Client:** Built-in `fetch` or `axios`
- **State Management:** `@reduxjs/toolkit` or React Context
- **Navigation:** `@react-navigation/native`
- **Forms:** `react-hook-form`
- **Date Handling:** `date-fns`
- **Image Picker:** `react-native-image-picker`

### Performance Tips
1. **Debounce search inputs** to avoid excessive API calls
2. **Cache frequently accessed data** using AsyncStorage
3. **Implement lazy loading** for large lists
4. **Use pagination** for expense and flokout lists
5. **Optimize re-renders** with React.memo and useMemo

---

**🎯 Ready to Build!**  
You now have everything needed to integrate Flokout APIs into your React Native app. The API is fully functional and ready for production use. 