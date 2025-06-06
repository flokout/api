# 🎯 Flokout API Documentation

**Version:** 1.0.0  
**Base URL:** `http://localhost:3000/api`  
**Authentication:** JWT Bearer Token Required (except auth endpoints)

> **Living Document**: This documentation is actively maintained and updated as APIs evolve.

---

## 📋 Table of Contents

1. [Quick Start](#quick-start)
2. [Authentication](#authentication)
3. [Database Schema Changes](#database-schema-changes)
4. [Floks (Groups/Communities)](#floks-groupscommunities)
5. [Spots (Venues/Locations)](#spots-venueslocations)
6. [Flokouts (Events)](#flokouts-events)
7. [RSVPs (Attendance)](#rsvps-attendance)
8. [Expenses (Cost Management)](#expenses-cost-management)
9. [Usage Guidelines](#usage-guidelines)
10. [Error Handling](#error-handling)
11. [Testing Interface](#testing-interface)

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Supabase account and project
- Environment variables configured

### Health Check
```bash
GET /health
```

**Response:**
```json
{
  "status": "OK",
  "timestamp": "2025-05-30T15:32:33.602Z",
  "database": "Connected",
  "version": "1.0.0"
}
```

---

## 🗄️ Database Schema Changes

### Recent Updates (June 2025)

#### Spots Table Additions
```sql
-- Add booking_link column to spots table
ALTER TABLE spots 
ADD COLUMN booking_link TEXT;

-- Note: description column already exists
```

**Updated Spots Schema:**
- ✅ `booking_link` (TEXT, Optional): External booking URL
- ✅ `description` (TEXT, Optional): General spot description (existing column)
- ✅ All existing fields maintained

---

## 🔐 Authentication

All endpoints (except auth) require JWT Bearer token in header:
```
Authorization: Bearer <your_jwt_token>
```

### 1. Register User
```http
POST /api/auth/register
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "full_name": "John Doe"
}
```

**Response:**
```json
{
  "message": "User registered successfully",
  "user": {
    "id": "user_uuid",
    "email": "user@example.com",
    "full_name": "John Doe"
  }
}
```

### 2. Login
```http
POST /api/auth/login
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response:**
```json
{
  "message": "Login successful",
  "access_token": "jwt_token_here",
  "refresh_token": "refresh_token_here",
  "user": {
    "id": "user_uuid",
    "email": "user@example.com",
    "full_name": "John Doe"
  }
}
```

### 3. Get Current User
```http
GET /api/auth/me
```

### 4. Refresh Token
```http
POST /api/auth/refresh
```

**Request Body:**
```json
{
  "refresh_token": "your_refresh_token"
}
```

### 5. Logout
```http
POST /api/auth/logout
```

---

## 👥 Floks (Groups/Communities)

### 1. Get User's Floks
```http
GET /api/floks
```

**Response:**
```json
{
  "floks": [
    {
      "id": "flok_uuid",
      "name": "Basketball Buddies",
      "created_at": "2025-05-30T12:00:00Z",
      "created_by": "user_uuid",
      "active": true,
      "user_role": "admin",
      "joined_at": "2025-05-30T12:00:00Z"
    }
  ]
}
```

### 2. Create Flok
```http
POST /api/floks
```

**Request Body:**
```json
{
  "name": "Basketball Buddies"
}
```

### 3. Get Flok Details
```http
GET /api/floks/:id
```

### 4. Update Flok (Admin Only)
```http
PUT /api/floks/:id
```

**Request Body:**
```json
{
  "name": "Updated Flok Name"
}
```

### 5. Delete Flok (Admin Only)
```http
DELETE /api/floks/:id
```

### 6. Get Flok Members
```http
GET /api/floks/:id/members
```

**Response:**
```json
{
  "members": [
    {
      "user_id": "user_uuid",
      "role": "admin",
      "joined_at": "2025-05-30T12:00:00Z",
      "profiles": {
        "id": "user_uuid",
        "email": "user@example.com",
        "full_name": "John Doe",
        "avatar_url": null
      }
    }
  ]
}
```

### 7. Create Invite Code (Admin Only)
```http
POST /api/floks/:id/invites
```

**Request Body:**
```json
{
  "expires_in_days": 7
}
```

**Response:**
```json
{
  "message": "Invite created successfully",
  "invite": {
    "id": "invite_uuid",
    "flok_id": "flok_uuid",
    "code": "ABC12345",
    "created_by": "user_uuid",
    "expires_at": "2025-06-06T12:00:00Z",
    "used": false
  }
}
```

### 8. Join Flok with Invite
```http
POST /api/floks/:id/join
```

**Request Body:**
```json
{
  "invite_code": "ABC12345"
}
```

### 9. Leave Flok
```http
POST /api/floks/:id/leave
```

### 10. Get Active Invites (Admin Only)
```http
GET /api/floks/:id/invites
```

---

## 📍 Spots (Venues/Locations)

### 1. Get Spots
```http
GET /api/spots?flok_id=uuid&limit=20&offset=0
```

**Query Parameters:**
- `flok_id` (optional): Filter by specific flok
- `limit` (optional): Max results (default: 50)
- `offset` (optional): Pagination offset (default: 0)

### 2. Create Spot
```http
POST /api/spots
```

**Request Body:**
```json
{
  "name": "Downtown Basketball Court",
  "address": "123 Main St, City, State",
  "cost_per_hour": 25.00,
  "contact_number": "+1-555-0123",
  "flok_id": "flok_uuid",
  "tags": ["outdoor", "basketball", "free-parking"],
  "booking_link": "https://example.com/book",
  "description": "Large outdoor court with good lighting and free parking"
}
```

**Schema Fields:**
- `name` (required): Spot name
- `address` (optional): Physical address
- `cost_per_hour` (optional): Hourly rate in decimal
- `contact_number` (optional): Contact phone number
- `flok_id` (optional): Associated flok ID
- `tags` (optional): Array of activity tags
- `booking_link` (optional): External booking URL ⭐ NEW
- `description` (optional): General spot description ⭐ EXISTING

### 3. Get Spot Details
```http
GET /api/spots/:id
```

### 4. Update Spot
```http
PUT /api/spots/:id
```

**Permissions:** Creator or flok admin only

### 5. Delete Spot
```http
DELETE /api/spots/:id
```

**Permissions:** Creator or flok admin only

### 6. Search Spots
```http
GET /api/spots/search/:query?flok_id=uuid&limit=20
```

**Example:**
```http
GET /api/spots/search/basketball?limit=10
```

### 7. Get Spots by Flok
```http
GET /api/spots/flok/:flokId
```

---

## 🎉 Flokouts (Events)

### 1. Get Flokouts
```http
GET /api/flokouts?flok_id=uuid&status=poll&limit=50&offset=0
```

**Query Parameters:**
- `flok_id` (optional): Filter by specific flok
- `status` (optional): poll, confirmed, completed, cancelled
- `limit` (optional): Max results (default: 50)
- `offset` (optional): Pagination offset (default: 0)

### 2. Create Flokout
```http
POST /api/flokouts
```

**Request Body:**
```json
{
  "title": "Saturday Basketball Game",
  "description": "Weekly pickup game",
  "date": "2025-06-01T10:00:00Z",
  "flok_id": "flok_uuid",
  "spot_id": "spot_uuid",
  "min_people_required": 6,
  "status": "poll"
}
```

**Status Options:** `poll`, `confirmed`, `completed`, `cancelled`

### 3. Get Flokout Details
```http
GET /api/flokouts/:id
```

**Response includes attendance counts:**
```json
{
  "flokout": {
    "id": "flokout_uuid",
    "title": "Saturday Basketball Game",
    "date": "2025-06-01T10:00:00Z",
    "status": "poll",
    "min_people_required": 6,
    "yes_count": 4,
    "no_count": 1,
    "maybe_count": 2,
    "attendances": [...]
  },
  "user_role": "member"
}
```

### 4. Update Flokout
```http
PUT /api/flokouts/:id
```

**Permissions:** Creator or flok admin only

### 5. Update Flokout Status
```http
PUT /api/flokouts/:id/status
```

**Request Body:**
```json
{
  "status": "confirmed"
}
```

### 6. Confirm Flokout (Auto-validation)
```http
POST /api/flokouts/:id/confirm
```

**Note:** Automatically validates minimum attendance before confirming.

### 7. Get User's Created Flokouts
```http
GET /api/flokouts/user/created?status=poll&limit=50
```

### 8. Get User's Attending Flokouts
```http
GET /api/flokouts/user/attending?response=yes&limit=50
```

### 9. Get Flokouts by Flok
```http
GET /api/flokouts/flok/:flokId?status=confirmed
```

---

## ✅ RSVPs (Attendance)

### 1. RSVP to Flokout
```http
POST /api/rsvps/flokout/:flokoutId
```

**Request Body:**
```json
{
  "response": "yes"
}
```

**Response Options:** `yes`, `no`, `maybe`

### 2. Get Flokout RSVPs
```http
GET /api/rsvps/flokout/:flokoutId
```

**Response:**
```json
{
  "rsvps": {
    "yes": [...],
    "no": [...],
    "maybe": [...],
    "counts": {
      "yes": 4,
      "no": 1,
      "maybe": 2,
      "total": 7
    }
  },
  "all_rsvps": [...]
}
```

### 3. Remove RSVP
```http
DELETE /api/rsvps/flokout/:flokoutId
```

### 4. Get User's RSVPs
```http
GET /api/rsvps/user/rsvps?response=yes&limit=50
```

### 5. Get User's RSVP for Specific Flokout
```http
GET /api/rsvps/user/rsvp/:flokoutId
```

**Response:**
```json
{
  "rsvp": {
    "id": "rsvp_uuid",
    "response": "yes",
    "created_at": "2025-05-30T12:00:00Z"
  },
  "has_rsvp": true
}
```

---

## 💰 Expenses (Cost Management)

### 1. Get Expenses
```http
GET /api/expenses?flok_id=uuid&flokout_id=uuid&category=court&limit=50
```

**Query Parameters:**
- `flok_id` (optional): Filter by flok
- `flokout_id` (optional): Filter by flokout
- `category` (optional): court, equipment, food, transportation, other
- `limit`/`offset`: Pagination

### 2. Create Expense (Auto-Sharing)
```http
POST /api/expenses
```

**Request Body:**
```json
{
  "description": "Court rental fee",
  "amount": 100.00,
  "category": "court",
  "flokout_id": "flokout_uuid",
  "paid_by": "user_uuid"
}
```

**Response:**
```json
{
  "message": "Expense created successfully",
  "expense": {...},
  "shares_created": 6
}
```

**Categories:** `court`, `equipment`, `food`, `transportation`, `other`

### 3. Get Expense Details
```http
GET /api/expenses/:id
```

**Response includes all shares and user details:**
```json
{
  "expense": {
    "id": "expense_uuid",
    "description": "Court rental fee",
    "amount": 100.00,
    "category": "court",
    "payer": {...},
    "flokout": {...},
    "expense_shares": [
      {
        "id": "share_uuid",
        "user_id": "user_uuid",
        "amount": 16.67,
        "status": "pending",
        "user": {...}
      }
    ]
  }
}
```

### 4. Update Expense
```http
PUT /api/expenses/:id
```

**Request Body:**
```json
{
  "description": "Updated description",
  "amount": 120.00,
  "category": "equipment"
}
```

**Permissions:** Creator or payer only  
**Note:** Amount changes automatically recalculate all shares

### 5. Delete Expense
```http
DELETE /api/expenses/:id
```

**Permissions:** Creator or payer only

### 6. Get Expense Shares
```http
GET /api/expenses/:expenseId/shares
```

**Response:**
```json
{
  "shares": [
    {
      "id": "share_uuid",
      "user_id": "user_uuid",
      "amount": 16.67,
      "status": "pending",
      "settled_at": null,
      "payment_method": null,
      "user": {
        "id": "user_uuid",
        "email": "user@example.com",
        "full_name": "John Doe"
      }
    }
  ]
}
```

### 7. Calculate Settle Up (Smart Net Amounts)
```http
GET /api/expenses/settle-up/calculate?flok_id=uuid
```

**Response:**
```json
{
  "settle_up_items": [
    {
      "from": {
        "id": "user1_uuid",
        "full_name": "John Doe"
      },
      "to": {
        "id": "user2_uuid", 
        "full_name": "Jane Smith"
      },
      "amount": 25.50,
      "status": "pending",
      "expense_share_ids": ["share1_uuid", "share2_uuid"]
    }
  ]
}
```

### 8. Mark Payment as Sent
```http
POST /api/expenses/settle-up/mark-sent
```

**Request Body:**
```json
{
  "expense_share_ids": ["share1_uuid", "share2_uuid"],
  "payment_method": "venmo"
}
```

**Payment Methods:** `venmo`, `zelle`, `cash`, `other`  
**Status Change:** `pending` → `verifying`

### 9. Mark Payment as Received
```http
POST /api/expenses/settle-up/mark-received
```

**Request Body:**
```json
{
  "expense_share_ids": ["share1_uuid", "share2_uuid"]
}
```

**Permissions:** Only the payer can mark as received  
**Status Change:** `verifying` → `settled`

---

## 📖 Usage Guidelines

### 🔒 Authentication Flow
1. Register/Login to get JWT tokens
2. Include `Authorization: Bearer <token>` in all requests
3. Refresh tokens before expiration
4. Handle 401 responses by redirecting to login

### 🏗️ Typical Workflow
1. **Setup Community:**
   - Create flok → Generate invite codes → Members join
   
2. **Plan Event:**
   - Create spots → Create flokout → Members RSVP
   
3. **Manage Costs:**
   - Add expenses → Auto-calculate shares → Settle up

### 💡 Best Practices

#### Pagination
```http
GET /api/expenses?limit=20&offset=40
```
- Use reasonable limits (≤50)
- Implement offset-based pagination
- Total counts not provided (use hasMore logic)

#### Error Handling
Always check response status:
```javascript
if (!response.ok) {
  const error = await response.json();
  console.error('API Error:', error.error);
}
```

#### Filtering
Combine filters for specific results:
```http
GET /api/flokouts?flok_id=abc&status=poll&limit=10
```

#### Role-Based Actions
- **Admins can:** Update flok, remove members, manage invites
- **Members can:** Leave flok, RSVP, add expenses
- **Creators can:** Update/delete their content

### 🔄 Real-time Updates
For live data, poll these endpoints:
- Flokout RSVPs: Every 30s during active voting
- Expense settlements: Every 60s
- New flokouts: Every 5 minutes

---

## ⚠️ Error Handling

### Common HTTP Status Codes

| Code | Meaning | Example |
|------|---------|---------|
| 200 | Success | Data retrieved |
| 201 | Created | Resource created |
| 400 | Bad Request | Missing required fields |
| 401 | Unauthorized | Invalid/expired token |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource doesn't exist |
| 500 | Server Error | Database/server issue |

### Error Response Format
```json
{
  "error": "Descriptive error message",
  "code": "ERROR_CODE",
  "details": {}
}
```

### Common Errors

#### Authentication
```json
{
  "error": "Not authenticated"
}
```

#### Permission Denied
```json
{
  "error": "Access denied. Admin role required."
}
```

#### Validation Errors
```json
{
  "error": "flokout_id, description, amount, category, and paid_by are required"
}
```

#### Business Logic Errors
```json
{
  "error": "Cannot confirm flokout. Minimum 6 people required, but only 4 confirmed."
}
```

---

## 🧪 Testing Interface

### Interactive Testing
Visit: `http://localhost:3000/test-api.html`

**Features:**
- 6 organized tabs for each API section
- Auto-ID extraction for seamless workflow
- Real-time response display
- Stored authentication state
- 47+ interactive test functions

### API Testing Workflow
1. **Start with Auth tab:** Login to get tokens
2. **Create Data:** Flok → Spots → Flokouts
3. **Test Interactions:** RSVPs → Expenses → Settle Up
4. **Verify Results:** Check responses and database state

---

## 📊 API Summary

| Category | Endpoints | Key Features |
|----------|-----------|--------------|
| **Auth** | 5 | JWT tokens, refresh, user management |
| **Floks** | 10 | Communities, invites, role management |
| **Spots** | 7 | Venues, search, cost tracking |
| **Flokouts** | 11 | Events, status flow, attendance validation |
| **RSVPs** | 5 | Yes/No/Maybe, grouped stats |
| **Expenses** | 9 | Auto-sharing, smart settle-up, payment tracking |

**Total: 47 Endpoints**

---

## 🔄 Changelog

### Version 1.0.0 (2025-05-30)
- ✅ Complete API implementation
- ✅ Authentication with JWT
- ✅ Full CRUD for all resources
- ✅ Advanced expense sharing and settlement
- ✅ Role-based permissions
- ✅ Comprehensive testing interface

---

## 🤝 Contributing

This is a living document. When updating APIs:

1. **Update this documentation**
2. **Update test interface**
3. **Test all endpoints**
4. **Version bump if breaking changes**

---

**🎯 Ready for Production**  
All APIs are production-ready with comprehensive error handling, security, and testing coverage. 