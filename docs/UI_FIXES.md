# 🔧 UI Issues and Fixes

## Issue 1: ❌ Spots Routing Broken in Web UI

**Problem**: When clicking on spots in the web UI, you get a 404 or broken routing error.

**Root Cause**: Missing route definition in `web/src/App.tsx` for spot detail view.

**Current Situation**:
- ✅ Route exists: `/spots/:id/edit` (EditSpot component)
- ❌ Route missing: `/spots/:id` (SpotDetail component)
- ❌ Component missing: `SpotDetail.tsx`

**In `web/src/pages/Spots.tsx` line 119**, spots link to:
```typescript
<Link to={`/spots/${spot.id}`} className="block">
```

But this route doesn't exist in the router!

### ✅ Fix Steps:

#### Step 1: Create SpotDetail Component
Create `web/src/pages/SpotDetail.tsx`:

```typescript
import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTerminologyContext } from '../contexts/TerminologyContext';
import { supabase } from '../lib/supabase';
import { MapPinIcon, PhoneIcon, CurrencyDollarIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';

type Spot = {
  id: string;
  name: string;
  address: string;
  contact_number: string | null;
  cost_per_hour: number | null;
  tags: string[];
  created_at: string;
  created_by: string;
  flok_id: string | null;
  flok?: {
    id: string;
    name: string;
  };
};

const SpotDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { getSingular } = useTerminologyContext();
  const [spot, setSpot] = useState<Spot | null>(null);
  const [loading, setLoading] = useState(true);
  const [canEdit, setCanEdit] = useState(false);

  useEffect(() => {
    if (id) {
      fetchSpot();
    }
  }, [id]);

  const fetchSpot = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('spots')
        .select(`
          *,
          flok:floks(id, name)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      
      setSpot(data);
      
      // Check if user can edit this spot
      if (data.created_by === user?.id) {
        setCanEdit(true);
      } else if (data.flok_id) {
        // Check if user is admin of the flok
        const { data: membership } = await supabase
          .from('flokmates')
          .select('role')
          .eq('flok_id', data.flok_id)
          .eq('user_id', user?.id)
          .single();
        
        setCanEdit(membership?.role === 'admin');
      }
    } catch (error) {
      console.error('Error fetching spot:', error);
      toast.error('Failed to load spot details');
      navigate('/spots');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!spot || !window.confirm(`Are you sure you want to delete "${spot.name}"?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('spots')
        .delete()
        .eq('id', spot.id);

      if (error) throw error;

      toast.success('Spot deleted successfully');
      navigate('/spots');
    } catch (error) {
      console.error('Error deleting spot:', error);
      toast.error('Failed to delete spot');
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!spot) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Spot not found</h1>
          <Link to="/spots" className="text-indigo-600 hover:text-indigo-500">
            ← Back to spots
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{spot.name}</h1>
              {spot.flok && (
                <p className="text-sm text-gray-500 mt-1">
                  Part of flok: <Link to={`/floks/${spot.flok.id}`} className="text-indigo-600 hover:text-indigo-500">{spot.flok.name}</Link>
                </p>
              )}
            </div>
            
            {canEdit && (
              <div className="flex space-x-2">
                <Link
                  to={`/spots/${spot.id}/edit`}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <PencilIcon className="h-4 w-4 mr-1" />
                  Edit
                </Link>
                <button
                  onClick={handleDelete}
                  className="inline-flex items-center px-3 py-2 border border-red-300 shadow-sm text-sm leading-4 font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  <TrashIcon className="h-4 w-4 mr-1" />
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-4 space-y-6">
          <div className="flex items-start space-x-3">
            <MapPinIcon className="h-5 w-5 text-gray-400 mt-0.5" />
            <div>
              <h3 className="text-sm font-medium text-gray-900">Address</h3>
              <p className="text-sm text-gray-600">{spot.address}</p>
            </div>
          </div>

          {spot.contact_number && (
            <div className="flex items-start space-x-3">
              <PhoneIcon className="h-5 w-5 text-gray-400 mt-0.5" />
              <div>
                <h3 className="text-sm font-medium text-gray-900">Contact</h3>
                <p className="text-sm text-gray-600">{spot.contact_number}</p>
              </div>
            </div>
          )}

          {spot.cost_per_hour !== null && (
            <div className="flex items-start space-x-3">
              <CurrencyDollarIcon className="h-5 w-5 text-gray-400 mt-0.5" />
              <div>
                <h3 className="text-sm font-medium text-gray-900">Cost</h3>
                <p className="text-sm text-gray-600">
                  {spot.cost_per_hour === 0 ? 'Free' : `$${spot.cost_per_hour}/hour`}
                </p>
              </div>
            </div>
          )}

          {spot.tags && spot.tags.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-2">Tags</h3>
              <div className="flex flex-wrap gap-2">
                {spot.tags.map((tag, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200">
          <Link
            to="/spots"
            className="text-indigo-600 hover:text-indigo-500 text-sm font-medium"
          >
            ← Back to all {getSingular('spot')}s
          </Link>
        </div>
      </div>
    </div>
  );
};

export default SpotDetail;
```

#### Step 2: Add Route to App.tsx
In `web/src/App.tsx`, add this route **before** the `/spots/:id/edit` route:

```typescript
// In the protected routes section, add this line:
<Route path="spots/:id" element={<SpotDetail />} />
<Route path="spots/:id/edit" element={<EditSpot />} />
```

Full context in App.tsx around line 97:
```typescript
<Route path="spots" element={<Spots />} />
<Route path="spots/new" element={<CreateSpot />} />
<Route path="spots/:id" element={<SpotDetail />} />          {/* ADD THIS LINE */}
<Route path="spots/:id/edit" element={<EditSpot />} />
<Route path="spots/list" element={<SpotList />} />
```

---

## Issue 2: ❌ Spot-Flok Association Not Visible in UI

**Problem**: When creating spots associated with floks, the association is not clearly visible in the UI.

**Root Cause**: The web UI uses different database approach than the API.

**Current Situation**:
- 🔄 **Web UI**: Uses `flok_spots` junction table with RPC functions
- 🔄 **API**: Uses direct `flok_id` foreign key in `spots` table
- ❌ **Mismatch**: The two approaches don't sync with each other

### ✅ Analysis of Current Implementation:

#### Web UI Approach (CreateSpot.tsx):
```typescript
// Web UI creates flok_spots association using RPC
const { error: flokSpotError } = await supabase.rpc('add_spot_to_flok', {
  p_flok_id: flokId,
  p_spot_id: spotId,
  p_cost_per_hour: costPerHour.trim() ? parseFloat(costPerHour.trim()) : null
});
```

#### API Approach (spotsController.ts):
```typescript
// API uses direct flok_id foreign key
const { data: spot, error: spotError } = await supabaseClient
  .from('spots')
  .insert({
    name,
    address,
    flok_id,  // Direct foreign key
    // ...other fields
  })
```

### ✅ Solutions:

#### Option 1: Standardize on API Approach (Recommended)
Update the web UI to use the same `flok_id` approach as the API:

**Update CreateSpot.tsx** (around line 240):
```typescript
// Replace the RPC call with direct flok_id assignment
const spotData = {
  name: name.trim(),
  address: address.trim(),
  contact_number: contactNumber.trim() || null,
  cost_per_hour: costPerHour.trim() ? parseFloat(costPerHour.trim()) : null,
  created_by: user?.id,
  tags: currentTags.length > 0 ? currentTags : ['Something Else'],
  flok_id: flokId || null  // ADD THIS LINE
};

// Remove the RPC call for flok_spots association
// Comment out or remove this block:
/*
if (flokId) {
  const { error: flokSpotError } = await supabase.rpc('add_spot_to_flok', {
    p_flok_id: flokId,
    p_spot_id: spotId,
    p_cost_per_hour: costPerHour.trim() ? parseFloat(costPerHour.trim()) : null
  });
  
  if (flokSpotError) {
    console.error('Error adding new spot to flok:', flokSpotError);
    throw flokSpotError;
  }
}
*/
```

**Update Spots.tsx** to use flok_id directly (it already does this correctly):
```typescript
// The current query is correct:
.select(`
  *,
  flok:floks(name)
`)
```

#### Option 2: Update API to Support Both Approaches
If you want to keep the junction table approach, update the API to also create `flok_spots` records.

### ✅ Testing the Fix:

1. **Create a spot with flok association** using the web UI
2. **Check in API** using: `GET /api/spots?flok_id=your-flok-id`
3. **Verify in web UI** that the spot shows the flok name

---

## 🔧 Quick Implementation Guide

### Fix Routing Issue (5 minutes):
1. Create `web/src/pages/SpotDetail.tsx` with the code above
2. Add the route to `web/src/App.tsx`
3. Test by clicking on spots in the web UI

### Fix Association Issue (2 minutes):
1. Update `web/src/pages/CreateSpot.tsx` to include `flok_id` in spot creation
2. Remove or comment out the RPC call to `add_spot_to_flok`
3. Test by creating a spot with flok association

### Verify Everything Works:
1. **Web UI**: Create spot with flok → should show flok name in spot list
2. **API**: GET spots → should return spots with flok_id populated
3. **Cross-platform**: Spots created in web should appear in API and vice versa

---

## 📋 Summary

- **Routing Issue**: Missing `/spots/:id` route and `SpotDetail` component
- **Association Issue**: Web UI and API use different database patterns
- **Solution**: Standardize on direct `flok_id` foreign key approach
- **Impact**: Better consistency between web UI and mobile API

Both fixes are straightforward and will make the spot functionality work consistently across web and mobile platforms! 