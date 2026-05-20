# 🎸 Music Band Website - Band Management System Expansion

## Overview

This document outlines the architecture and implementation plan for expanding the existing music band website into a comprehensive **Band Management System** with dedicated portals for musicians, accounting management, and video content.

---

## 1. Architecture Overview

### Routing Structure

- / (root)              → Main landing page (existing React components)
- /band                 → Musician Portal (setlists, music tabs, PDF viewer)
- /accounting           → Accounting Portal (financial management, expense summaries)
- /videos               → Videos Page (YouTube embedded videos gallery)
- /account/login        → Member authentication page
- /account/register     → New member registration

### Technology Stack Recommendation

| Component | Option A | Option B | Option C |
|-----------|----------|----------|----------|
| Backend | Supabase | Node.js + Express | Firebase |
| Database | PostgreSQL | MongoDB | Firestore |
| File Storage | Supabase Storage | AWS S3 | Firebase Storage |
| Auth | Supabase Auth | JWT + Passport | Firebase Auth |

### Recommended Full Stack Options

1. **Supabase** (Recommended for rapid development)
   - Backend-as-a-Service with PostgreSQL
   - Built-in authentication
   - Real-time subscriptions
   - Storage for media files
   
2. **Next.js + Node.js**
   - Full control over backend logic
   - RESTful API or GraphQL
   - Can use Prisma/Sequelize ORM
   
3. **Firebase**
   - No-code backend options
   - Firestore database
   - Integrated auth and storage

---

## 2. Module 1: Musician Portal (/band)

### Features

- **Setlists Management**
  - Create, edit, delete setlists for each show
  - Drag-and-drop song ordering
  - Add songs with tempo (BPM) information
  - Mark as play or skip during performance
  
- **Music Tabs**
  - Upload PDF music tabs per song
  - Instrument-based filtering (guitar, bass, drums, vocals, keys)
  - Zoom controls for PDF viewer
  - Fullscreen mode for performance use
  - Dark mode support (preferred by musicians)
  
- **PDF Viewer Requirements**
  `	ypescript
  // Required features:
  {
    zoomIn: boolean;           // Toggle +10% zoom
    zoomOut: boolean;          // Toggle -10% zoom
    zoomToOriginal: boolean;   // Reset to 100%
    fullscreen: boolean;       // Toggle fullscreen mode
    pageNavigation: boolean;   // First/Last/Previous/Next page
    scrollMode: boolean;       // Vertical/Horizontal scrolling
    print: boolean;            // Print current view
    sidebar: boolean;          // Show/hide document outline
  }
  `

- **Performance Notes**
  - Add annotations to specific songs
  - Tempo changes (ritardando, accel)
  - Key signatures and capo positions
  
### Database Schema for Module 1

`sql
-- Members table
CREATE TABLE members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    instrument VARCHAR(100),  -- guitar, bass, drums, vocals, keys
    role VARCHAR(50),          -- lead, rhythm, backup
    phone VARCHAR(20),
    address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Shows table
CREATE TABLE shows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    venue_name VARCHAR(255) NOT NULL,
    venue_address TEXT,
    setlist_id UUID REFERENCES setlists(id),
    created_by UUID REFERENCES members(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Setlists table
CREATE TABLE setlists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    show_id UUID REFERENCES shows(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    total_songs INTEGER,
    estimated_duration_minutes INTEGER,
    created_by UUID REFERENCES members(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Setlist items table
CREATE TABLE setlist_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    setlist_id UUID REFERENCES setlists(id) ON DELETE CASCADE,
    song_title VARCHAR(255) NOT NULL,
    artist_name VARCHAR(255),
    original_key VARCHAR(10),
    capo_position INTEGER,
    bpm DECIMAL(5,2),
    order_index INTEGER NOT NULL,
    is_played BOOLEAN DEFAULT FALSE,
    duration_seconds INTEGER,
    pdf_url TEXT,  -- Link to uploaded PDF tab
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Member setlist preferences
CREATE TABLE member_setlist_prefs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID REFERENCES members(id) ON DELETE CASCADE,
    setlist_id UUID REFERENCES setlists(id),
    instrument_filter VARCHAR(100),  -- specific parts to show
    zoom_level DECIMAL(4,2) DEFAULT 100.00,
    is_favorite BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`

