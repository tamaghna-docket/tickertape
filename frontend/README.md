# Customer Intelligence Platform - Frontend

Next.js frontend with real-time WebSocket progress tracking for the Customer Intelligence Platform.

## Features

- **Real-time Progress**: WebSocket integration for live job progress updates
- **Type-safe API**: Full TypeScript integration with backend models
- **Responsive UI**: Tailwind CSS for modern, accessible design
- **Onboarding Flow**: Simple 2-field form → Real-time progress → Results display
- **Monitoring Flow**: Company selection → Progress tracking → Signal analysis

## Tech Stack

- **Next.js 14** - React framework with App Router
- **TypeScript** - Type safety throughout
- **Tailwind CSS** - Utility-first styling
- **WebSocket** - Real-time progress updates
- **React Query** (planned) - Server state management

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Create `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 4. Build for Production

```bash
npm run build
npm start
```

## Project Structure

```
frontend/
├── app/
│   ├── layout.tsx          # Root layout with header/footer
│   ├── page.tsx            # Landing page
│   ├── onboard/
│   │   └── page.tsx        # Onboarding workflow
│   └── monitor/
│       └── page.tsx        # Monitoring workflow
│
├── components/
│   └── ProgressDisplay.tsx # Real-time progress component
│
├── hooks/
│   └── useWebSocket.ts     # WebSocket connection hook
│
├── lib/
│   ├── api.ts              # API client
│   ├── types.ts            # TypeScript type definitions
│   └── utils.ts            # Utility functions
│
├── next.config.js          # Next.js configuration
├── tailwind.config.ts      # Tailwind CSS configuration
└── tsconfig.json           # TypeScript configuration
```

## Key Components

### ProgressDisplay

Real-time progress visualization with WebSocket integration:

```typescript
<ProgressDisplay jobId={jobId} title="Onboarding: Salesforce" />
```

**Features:**
- Live progress bar (0-100%)
- Task-by-stage breakdown
- Connection status indicator
- Error display
- Auto-reconnect on disconnect

### useWebSocket Hook

Custom React hook for WebSocket management:

```typescript
const {
  messages,      // All WS messages received
  tasks,         // Task states (pending/started/completed/failed)
  progress,      // Overall progress (0-1)
  status,        // Job status (pending/running/completed/failed)
  currentStep,   // Current step description
  error,         // Error message if any
  connectionState, // WS connection state
  reconnect,     // Manual reconnect function
} = useWebSocket(jobId);
```

**Auto-reconnect:** Automatically reconnects if connection drops while job is running.

### API Client

Type-safe API wrapper:

```typescript
import { api } from "@/lib/api";

// Onboarding
const response = await api.onboardCompany({
  company_name: "Salesforce",
  website: "salesforce.com",
  deep_research: true
});

const status = await api.getOnboardStatus(response.job_id);
const result = await api.getOnboardResult(response.job_id);

// Monitoring
const monitorJob = await api.monitorCustomers({
  saas_client_name: "Salesforce",
  customer_age_days: 90
});

