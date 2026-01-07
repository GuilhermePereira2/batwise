# Watt Builder Design Accelerator - AI Development Guide

## Project Overview
This is a battery design accelerator application built with React, TypeScript, and Supabase. It helps users design and optimize battery configurations through an interactive web interface.

## Architecture & Key Components

### Frontend (src/)
- Built with Vite + React + TypeScript
- Uses shadcn/ui components (`src/components/ui/`) for consistent styling
- Pages organized in `src/pages/` following standard React routing patterns
- Reusable components in `src/components/` (e.g., `Header.tsx`, `Footer.tsx`)

### Backend (supabase/)
- Supabase Edge Functions for battery design calculations (`supabase/functions/battery-design/`)
- Client integration configured in `src/integrations/supabase/client.ts`
- Environment variables required:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_PUBLISHABLE_KEY`

## Development Workflow

1. **Local Development**
```bash
npm install  # Install dependencies
npm run dev  # Start development server
```

2. **Building**
```bash
npm run build        # Production build
npm run build:dev    # Development build
npm run preview      # Preview build locally
```

## Project-Specific Conventions

### Component Structure
- UI components use shadcn/ui patterns with Radix primitives
- Feature components should be placed in `src/components/`
- Page components go in `src/pages/`

### State Management
- Uses Supabase for backend data and authentication
- React Query for data fetching/caching (`@tanstack/react-query`)
- Local state with React hooks where appropriate

### Battery Design Logic
- Core battery calculations in `supabase/functions/battery-design/index.ts`
- Cell data interface defined for consistent data structure:
```typescript
interface CellData {
  Brand: string;
  CellModelNo: string;
  // ... other properties
}
```

## Integration Points
- Supabase Edge Functions for battery calculations
- UI components from shadcn/ui library
- React Query for data management

## Best Practices
- Use TypeScript types consistently, especially for battery-related data structures
- Follow shadcn/ui patterns for UI components
- Keep battery calculation logic in Supabase functions
- Use environment variables for configuration