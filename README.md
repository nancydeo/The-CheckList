TheCheckList - Smart Task Management with GenAI
TheCheckList is a full-stack productivity web application that allows users to manage tasks effectively with the power of AI. It integrates traditional task management features with Generative AI capabilities to enhance planning, productivity, and organization.

🚀 Features
📌 Core Task Management
Add, edit, and delete tasks
Prevent duplicate task entries
Mark tasks as completed/incomplete
Store tasks in a local tasks.txt file (lightweight, file-based storage)
💡 AI-Powered Enhancements (LLM)
Generate intelligent task suggestions using OpenAI (e.g., “Summarize today’s agenda”)
Automatically improve task titles for clarity and priority
Create checklists from raw notes using natural language prompts
✉️ Email Subscription & Reminder System
Users can subscribe with email (stored in subscribers.txt)
Email verification with a 6-digit code and activation link
Hourly reminders for pending tasks via CRON job
One-click unsubscribe with link in each email
🧰 Tech Stack
Layer	Technology
Frontend	React.js, HTML, CSS
Backend	Node.js, Express.js
AI/LLM	OpenAI API (GPT-4/OAI)
Storage	File system (.txt)
Automation	CRON Jobs
📂 Folder Structure
/src ├── routes/ │ └── taskRoutes.js ├── utils/ │ ├── emailService.js │ └── aiHelper.js ├── data/ │ ├── tasks.txt │ ├── subscribers.txt │ └── pending_subscriptions.txt ├── frontend/ │ └── React UI files └── server.js

🛠️ Setup & Installation
git clone https://github.com/RoshniSingh12220981/TheCheckList.git
cd TheCheckList
npm install
npm start

Add your OpenAI API key in a .env file:
ini
Copy code
OPENAI_API_KEY=your_key_here