const signals = await api.getMonitorSignals(monitorJob.job_id);
```

## Pages

### Landing Page (`/`)

Two-card layout:
- **Onboard Company** - Start new company research
- **Monitor Customers** - Check for buying signals

### Onboarding Page (`/onboard`)

**Form:**
- Company Name (required)
- Website (required)
- Deep Research checkbox (default: true)

**Progress Display:**
- Real-time WebSocket updates
- Task breakdown by stage (research, discovery)
- Overall progress bar

**Results:**
- Customers discovered
- Enterprise customers (with ticker)
- Products found
- Pricing tiers
- ICP segments
- GTM personas
- "Monitor Customers" CTA button

### Monitoring Page (`/monitor`)

**Form:**
- SaaS Company Name (required)
- Customer Age dropdown (30/60/90/180/365 days)

**Progress Display:**
- Real-time monitoring progress
- Customer-by-customer status

**Results:**
- List of signals sorted by urgency
- Signal cards showing:
  - Urgency label (🔥 HIGH / ⭐ MEDIUM / 📌 LOW)
  - Company name and ticker
  - Signal type
  - Opportunity type
  - Estimated value
  - "View Details" button

## WebSocket Message Flow

The frontend handles these WebSocket message types:

### 1. Initial Status
```json
{
  "type": "status",
  "job_id": "...",
  "status": "running",
  "progress": 0.0
}
```

### 2. Progress Update
```json
{
  "type": "progress",
  "stage": "research",
  "task": "products",
  "status": "started",
  "progress": 0.1,
  "completed": 1,
  "total": 10
}
```

### 3. Stage Transitions
```json
{
  "type": "stage_start",
  "stage": "research",
  "message": "Starting deep research..."
}
```

### 4. Completion
```json
{
  "type": "status",
  "status": "completed",
  "message": "Onboarding completed",
  "result_summary": { ... }
}
```

### 5. Errors
```json
{
  "type": "error",
  "error": "API rate limit exceeded"
}
```

## Styling

Uses Tailwind CSS with custom color scheme:

```css
--primary: Blue (#3B82F6)
--secondary: Light gray
--muted: Off-white
--border: Light border color
```

**Component patterns:**
- Rounded corners (`rounded-lg`)
- Border hover effects (`hover:border-primary`)
- Shadow on hover (`hover:shadow-md`)
- Transition animations (`transition-all`)

## TypeScript Types

All backend models are typed in `lib/types.ts`:

```typescript
OnboardRequest
OnboardResult
MonitorRequest
MonitorResult
SignalSummary
WSMessage (union of all WS message types)
TaskState
JobStatus
```

## Error Handling

**API Errors:**
- Displayed in red alert boxes
- Auto-extracted from response JSON

**WebSocket Errors:**
- Connection state indicator (green/yellow/red dot)
- Manual reconnect button
- Auto-reconnect for running jobs

**Form Validation:**
- HTML5 required fields
- Disabled submit button while processing

## Future Enhancements

### Phase 2B (Planned)
- [ ] Signal detail page with persona insights
- [ ] Full intelligence report display
- [ ] Talking points and recommendations per persona

### Phase 2C (Planned)
- [ ] React Query for better caching
- [ ] LocalStorage for job ID persistence
- [ ] Export reports to PDF/CSV
- [ ] Email sharing functionality

### Phase 2D (Planned)
- [ ] Authentication (if needed)
- [ ] Dark mode toggle
- [ ] Keyboard shortcuts
- [ ] Mobile optimization

## Development Tips

### Hot Reload

Next.js automatically reloads on file changes. WebSocket connections will reconnect automatically.

### Debugging WebSocket

Open browser DevTools → Network → WS to see WebSocket frames in real-time.

### Testing with Backend

1. Start backend: `cd .. && uv run python backend/api.py`
2. Start frontend: `npm run dev`
3. Visit http://localhost:3000

### Type Checking

```bash
npm run lint
npx tsc --noEmit
```

## Deployment

### Vercel (Recommended)

```bash
vercel
```

Configure environment variable:
- `NEXT_PUBLIC_API_URL` = Your backend URL

### Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
CMD ["npm", "start"]
```

### Static Export (if no SSR needed)

Update `next.config.js`:
```javascript
module.exports = {
  output: 'export',
};
```

Then: `npm run build` → Deploy `/out` directory

## Troubleshooting

### "WebSocket connection failed"

- Check backend is running on port 8000
- Verify CORS settings in backend allow your frontend origin
- Check browser console for specific error

### "Failed to fetch"

- Ensure `NEXT_PUBLIC_API_URL` is set correctly
- Check backend is accessible from your machine
- Verify no proxy/firewall blocking requests

### Progress not updating

- Confirm WebSocket connection (green dot)
- Check backend is sending progress messages
- Try manual reconnect button

## Contributing

When adding new features:
1. Update types in `lib/types.ts`
2. Add API methods in `lib/api.ts`
3. Create components in `components/`
4. Add pages in `app/`
5. Update this README

## License

Same as parent project
