# electricwisers — Feature & Functionality Documentation

This document provides a comprehensive overview of the features, functionalities, and architecture of the **electricwisers** quiz and syllabus management platform.

---

## 1. Core Architecture

### Client-Only SPA (Single Page Application)
* **Static Build**: The project compiles to 100% standard static HTML, CSS, JS, and assets under the `/dist` directory.
* **Hostinger Compatibility**: Easily deployable on standard PHP/shared hosting servers (like Hostinger) with zero Node.js server dependencies.
* **Apache URL Rewrite (`.htaccess`)**: Automatically routes deep-link page paths (such as `/dashboard` or `/admin/documents`) back to `index.html`. This enables smooth client-side routing and prevents `404 Not Found` errors when reloading.
* **Secure API Proxy (`nvidia-proxy.php`)**: A lightweight PHP bridge forwards requests to the NVIDIA AI API. This ensures that:
  1. Your private NVIDIA API key is stored safely on the server side and never exposed to the client.
  2. Bypasses browser CORS (Cross-Origin Resource Sharing) restrictions since requests are sent locally.

### Real-Time Database Integration
* **Firebase Realtime Database**: All quiz attempts, questions, documents, and syllabus trees are stored and synced instantly. 
* **Supabase Storage**: Secure storage bucket integration for hosting PDF curriculum sheets.
* **Cloudinary**: Client-side image upload handler for question diagrams and profile pictures.

---

## 2. Ingestion & Syllabus Parsing

### PDF Curriculum Ingestion
* **Client-Side Extraction**: Read and extract text from uploaded PDF curriculum files directly in the browser.
* **Syllabus Tree Parser**: Organizes the extracted PDF outline into a structured hierarchy of **Units** and **Topics**.
* **Automatic Chunking**: Automatically breaks up curriculum text into page-based text chunks and maps them dynamically to their respective topic nodes.
* **AI Prompt Copier**: Copy-to-clipboard prompts allow manual ingestion via external models (Claude, ChatGPT, Gemini) if custom parsing configurations are preferred.

### Syllabus Tree Editor
* **Interactive Tree View**: Browse units and topics with expandable/collapsible accordion panels.
* **Dynamic Node Controls**: Add, edit, rename, or delete units, topics, and subtopics inline.
* **Granular Target Selectors**: Checkboxes allow admins to select specific nodes to focus the AI question generator on localized curriculum chunks.

---

## 3. AI Quiz Generator (RAG)

### Grounded Ingestion (RAG)
* Generates quizzes that are grounded strictly in the text chunks of your selected syllabus nodes. This minimizes AI hallucinations and ensures all questions are relevant to the curriculum.

### Supported Question Types (6 Formats)
1. **Multiple Choice (MCQ)**: Single selection from up to 4 choices.
2. **Multi-Select (MRQ)**: Checkboxes for questions with multiple correct options.
3. **Fill-in-the-Blanks**: Text inputs compared case-insensitively with the solution.
4. **True / False**: Boolean statements.
5. **Match the Following**: Connect columns of items (Column Left to Column Right) via dropdown menus.
6. **Coding Stubs**: Interactive programming challenges in various languages (e.g. JavaScript).

### Custom Count and Difficulty Configuration
* Control the exact count of each question type generated per session.
* Configure overall difficulty levels: **Easy**, **Medium**, **Hard**, or **Mixed/Balanced**.

---

## 4. Real-Time Attempt Engine

### Test-Taking Environment
* **Strict Exam Mode**: Correct/incorrect states and explanations are hidden during active attempts to ensure academic integrity.
* **Countdown Timer**: Floating timer with visual warnings that automatically triggers auto-submission if time runs out.
* **Interactive Widgets**: Specially tailored input components for each question type.
* **Mock Code Sandbox**: A mock terminal sandbox environment for running programming stubs, showing mock test compile logs.
* **Autosave**: Progress and selected answers are saved directly to Firebase in the background, preventing loss of data on accidental page refresh.

### Question Palette Sidebar
* Visual state trackers for all questions:
  * **Answered** (Green badge)
  * **Marked for Review** (Indigo badge)
  * **Visited / Unanswered** (Red badge)
  * **Unvisited** (Outline badge)
* Quick-navigation buttons allow students to jump directly to any question.

---

## 5. Grading, Feedback & Explanations

### Instant Grading
* Auto-calculates correct/incorrect marks immediately upon submission based on type-specific grading rules (e.g., negative marking penalties).

### Detailed Performance Analysis
* Displays overall score (`Your Score / Max Score`), accuracy percentage, duration taken, and number of questions answered.
* Shows visual correctness badges (Green check for Correct, Red cross for Incorrect) along with the expected answer.

### AI Explanations
* Below every graded question, a highlighted alert box displays a **logical explanation** generated by the AI detailing *why* the correct answer is right and the step-by-step logic behind it.

---

## 6. Admin Panel Console

### Overview Dashboard
* Live count overview displaying totals for categories, subcategories, quizzes, questions, users, and documents stored in Firebase.

### Management Interfaces
* **Category Registry**: Add and delete quiz categories and subcategories.
* **Document Registry**: Monitor PDF ingestion, view syllabus trees, and clear unused document records.
* **Question Bank Reviewer**: Review generated draft questions, modify text/marks, and publish them to the official library.
* **Quiz Builder**: Compile custom quizzes by naming them, setting time limits, and checking off specific questions from the question bank.
* **User Manager**: Keep track of registered users and view roles.
