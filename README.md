# HackAware

A sophisticated security awareness and threat analysis platform built with Next.js. HackAware helps users identify security threats, analyze suspicious URLs/files, and learn about cybersecurity through an interactive chat interface and security quizzes.

## 🚀 Features

- **AI-Powered Security Chat:** The core interface (located at `/chat`) for cybersecurity questions and real-time threat analysis.
- **Threat Analyzer:** Scan URLs and files for potential security risks.
- **Interactive Learning:** Cybersecurity "Teach" mode and dynamic security quizzes.
- **Incident Reporting:** Streamlined interface for reporting security incidents.
- **Dashboard:** Track your security learning progress and scan history.
- **V0 Powered UI:** Clean, modern interface built with Tailwind CSS and Radix UI.
- **Direct Entry:** The root URL (`/`) automatically redirects to the Security Chat interface for immediate access.

## 🛠 Tech Stack

- **Framework:** [Next.js](https://nextjs.org/) (App Router)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/)
- **Components:** [Radix UI](https://www.radix-ui.com/) & [shadcn/ui](https://ui.shadcn.com/)
- **State Management:** React Context (Auth, Message, Sidebar)
- **Animations:** Framer Motion
- **Icons:** Lucide React

## 📂 Project Structure

```text
├── app/                  # Next.js App Router pages and layouts
│   ├── analyzer/         # Threat analysis page
│   ├── chat/             # Interactive AI chat interface
│   ├── incident/         # Incident reporting page
│   ├── learn/            # Educational resources
│   └── scanner/          # File/URL scanning interface
├── components/           # Reusable UI components
│   └── ui/               # Base shadcn/ui components
├── context/              # React Context providers (Auth, Messages)
├── hooks/                # Custom React hooks
├── lib/                  # Utility functions and API services
└── public/               # Static assets
```

## ⚙️ Getting Started

### Prerequisites

- Node.js 18+
- pnpm or npm

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/Yoinami/modular-chatbot-ui
   cd modular-chatbot-ui
   ```

2. Install dependencies:
   ```bash
   npm install --legacy-peer-deps
   ```

3. Configure Environment Variables:
   Create a `.env.local` file in the root directory and add your backend API URL:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:8000
   ```

4. Run the development server:
   ```bash
   pnpm dev
   # or
   npm run dev
   ```

Open [http://localhost:3000](http://localhost:3000) (which redirects to `/chat`) with your browser to see the result.

## 🔌 Backend Integration

This project is a frontend application that expects these two endpoints from the backend:

### `POST /query`
The primary endpoint for asking questions and receiving AI-generated answers.
- **Description:** Performs RAG (retrieval + generation) and maintains session memory.
- **Request Body:**
  - `question` (string): The user's question.
  - `session_id` (string, optional): ID to maintain conversation history (default: "default").
  - `dataset_id` (string, optional): Filter search to a specific ingested dataset.
  - `enable_tts` (boolean, optional): Set to `true` to get a TTS audio link/base64 in the response.
  - `top_k` (integer, optional): Number of documents to use for context.

### `GET /session/{session_id}/memory`
Retrieves the conversation history for a specific session.
- **Description:** Returns all previous turns (questions and answers) stored for the session.

Ensure your backend server is running and accessible at the URL defined in the `NEXT_PUBLIC_API_URL` environment variable.

## 📄 License

This project is licensed under the MIT License.