---

## 3. Module 2: Accounting Portal (/accounting)

### Features

- **Financial Management**
  - Track income (ticket sales, merch, sponsorships)
  - Track expenses (venue rental, equipment, travel, meals)
  - Monthly expense summaries with categorization
  - Export to CSV/PDF for accounting software
  
- **Monthly Expense Summaries**
  `	ypescript
  interface MonthlySummary {
    month: string;               // "2026-04"
    income: number;              // total revenue
    expenses: {
      venue: number;             // venue rental, setup
      equipment: number;         // gear purchases/rentals
      travel: number;            // transport, hotels
      meals: number;             // crew meals
      marketing: number;         // ads, flyers
      other: number;             // misc
    };
    net_profit: number;          // income - expenses
    percentage_breakdown: {      // visual chart data
      venue: number;
      equipment: number;
      travel: number;
      meals: number;
      marketing: number;
      other: number;
    }
  }
  `

- **Sharing Options**
  - Generate shareable summary links (read-only)
  - Export to PDF with band branding
  - CSV export for spreadsheet import
  - Email summaries to band members
  
### Database Schema for Module 2

`sql
-- Transactions table
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(20) NOT NULL CHECK (type IN ('income', 'expense')),
    category VARCHAR(50),         -- venue, equipment, travel, meals, etc.
    amount DECIMAL(10,2) NOT NULL,
    description TEXT,
    reference_number VARCHAR(100),  -- invoice #, receipt #
    show_date DATE,               -- related show if applicable
    uploaded_file_url TEXT,       -- receipt/scanned doc
    created_by UUID REFERENCES members(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_verified BOOLEAN DEFAULT FALSE,
    verified_by UUID REFERENCES members(id)
);

-- Categories table
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) UNIQUE NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('income', 'expense')),
    description TEXT,
    color VARCHAR(7),             -- for visual charts
    is_active BOOLEAN DEFAULT TRUE
);

-- Monthly summaries (computed or pre-calculated)
CREATE TABLE monthly_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    month DATE NOT NULL UNIQUE,   -- first day of month
    total_income DECIMAL(10,2) DEFAULT 0,
    venue_expense DECIMAL(10,2) DEFAULT 0,
    equipment_expense DECIMAL(10,2) DEFAULT 0,
    travel_expense DECIMAL(10,2) DEFAULT 0,
    meals_expense DECIMAL(10,2) DEFAULT 0,
    marketing_expense DECIMAL(10,2) DEFAULT 0,
    other_expense DECIMAL(10,2) DEFAULT 0,
    net_profit DECIMAL(10,2) GENERATED ALWAYS AS (total_income - venue_expense - equipment_expense - travel_expense - meals_expense - marketing_expense - other_expense),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Transaction categories mapping
CREATE TABLE transaction_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE,
    category_id UUID REFERENCES categories(id),
    amount DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Share links table
CREATE TABLE share_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    summary_month_id UUID REFERENCES monthly_summaries(id),
    member_id UUID REFERENCES members(id),
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    is_used BOOLEAN DEFAULT FALSE,
    used_by UUID REFERENCES members(id)
);
`

---

## 4. Module 3: Videos Page (/videos)

### Features

- **YouTube Embedded Videos Gallery**
  - Display band performance videos
  - Filter by show date or setlist
  - Responsive iframe embedding
  - Video descriptions with context
  
- **Video Management**
  - Add new YouTube video links
  - Categorize by concert, rehearsal, interview
  - Thumbnail preview from YouTube API
  - Embed code customization

### Database Schema for Module 3

