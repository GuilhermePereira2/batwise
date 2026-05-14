# Battery Builder (BatWise) Project Documentation

## Project Overview
Battery Builder (also known as BatWise or Watt Builder) is a comprehensive tool designed for designing, simulating, and optimizing battery configurations. It caters to various use cases, including home energy storage, DIY battery builds, and business-scale energy solutions. The application provides 3D visualization of battery packs, safety assessments, and component selection (BMS, fuses, cables, etc.).

## Key Technologies
- **Frontend:** React, Vite, TypeScript, Tailwind CSS, shadcn-ui, Three.js (`react-three-fiber`).
- **Backend:** FastAPI (Python), Mangum (AWS Lambda adapter).
- **Database:** DynamoDB (User data, credits, simulations), SQLite (Local energy catalog for batteries, inverters, solar panels).
- **Authentication:** JWT, Google OAuth2, Email verification (FastAPI-mail).
- **Infrastructure:** AWS (Lambda, DynamoDB), Vercel (Frontend deployment).

## Architecture

### Frontend (`/frontend`)
- **SPA:** Built with React and Vite.
- **UI Components:** Uses shadcn-ui and Tailwind for a modern, responsive design.
- **3D Viewing:** Interactive 3D models of cells and battery packs using Three.js.
- **I18n:** Supports English (en) and Portuguese (pt) via `i18next`.
- **State Management:** React Query for efficient API communication.

### Backend (`/backend-aws`)
- **API:** RESTful API built with FastAPI.
- **Business Logic:** Core battery calculation engine in `logic.py`.
- **Auth System:** Secure user management with JWT, trial periods, and credit-based access.
- **AWS Integration:** Optimized for deployment on AWS Lambda.

### Database (`/database`)
- **DynamoDB:** Primary store for dynamic user-related data.
- **SQLite:** Stores static or semi-static catalog data for solar components.
- **Scripts:** Includes setup scripts for local DynamoDB development.

## Core Logic: Battery Calculation Engine
The engine (`backend-aws/logic.py` and `frontend/src/lib/battery-calculator.ts`) performs the following:
1.  **Configuration Search:** Iterates through cell catalogues to find series/parallel combinations that meet voltage and energy requirements.
2.  **Safety Assessment:** Evaluates C-rates, thermal risks, and voltage levels. Generates safety scores and recommendations.
3.  **Component Selection:** Automatically selects compatible BMS, fuses, relays, and cables based on calculated peak currents and voltages.
4.  **Geometric Validation:** Ensures the configuration fits within specified physical dimensions.

## Setup and Installation

### Quick Start
Run the interactive setup script:
```bash
./setup-env.sh
```
Choose from the 4 scenarios:
1.  **Tudo Local:** Frontend, Backend, and DynamoDB local.
2.  **Backend Local + DB Online:** Local development against AWS DynamoDB.
3.  **Frontend Local + Backend/DB Online:** UI development against production API.
4.  **Deploy:** Production configuration.

### Manual Backend Setup
```bash
cd backend-aws
pip install -r requirements.txt
python main.py
```

### Manual Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

## Development Workflow
- **Coding Style:** 
    - **Python:** Use Pydantic for models, follow PEP 8.
    - **TypeScript:** Strict typing, functional React components, use hooks for logic.
- **Lovable Integration:** Changes made via the Lovable platform are automatically committed. Local changes pushed to the repo will reflect in Lovable.
- **Testing:** Scripts in `database/` and `backend-aws/` provide basic testing for database connectivity and API health.

## Deployment
- **Frontend:** Deployed to Vercel (automatically via Git integration).
- **Backend:** Deployed to AWS Lambda (using SAM or Railway).
- **Database:** AWS DynamoDB (Global) and SQLite (Local to the Lambda/Server).

## Key Files and Directories
- `frontend/src/App.tsx`: Main routing and entry point.
- `backend-aws/main.py`: API endpoints and middleware.
- `backend-aws/logic.py`: Core calculation engine.
- `backend-aws/models.py`: Pydantic data models.
- `backend-aws/dynamodb_handler.py`: Interface for DynamoDB operations.
- `setup-env.sh`: Environment configuration utility.
- `upload_examples_csv/`: Templates for custom component uploads.
