# 🔧 Troubleshooting Guide

## Common Issues and Solutions

### Issue 1: Unable to Generate Invite to Flok from API

**Problem**: Getting errors when trying to create invite codes for floks.

**Root Cause**: The invite creation requires:
1. User must be authenticated with a valid JWT token
2. User must be an **admin** of the flok (not just a member)
3. The flok must exist and be accessible to the user

**Solution Steps**:

#### Step 1: Verify Authentication
```bash
# Test your login first
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "password123"}'
```

#### Step 2: Check User's Floks and Role
```bash
# Get your floks and check your role
curl -X GET http://localhost:3000/api/floks \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### Step 3: Create Invite (Admin Only)
```bash
# Create invite for a flok where you are admin
curl -X POST http://localhost:3000/api/floks/FLOK_ID/invites \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"max_uses": 10}'
```

**Common Error Messages**:
- `"Access denied. Admin role required."` - You need admin role in the flok
- `"Not authenticated"` - Invalid or missing JWT token
- `"Flok not found"` - Invalid flok ID or you're not a member

**Complete Working Example**:
```javascript
// In your React Native app
const createInvite = async (flokId) => {
  try {
    const token = await AsyncStorage.getItem('access_token');
    
    const response = await fetch(`${API_URL}/floks/${flokId}/invites`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        max_uses: 10
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error);
    }

    const result = await response.json();
    console.log('Invite Code:', result.invite.code);
    return result.invite;
    
  } catch (error) {
    console.error('Failed to create invite:', error.message);
    Alert.alert('Error', error.message);
  }
};
```

---

### Issue 2: How to Associate Spot with Flok

**Problem**: Need to associate a spot (venue) with a specific flok when creating it.

**Solution**: Include the `flok_id` parameter when creating a spot.

#### Method 1: Create Spot Associated with Flok
```bash
curl -X POST http://localhost:3000/api/spots \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Downtown Basketball Court",
    "address": "123 Main St, City, State",
    "cost_per_hour": 25.00,
    "contact_number": "+1-555-0123",
    "flok_id": "your-flok-uuid-here",
    "tags": ["outdoor", "basketball", "free-parking"]
  }'
```

#### Method 2: Create Global Spot (No Flok Association)
```bash
curl -X POST http://localhost:3000/api/spots \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Public Basketball Court",
    "address": "456 Park Ave, City, State",
    "cost_per_hour": 0,
    "flok_id": null,
    "tags": ["public", "basketball"]
  }'
```

**React Native Example**:
```javascript
const createFlokSpot = async (flokId, spotData) => {
  try {
    const token = await AsyncStorage.getItem('access_token');
    
    const response = await fetch(`${API_URL}/spots`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...spotData,
        flok_id: flokId  // This associates the spot with the flok
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error);
    }

    const result = await response.json();
    return result.spot;
    
  } catch (error) {
    console.error('Failed to create spot:', error.message);
    Alert.alert('Error', error.message);
  }
};

// Usage
const spotData = {
  name: "My Court",
  address: "123 Main St",
  cost_per_hour: 30,
  contact_number: "+1-555-0123",
  tags: ["indoor", "basketball"]
};

createFlokSpot("flok-uuid-here", spotData);
```

#### Get Spots by Flok
```bash
# Get all spots associated with a specific flok
curl -X GET http://localhost:3000/api/spots/flok/FLOK_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Key Points**:
1. **flok_id is optional** - if omitted, creates a global spot
2. **flok_id links spot to flok** - when provided, associates spot with that specific flok
3. **Permissions required** - you must be a member of the flok to create spots for it
4. **Admin permissions for updates** - flok admins can update/delete flok spots

---

### Issue 3: Testing with Interactive Interface

**Use the built-in test interface for easier debugging**:

1. **Open Test Interface**: http://localhost:3000/test-api.html
2. **Login in Auth Tab**: Use existing credentials or register new user
3. **Create Flok in Floks Tab**: This makes you admin automatically
4. **Test Invite Creation**: In same Floks tab, use "Create Invite" with auto-populated flok ID
5. **Test Spot Creation**: In Spots tab, use the auto-populated flok ID

**Benefits of Test Interface**:
- ✅ Auto-ID extraction between operations
- ✅ Token management handled automatically  
- ✅ Real-time error display
- ✅ Copy-paste friendly results
- ✅ No need to manually track UUIDs

---

### Issue 4: Database Schema Requirements

**The API expects these tables to exist in Supabase**:

#### flok_invites table
```sql
CREATE TABLE flok_invites (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  flok_id uuid REFERENCES floks(id) ON DELETE CASCADE,
  code text UNIQUE NOT NULL,
  created_by uuid REFERENCES profiles(id),
  expires_at timestamp with time zone NOT NULL,
  used boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);
```

#### spots table with flok association
```sql
-- Ensure spots table has flok_id column
ALTER TABLE spots ADD COLUMN IF NOT EXISTS flok_id uuid REFERENCES floks(id) ON DELETE SET NULL;
```

**Check if tables exist**:
```sql
-- In Supabase SQL Editor
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('flok_invites', 'spots', 'floks', 'flokmates');
```

---

### Issue 5: Common Error Messages and Solutions

| Error Message | Cause | Solution |
|---------------|-------|----------|
| `"Access denied. Admin role required."` | Not admin of flok | Make sure you're admin, not just member |
| `"You are not a member of this flok."` | Not in flok | Join the flok first, or use different flok ID |
| `"Failed to create invite"` | Database error | Check flok_invites table exists |
| `"Invalid login credentials"` | Wrong email/password | Use correct credentials or register new user |
| `"Not authenticated"` | Missing/invalid token | Login again to get fresh token |
| `"Flok not found"` | Wrong flok ID | Check flok ID exists and you have access |

---

### Issue 6: Quick Testing Commands

**Complete workflow test**:
```bash
# 1. Register (if needed)
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123","full_name":"Test User"}'

# 2. Login
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}' | \
  python3 -c "import sys, json; print(json.load(sys.stdin)['access_token'])")

# 3. Create flok (makes you admin)
FLOK_ID=$(curl -s -X POST http://localhost:3000/api/floks \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Flok"}' | \
  python3 -c "import sys, json; print(json.load(sys.stdin)['flok']['id'])")

# 4. Create invite
curl -X POST http://localhost:3000/api/floks/$FLOK_ID/invites \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"max_uses": 10}'

# 5. Create spot associated with flok
curl -X POST http://localhost:3000/api/spots \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Test Court\",\"flok_id\":\"$FLOK_ID\"}"
```

---

### Best Practices

1. **Always check user role** before attempting admin operations
2. **Use the test interface** for development and debugging
3. **Store tokens securely** in React Native AsyncStorage
4. **Handle token expiration** with refresh mechanism
5. **Validate flok membership** before flok-specific operations
6. **Use auto-ID extraction** in test interface for seamless workflow
7. **Check error messages** for specific permission issues

---

**🎯 Ready to Test!**  
Use the interactive test interface at http://localhost:3000/test-api.html for the easiest way to test both invite creation and spot-flok association. 