`sql
-- Videos table
CREATE TABLE videos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    youtube_id VARCHAR(20) NOT NULL,  -- YouTube video ID
    youtube_url TEXT NOT NULL,         -- Full URL
    title VARCHAR(255) NOT NULL,
    description TEXT,
    show_date DATE,
    setlist_id UUID REFERENCES setlists(id),
    category VARCHAR(50),              -- concert, rehearsal, interview, etc.
    thumbnail_url TEXT,                -- Cached thumbnail for faster loading
    duration_seconds INTEGER,
    views_count INTEGER DEFAULT 0,     -- Optional tracking
    uploaded_by UUID REFERENCES members(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_featured BOOLEAN DEFAULT FALSE,
    order_index INTEGER
);

-- Video categories
CREATE TABLE video_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    icon_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Video category memberships
CREATE TABLE video_category_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
    category_id UUID REFERENCES video_categories(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`

---

## 5. Implementation Phases

### Week-by-Week Breakdown

#### **Phase 1: Foundation (Weeks 1-2)**

| Week | Tasks | Deliverables |
|------|-------|--------------|
| **Week 1** | - Set up backend infrastructure (Supabase/Node.js/Firebase)<br>- Create database schema<br>- Implement authentication system<br>- Build basic API routes | - Backend environment configured<br>- Database tables created<br>- Auth working for band members<br>- Basic API documentation |
| **Week 2** | - Build setlist CRUD operations<br>- Implement PDF upload and storage<br>- Create musician portal UI shell<br>- Set up routing structure | - Setlist management working<br>- PDF viewer with zoom/fullscreen<br>- /band route functional<br>- Navigation completed |

#### **Phase 2: Musician Portal (Weeks 3-4)**

| Week | Tasks | Deliverables |
|------|-------|--------------|
| **Week 3** | - Complete setlist editor UI<br>- Add instrument filters for tabs<br>- Implement PDF viewer controls<br>- Add performance notes feature | - Full setlist editing capability<br>- Instrument filtering working<br>- Zoom/fullscreen/scroll controls<br>- Notes annotation system |
| **Week 4** | - Add drag-and-drop song ordering<br>- Implement show creation flow<br>- Connect to existing React app<br>- Test with real band members | - Drag-and-drop functional<br>- Show creation complete<br>- Integrated with main site<br>- User feedback incorporated |

#### **Phase 3: Accounting Portal (Weeks 5-6)**

| Week | Tasks | Deliverables |
|------|-------|--------------|
| **Week 5** | - Build transaction CRUD operations<br>- Create expense categorization UI<br>- Implement monthly summary calculations<br>- Add CSV export functionality | - Transaction management complete<br>- Categorization working<br>- Monthly summaries calculated<br>- CSV export functional |
| **Week 6** | - Build PDF receipt upload<br>- Create shareable summary links<br>- Design visual charts for summaries<br>- Email notification system | - Receipt uploads working<br>- Share links generated<br>- Charts rendered correctly<br>- Email notifications sent |

#### **Phase 4: Videos Page (Weeks 7-8)**

| Week | Tasks | Deliverables |
|------|-------|--------------|
| **Week 7** | - Build YouTube video gallery UI<br>- Implement YouTube API integration<br>- Create video categorization system<br>- Add thumbnail caching | - Video gallery displayed<br>- YouTube embed working<br>- Categories functional<br>- Thumbnails cached |
| **Week 8** | - Add video search/filter<br>- Implement featured videos section<br>- Optimize loading performance<br>- Mobile responsiveness check | - Search/filter complete<br>- Featured section visible<br>- Performance optimized<br>- Mobile responsive verified |

#### **Phase 5: Integration & Testing (Weeks 9-10)**

| Week | Tasks | Deliverables |
|------|-------|--------------|
| **Week 9** | - End-to-end testing<br>- Security audit<br>- Performance optimization<br>- Documentation writing | - All features tested<br>- Security vulnerabilities fixed<br>- Performance benchmarks met<br>- API docs complete |
| **Week 10** | - User acceptance testing with band<br>- Bug fixes and refinements<br>- Final deployment preparation<br>- Training materials creation | - Band feedback incorporated<br>- Bugs resolved<br>- Deployment ready<br>- Training docs available |

---

