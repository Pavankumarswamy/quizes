import { ref, get, update, serverTimestamp } from "firebase/database";
import { getFirebaseDb } from "@/lib/firebase";

type QuestionOption = { id: string; text: string; correct: boolean };

type Question = {
  type: "mcq" | "multi" | "fill" | "match" | "tf" | "coding";
  answer: unknown;
  marks: number;
  negativeMarks: number;
};

type Quiz = {
  questionIds: string[];
  negativeMarking: boolean;
  totalMarks: number;
};

type Attempt = {
  quizId: string;
  startedAt: number;
};

type AttemptAnswer = {
  answer?: unknown;
  status: string;
};

export async function submitAndGradeAttempt(attemptId: string) {
  const db = getFirebaseDb();

  // 1. Fetch Attempt
  const attemptSnap = await get(ref(db, `attempts/${attemptId}`));
  if (!attemptSnap.exists()) {
    throw new Error("Attempt not found");
  }
  const attempt = attemptSnap.val() as Attempt;

  // 2. Fetch Quiz
  const quizSnap = await get(ref(db, `quizzes/${attempt.quizId}`));
  if (!quizSnap.exists()) {
    throw new Error("Quiz not found");
  }
  const quiz = quizSnap.val() as Quiz;

  // 3. Fetch User Answers
  const answersSnap = await get(ref(db, `attemptAnswers/${attemptId}`));
  const answers = (answersSnap.val() as Record<string, AttemptAnswer>) ?? {};

  let finalScore = 0;

  // 4. Score each question
  for (const qid of quiz.questionIds) {
    const qSnap = await get(ref(db, `questionBank/${qid}`));
    if (!qSnap.exists()) continue;
    const q = qSnap.val() as Question;

    const userAnswer = answers[qid];
    if (
      userAnswer &&
      userAnswer.answer !== undefined &&
      userAnswer.answer !== null &&
      userAnswer.answer !== ""
    ) {
      let isCorrect = false;

      // Grade per type
      if (q.type === "mcq" || q.type === "tf") {
        isCorrect = String(userAnswer.answer).trim() === String(q.answer).trim();
      } else if (q.type === "multi") {
        const uAns = Array.isArray(userAnswer.answer) ? userAnswer.answer : [userAnswer.answer];
        const correctAns = Array.isArray(q.answer) ? q.answer : [q.answer];

        isCorrect =
          uAns.length === correctAns.length &&
          uAns.every((val) => correctAns.includes(val)) &&
          correctAns.every((val) => uAns.includes(val));
      } else if (q.type === "fill") {
        const uStr = String(userAnswer.answer).trim().toLowerCase();
        const correctStr = String(q.answer).trim().toLowerCase();
        isCorrect = uStr === correctStr;
      } else if (q.type === "match") {
        const uMap = (userAnswer.answer as Record<string, string>) || {};
        const correctMap = (q.answer as Record<string, string>) || {};

        const uKeys = Object.keys(uMap);
        const correctKeys = Object.keys(correctMap);

        isCorrect =
          uKeys.length === correctKeys.length &&
          correctKeys.every((k) => String(uMap[k]) === String(correctMap[k]));
      } else if (q.type === "coding") {
        // Mock runner: if code has length and syntax looks okay (non-empty), evaluate as true
        isCorrect = String(userAnswer.answer).trim().length > 10;
      }

      if (isCorrect) {
        finalScore += q.marks ?? 1;
      } else {
        if (quiz.negativeMarking && q.negativeMarks) {
          finalScore -= q.negativeMarks;
        }
      }
    }
  }

  // Ensure score doesn't drop below 0
  finalScore = Math.max(0, finalScore);

  const durationSec = Math.round((Date.now() - attempt.startedAt) / 1000);

  // 5. Update attempt status
  await update(ref(db, `attempts/${attemptId}`), {
    status: "submitted",
    score: finalScore,
    submittedAt: serverTimestamp(),
    durationSec: Math.min(durationSec, 7200), // Cap at reasonable limit
  });

  return {
    score: finalScore,
    durationSec,
  };
}