## 6. Database Schema Summary

### Core Tables Overview

`sql
-- === AUTHENTICATION ===
CREATE TABLE members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    instrument VARCHAR(100),
    role VARCHAR(50),
    phone VARCHAR(20),
    address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- === SHOWS & SETLISTS ===
CREATE TABLE shows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    venue_name VARCHAR(255) NOT NULL,
    venue_address TEXT,
    setlist_id UUID REFERENCES setlists(id),
    created_by UUID REFERENCES members(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE setlists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    show_id UUID REFERENCES shows(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    total_songs INTEGER,
    estimated_duration_minutes INTEGER,
    created_by UUID REFERENCES members(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE setlist_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    setlist_id UUID REFERENCES setlists(id) ON DELETE CASCADE,
    song_title VARCHAR(255) NOT NULL,
    artist_name VARCHAR(255),
    original_key VARCHAR(10),
    capo_position INTEGER,
    bpm DECIMAL(5,2),
    order_index INTEGER NOT NULL,
    is_played BOOLEAN DEFAULT FALSE,
    duration_seconds INTEGER,
    pdf_url TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- === ACCOUNTING ===
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(20) NOT NULL CHECK (type IN ('income', 'expense')),
    category VARCHAR(50),
    amount DECIMAL(10,2) NOT NULL,
    description TEXT,
    reference_number VARCHAR(100),
    show_date DATE,
    uploaded_file_url TEXT,
    created_by UUID REFERENCES members(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_verified BOOLEAN DEFAULT FALSE
);

CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) UNIQUE NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('income', 'expense')),
    description TEXT,
    color VARCHAR(7),
    is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE monthly_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    month DATE NOT NULL UNIQUE,
    total_income DECIMAL(10,2) DEFAULT 0,
    venue_expense DECIMAL(10,2) DEFAULT 0,
    equipment_expense DECIMAL(10,2) DEFAULT 0,
    travel_expense DECIMAL(10,2) DEFAULT 0,
    meals_expense DECIMAL(10,2) DEFAULT 0,
    marketing_expense DECIMAL(10,2) DEFAULT 0,
    other_expense DECIMAL(10,2) DEFAULT 0,
    net_profit DECIMAL(10,2) GENERATED ALWAYS AS (total_income - venue_expense - equipment_expense - travel_expense - meals_expense - marketing_expense - other_expense),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- === VIDEOS ===
CREATE TABLE videos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    youtube_id VARCHAR(20) NOT NULL,
    youtube_url TEXT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    show_date DATE,
    setlist_id UUID REFERENCES setlists(id),
    category VARCHAR(50),
    thumbnail_url TEXT,
    duration_seconds INTEGER,
    views_count INTEGER DEFAULT 0,
    uploaded_by UUID REFERENCES members(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE video_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    icon_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- === MEMBER PREFERENCES ===
CREATE TABLE member_setlist_prefs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID REFERENCES members(id) ON DELETE CASCADE,
    setlist_id UUID REFERENCES setlists(id),
    instrument_filter VARCHAR(100),
    zoom_level DECIMAL(4,2) DEFAULT 100.00,
    is_favorite BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE share_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    summary_month_id UUID REFERENCES monthly_summaries(id),
    member_id UUID REFERENCES members(id),
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    is_used BOOLEAN DEFAULT FALSE,
    used_by UUID REFERENCES members(id)
);
`

---

## 7. File Structure

### Updated Directory Structure

`
musicband/
├── project/                          # Frontend (existing React app)
│   ├── src/
│   │   ├── components/               # Existing React components
│   │   │   ├── Banner.tsx
│   │   │   ├── Bio.tsx
│   │   │   ├── Calendar.tsx
│   │   │   ├── Contact.tsx
│   │   │   ├── Events.tsx
│   │   │   ├── Logo.tsx
│   │   │   ├── Menu.tsx
│   │   │   ├── sectionTitle.tsx
│   │   │   ├── SocialCarousel.tsx
│   │   │   └── SocialPost.tsx
│   │   ├── pages/                    # NEW: Full-page components for portals
│   │   │   ├── BandPortal.tsx        # /band route
│   │   │   ├── AccountingPortal.tsx  # /accounting route
│   │   │   └── VideosPage.tsx       # /videos route
│   │   ├── lib/                      # NEW: Shared utilities
│   │   │   ├── supabaseClient.ts     # Or firebaseClient.ts
│   │   │   ├── api/
│   │   │   │   ├── setlists.ts
│   │   │   │   ├── transactions.ts
│   │   │   │   └── videos.ts
│   │   ├── hooks/                    # NEW: Custom hooks
│   │   │   ├── useSetlist.ts
│   │   │   ├── useTransactions.ts
│   │   │   └── useVideos.ts
│   │   ├── types/                    # NEW: TypeScript types
│   │   │   ├── setlist.ts
│   │   │   ├── transaction.ts
│   │   │   └── video.ts
│   │   ├── assets/                   # Existing assets
│   │   ├── App.css
│   │   └── main.tsx
│   ├── tsconfig.json
│   ├── package.json
│   └── vite.config.ts
│
├── backend/                          # NEW: Backend services
│   ├── src/
│   │   ├── routes/
│   │   │   ├── setlists.routes.ts
│   │   │   ├── transactions.routes.ts
│   │   │   ├── videos.routes.ts
│   │   │   └── auth.routes.ts
│   │   ├── controllers/
│   │   │   ├── setlists.controller.ts
│   │   │   ├── transactions.controller.ts
│   │   │   ├── videos.controller.ts
│   │   │   └── auth.controller.ts
│   │   ├── services/
│   │   │   ├── supabaseService.ts     # Or dbService.ts for Node.js
│   │   │   ├── youtubeService.ts
│   │   │   └── fileUploadService.ts
│   │   ├── middleware/
│   │   │   ├── auth.middleware.ts
│   │   │   └── validation.middleware.ts
│   │   ├── utils/
│   │   │   ├── pdfProcessor.ts
│   │   │   └── monthlySummaryCalculator.ts
│   │   └── index.ts                  # Entry point
│   ├── supabase-schema.sql           # Database migrations
│   └── package.json
│
├── docs/                             # Documentation
│   ├── api.md                        # API documentation
│   ├── deployment.md                 # Deployment guide
│   └── security.md                   # Security considerations
│
├── dev_plan.md                       # This file
├── README.md
└── AGENTS.md
`

---

## 8. Backend Technology Suggestions

### Option A: Supabase (Recommended)

**Pros:**
- PostgreSQL with real-time subscriptions
- Built-in authentication and Row Level Security
- Storage for PDF uploads
- Easy integration with existing React frontend
- Free tier available (500MB storage, 50k monthly active users)

**Setup:**
`ash
npm create supabase@latest my-band-app
# or
npx create-supabase-app my-band-app
`

### Option B: Node.js + Express

**Pros:**
- Full control over backend logic
- Can use any database (PostgreSQL, MySQL, MongoDB)
- RESTful API or GraphQL support
- Middleware ecosystem for validation, auth, file uploads

**Setup:**
`ash
npm init -y
npm install express cors helmet morgan
# For PostgreSQL with Prisma:
npm install prisma @prisma/client
# For authentication:
npm install jsonwebtoken bcryptjs express-session
# For file uploads:
npm install multer
`

### Option C: Firebase

**Pros:**
- No-code backend options
- Firestore database (NoSQL)
- Firebase Auth integration
- Firebase Storage for files
- Real-time database features

**Setup:**
`ash
npm install firebase
firebase init
# Creates firestore.rules, firebase.json, etc.
`

### Option D: Next.js (Full Stack Framework)

**Pros:**
- API routes built-in
- Server-side rendering for SEO
- Image optimization
- File system access in server components
- Can use Supabase/Firebase as backend

**Setup:**
`ash
npx create-next-app@latest my-band-app --typescript --tailwind --eslint
`

### Recommendation Matrix

| Criteria | Best Option | Runner-up |
|----------|-------------|-----------|
| Fastest setup | Supabase | Firebase |
| Most flexible | Node.js + Express | Next.js |
| SEO requirements | Next.js | Supabase (SSR) |
| Team collaboration | Supabase | Next.js |
| Cost (free tier) | Supabase | Firebase |

---

## 9. Security Considerations

### Authentication & Authorization

1. **Member Authentication**
   - Recommended: Email + Password with password reset
   - Minimum password length: 8 characters
   - Require special character and number
   - Account lockout after 5 failed attempts
   
2. **Row Level Security (RLS) - Supabase**
   `sql
   -- Enable RLS on sensitive tables
   ALTER TABLE setlist_items ENABLE ROW LEVEL SECURITY;
   
   -- Only members can view/edit their own preferences
   CREATE POLICY member_prefs_policy ON member_setlist_prefs
       FOR ALL USING (auth.uid() IN (SELECT id FROM members));
   
   -- Members can only access data for their shows
   CREATE POLICY show_access_policy ON setlists
       FOR SELECT USING (
           EXISTS (
               SELECT 1 FROM shows s 
               WHERE s.setlist_id = setlists.id
               AND s.created_by IN (SELECT id FROM members)
           )
       );
   `

3. **API Security**
   - Use environment variables for secrets
   - Implement rate limiting on API endpoints
   - Validate all inputs server-side
   - Sanitize file uploads

### File Upload Security

1. **PDF Validation**
   - Validate uploaded files before storing
   - Check magic bytes for PDF format
   - Check file size limit (e.g., 10MB per PDF)

2. **Storage Permissions**
   - Private storage for member-specific data
   - Public read-only for videos (YouTube embeds dont need this)
   - Signed URLs with expiration for sensitive files

### Data Privacy Considerations

- **GDPR Compliance**: Implement data export and deletion functionality
- **PCI-DSS**: If collecting payment information, use Stripe/PayPal (dont store card data)
- **Session Management**: Use secure cookies with HttpOnly flag
- **Logging**: Log security events without exposing sensitive data

---

## 10. Milestones & Deliverables

### Phase 1: Foundation (Weeks 1-2)

| Milestone | Deliverable | Acceptance Criteria |
|-----------|-------------|---------------------|
| **M1.1** | Backend infrastructure setup | - Environment configured<br>- Database connected<br>- Auth working |
| **M1.2** | Setlist CRUD operations | - Create setlist works<br>- Add songs functional<br>- Edit/delete operational |
| **M1.3** | PDF viewer implementation | - Zoom controls work<br>- Fullscreen toggles<br>- Scroll modes functional |

### Phase 2: Musician Portal (Weeks 3-4)

| Milestone | Deliverable | Acceptance Criteria |
|-----------|-------------|---------------------|
| **M2.1** | Drag-and-drop ordering | - Songs reorder correctly<br>- Order saved to database<br>- Visual feedback provided |
| **M2.2** | Instrument filters | - Filter by instrument works<br>- Multiple instruments selectable<br>- UI updates instantly |
| **M2.3** | Performance notes | - Add/edit notes per song<br>- Notes persist across sessions<br>- Export notes feature |

### Phase 3: Accounting Portal (Weeks 5-6)

| Milestone | Deliverable | Acceptance Criteria |
|-----------|-------------|---------------------|
| **M3.1** | Transaction management | - Add transactions works<br>- Categorize expenses functional<br>- Search/filter operational |
| **M3.2** | Monthly summaries | - Calculations accurate<br>- Charts render correctly<br>- Export to CSV/PDF works |
| **M3.3** | Sharing features | - Share links generated<br>- Links expire as configured<br>- Used by member tracked |

### Phase 4: Videos Page (Weeks 7-8)

| Milestone | Deliverable | Acceptance Criteria |
|-----------|-------------|---------------------|
| **M4.1** | Video gallery | - YouTube embeds display<br>- Thumbnails load<br>- Descriptions visible |
| **M4.2** | Categorization | - Filter by category works<br>- Featured videos section shows<br>- Mobile responsive |
| **M4.3** | Search & performance | - Search returns results<br>- Loading optimized<br>- No console errors |

### Phase 5: Integration & Testing (Weeks 9-10)

| Milestone | Deliverable | Acceptance Criteria |
|-----------|-------------|---------------------|
| **M5.1** | Security audit completed | - No critical vulnerabilities<br>- RLS policies in place<br>- File upload validation working |
| **M5.2** | Performance optimization | - Load time < 3 seconds<br>- Smooth interactions<br>- Mobile performance acceptable |
| **M5.3** | Documentation complete | - API docs published<br>- Deployment guide written<br>- User training materials ready |

---

## 11. Estimated Timeline Summary

### Overall Project Timeline: 10 Weeks

| Phase | Duration | Key Activities | Completion Date (estimated) |
|-------|----------|----------------|----------------------------|
| **Phase 1** | 2 weeks | Foundation & Setup | Week 2 end |
| **Phase 2** | 2 weeks | Musician Portal Development | Week 4 end |
| **Phase 3** | 2 weeks | Accounting Portal Development | Week 6 end |
| **Phase 4** | 2 weeks | Videos Page Development | Week 8 end |
| **Phase 5** | 2 weeks | Integration & Testing | Week 10 end |

### Milestone Dates (Example)

Assuming project start date of May 17, 2026:

| Milestone | Date | Status |
|-----------|------|--------|
| M1.1 Backend Setup | May 24, 2026 | Pending |
| M1.3 PDF Viewer Ready | May 31, 2026 | Pending |
| M2.2 Instrument Filters | June 7, 2026 | Pending |
| M3.2 Monthly Summaries | June 21, 2026 | Pending |
| M4.2 Video Categorization | June 28, 2026 | Pending |
| **M5.3 Final Delivery** | **July 11, 2026** | **Target** |

### Buffer Time Recommendations

- **Testing buffer**: Add 1 week after Phase 5 for bug fixes
- **Review meetings**: Schedule weekly syncs (1 hour each)
- **Contingency**: Plan for 10% time overrun on complex features

---

## Next Steps

### Immediate Actions (Week 1)

1. **Choose Backend Technology**
   - Evaluate Supabase vs Node.js vs Firebase
   - Check team familiarity with chosen stack
   
2. **Set Up Development Environment**
   - Initialize backend project
   - Create database schema
   - Set up environment variables
   
3. **Design Database Schema**
   - Review SQL schemas above
   - Adjust based on specific needs
   - Run migrations to create tables

### Success Metrics

- [ ] Band members can access setlists and music tabs
- [ ] PDF viewer works with all zoom/fullscreen features
- [ ] Accounting summaries are accurate and shareable
- [ ] Videos page displays YouTube content correctly
- [ ] All security measures implemented and tested
- [ ] Documentation complete for team onboarding

---

## Appendix A: API Endpoints Reference

### Setlists API

`
POST   /api/setlists          # Create new setlist
GET    /api/setlists/:id      # Get setlist with items
PUT    /api/setlists/:id      # Update setlist
DELETE /api/setlists/:id      # Delete setlist
POST   /api/setlists/:id/items  # Add song to setlist
PUT    /api/setlists/:id/items/:itemId  # Update song item
DELETE /api/setlists/:id/items/:itemId  # Remove song from setlist
`

### Transactions API

`
POST   /api/transactions      # Create transaction
GET    /api/transactions      # List transactions (with filters)
PUT    /api/transactions/:id  # Update transaction
DELETE /api/transactions/:id  # Delete transaction
POST   /api/categories        # Create category
GET    /api/categories        # List categories
`

### Videos API

`
POST   /api/videos          # Add YouTube video
GET    /api/videos          # List videos (with filters)
PUT    /api/videos/:id      # Update video metadata
DELETE /api/videos/:id      # Remove video
POST   /api/videos/:id/categories  # Add category
DELETE /api/videos/:id/categories/:categoryId  # Remove category
`

---

*Document Version: 1.0*  
*Last Updated: May 17, 2026*
